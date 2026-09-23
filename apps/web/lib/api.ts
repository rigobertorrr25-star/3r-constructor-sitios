// Cliente de la API para código que corre en el servidor de Next (nunca en el navegador).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1';

export const ACCESS_COOKIE = '3r_at';
export const REFRESH_COOKIE = '3r_rt';

export type ApiResult<T> = { status: number; ok: boolean; data: T };

type RequestInit = { method?: string; body?: unknown; token?: string };

export async function rawApi<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : null) as T;
  return { status: res.status, ok: res.ok, data };
}

/**
 * Llamada autenticada con el access token de la cookie. El proxy ya renovó el token si había
 * expirado; si aun así la API responde 401, la sesión no es válida y se vuelve al login.
 */
export async function authedApi<T>(path: string, init: Omit<RequestInit, 'token'> = {}) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login?expired=1');
  const result = await rawApi<T>(path, { ...init, token });
  if (result.status === 401) redirect('/login?expired=1');
  return result;
}

/**
 * Igual que authedApi, pero para páginas públicas (portada) que solo quieren *mostrar* si hay
 * sesión — nunca exige login ni redirige. `null` si no hay cookie, si el token ya no sirve, o si
 * la API no responde. El access token dura 14 minutos y esta función no lo renueva (eso solo pasa
 * en las rutas protegidas, ver proxy.ts); en el peor caso, la portada tarda hasta 14 minutos en
 * volver a notar que sigues conectado, y se corrige solo con visitar cualquier página protegida.
 */
export async function currentUserOrNull<T>(): Promise<T | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const result = await rawApi<T>('/auth/me', { token });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: maxAgeSeconds,
});

// El access token dura 15 min en la API: la cookie caduca un poco antes para renovarlo a tiempo.
export const ACCESS_MAX_AGE = 14 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export async function setSession(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  jar.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
