// Ingreso al panel. El administrador entra con ADMIN_PASSWORD; cada jefe, con la clave que le creó el
// administrador (solo ve el reporte de su negocio). La sesión es una cookie firmada que dice quién es.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getManager } from './store';

export const SESSION_COOKIE = 'asistencia_sesion';
const SESSION_DAYS = 30;

/** Quién está viendo el panel. */
export type Viewer = { role: 'admin' } | { role: 'manager'; id: string; businessId: string; name: string };

/** Sujeto de la sesión: "admin" o "m-{id del jefe}". */
export type SessionSubject = 'admin' | `m-${string}`;

const sha256 = (text: string) => createHash('sha256').update(text).digest();

/** Falta configuración: sin las dos variables nadie entra (ni con una clave vacía). */
export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET?.length ?? 0) >= 16);
}

// La firma depende también de la clave del administrador: si se cambia ADMIN_PASSWORD, se cierran todas las sesiones.
const sign = (expires: number, subject: string) =>
  createHmac('sha256', `${process.env.SESSION_SECRET}:${process.env.ADMIN_PASSWORD}`).update(`panel:${expires}:${subject}`).digest('base64url');

export function checkPassword(input: string): boolean {
  if (!authConfigured()) return false;
  return timingSafeEqual(sha256(input), sha256(process.env.ADMIN_PASSWORD!));
}

export function sessionValue(subject: SessionSubject = 'admin', now = Date.now()) {
  const expires = now + SESSION_DAYS * 86_400_000;
  return { value: `${expires}.${subject}.${sign(expires, subject)}`, maxAge: SESSION_DAYS * 86_400 };
}

/** El sujeto de una sesión válida, o null (vencida, alterada o sin configuración). */
export function parseSession(value: string | undefined, now = Date.now()): SessionSubject | null {
  if (!value || !authConfigured()) return null;
  const [expiresText, subject, signature] = value.split('.');
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < now || !subject || !signature) return null;
  if (subject !== 'admin' && !/^m-[0-9a-f-]{36}$/.test(subject)) return null;
  const expected = Buffer.from(sign(expires, subject));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? (subject as SessionSubject) : null;
}

/** Quién está viendo, o null. Un jefe borrado deja de entrar de inmediato: se revisa en la base cada vez. */
export async function getViewer(): Promise<Viewer | null> {
  const subject = parseSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!subject) return null;
  if (subject === 'admin') return { role: 'admin' };
  const manager = await getManager(subject.slice(2));
  return manager ? { role: 'manager', id: manager.id, businessId: manager.businessId, name: manager.name } : null;
}

/** Para páginas que ven el administrador y los jefes: sin sesión, al ingreso. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/entrar');
  return viewer;
}

/** Para lo que solo puede hacer el administrador (cambiar cosas). Un jefe vuelve a su reporte. */
export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== 'admin') redirect(`/panel/${viewer.businessId}`);
}

/** Si quien ve puede abrir el reporte de este negocio. */
export const canView = (viewer: Viewer, businessId: string) => viewer.role === 'admin' || viewer.businessId === businessId;
