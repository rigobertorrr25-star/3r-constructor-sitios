// Dos ingresos: 3R entra a /admin con ADMIN_PASSWORD; el equipo de cada negocio entra en /n/{slug} con código + PIN.
// Las sesiones son cookies firmadas. La del equipo lleva el "epoch" de la persona: si le cambian el PIN, el rol
// o la sede, o la desactivan, la cookie vieja deja de valer en la siguiente petición.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { can, homeOf, type Permission } from './permissions';
import { getStaffSession, type StaffSession } from './store';

export const ADMIN_COOKIE = 'rc_admin';
export const STAFF_COOKIE = 'rc_equipo';
const ADMIN_DAYS = 30;
// Un turno largo: la tablet compartida no queda abierta para siempre.
const STAFF_HOURS = 14;

const sha256 = (text: string) => createHash('sha256').update(text).digest();

/** Sin estas dos variables nadie entra (ni con una clave vacía). */
export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET?.length ?? 0) >= 16);
}

const sign = (payload: string) => createHmac('sha256', `${process.env.SESSION_SECRET}`).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkAdminPassword(input: string): boolean {
  if (!authConfigured()) return false;
  return timingSafeEqual(sha256(input), sha256(process.env.ADMIN_PASSWORD!));
}

// La firma de 3R depende también de la clave: si se cambia ADMIN_PASSWORD, se cierran sus sesiones.
const adminPayload = (expires: number) => `admin:${expires}:${sha256(process.env.ADMIN_PASSWORD ?? '').toString('base64url')}`;

export function adminSessionValue(now = Date.now()) {
  const expires = now + ADMIN_DAYS * 86_400_000;
  return { value: `${expires}.${sign(adminPayload(expires))}`, maxAge: ADMIN_DAYS * 86_400 };
}

export function parseAdminSession(value: string | undefined, now = Date.now()): boolean {
  if (!value || !authConfigured()) return false;
  const [expiresText, signature] = value.split('.');
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < now || !signature) return false;
  return safeEqual(sign(adminPayload(expires)), signature);
}

export function staffSessionValue(staffId: string, locationId: string, epoch: number, now = Date.now()) {
  const expires = now + STAFF_HOURS * 3_600_000;
  const body = `${expires}.${staffId}.${locationId}.${epoch}`;
  return { value: `${body}.${sign(`staff:${body}`)}`, maxAge: STAFF_HOURS * 3_600 };
}

export function parseStaffSession(value: string | undefined, now = Date.now()) {
  if (!value || !authConfigured()) return null;
  const parts = value.split('.');
  if (parts.length !== 5) return null;
  const [expiresText, staffId, locationId, epochText, signature] = parts;
  const expires = Number(expiresText);
  const epoch = Number(epochText);
  if (!Number.isFinite(expires) || expires < now || !Number.isInteger(epoch)) return null;
  if (!safeEqual(sign(`staff:${expiresText}.${staffId}.${locationId}.${epochText}`), signature)) return null;
  return { staffId, locationId, epoch };
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

export async function isAdmin() {
  return parseAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/entrar');
}

/** Quién del equipo está usando la app, o null (sin sesión, vencida o invalidada). */
export async function getStaff(): Promise<StaffSession | null> {
  const parsed = parseStaffSession((await cookies()).get(STAFF_COOKIE)?.value);
  if (!parsed) return null;
  return getStaffSession(parsed.staffId, parsed.locationId, parsed.epoch);
}

/** Para las páginas del equipo: sin sesión, a la portada; sin permiso, a su pantalla de inicio. */
export async function requireStaff(permission?: Permission): Promise<StaffSession> {
  const staff = await getStaff();
  if (!staff) redirect('/');
  if (permission && !can(staff.role, permission)) redirect(homeOf(staff.role));
  return staff;
}
