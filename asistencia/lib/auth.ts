// Ingreso al panel con una sola clave (ADMIN_PASSWORD). La sesión es una cookie firmada.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'asistencia_sesion';
const SESSION_DAYS = 30;

const sha256 = (text: string) => createHash('sha256').update(text).digest();

/** Falta configuración: sin las dos variables nadie entra (ni con una clave vacía). */
export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET?.length ?? 0) >= 16);
}

// La firma depende también de la clave: si se cambia ADMIN_PASSWORD, se cierran todas las sesiones.
const sign = (expires: number) =>
  createHmac('sha256', `${process.env.SESSION_SECRET}:${process.env.ADMIN_PASSWORD}`).update(`panel:${expires}`).digest('base64url');

export function checkPassword(input: string): boolean {
  if (!authConfigured()) return false;
  return timingSafeEqual(sha256(input), sha256(process.env.ADMIN_PASSWORD!));
}

export function sessionValue(now = Date.now()) {
  const expires = now + SESSION_DAYS * 86_400_000;
  return { value: `${expires}.${sign(expires)}`, maxAge: SESSION_DAYS * 86_400 };
}

export function isValidSession(value: string | undefined, now = Date.now()): boolean {
  if (!value || !authConfigured()) return false;
  const [expiresText, signature] = value.split('.');
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < now || !signature) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function isLoggedIn() {
  return isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Para páginas y acciones del panel: sin sesión, al ingreso. */
export async function requireAdmin() {
  if (!(await isLoggedIn())) redirect('/entrar');
}
