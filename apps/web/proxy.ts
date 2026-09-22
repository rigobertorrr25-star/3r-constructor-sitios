import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const ACCESS_COOKIE = '3r_at';
const REFRESH_COOKIE = '3r_rt';
const ACCESS_MAX_AGE = 14 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

// Dominio base de los sitios publicados: cliente.<SITES_ROOT_HOST>. En desarrollo, *.localhost.
const SITES_ROOT_HOST = (process.env.SITES_ROOT_HOST ?? 'localhost').toLowerCase();

// Áreas que exigen sesión.
const PROTECTED = ['/dashboard', '/pedir', '/admin', '/editor', '/api/bff'];

type Tokens = { accessToken: string; refreshToken: string };

// Varias peticiones a la vez (página + precarga) traerían el mismo refresh token. La API rota
// el token y trata su reuso como robo, así que se comparte una sola renovación por token.
const inflight = new Map<string, Promise<Tokens | null>>();

function refresh(refreshToken: string): Promise<Tokens | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const promise = fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
    .then(async (res) => (res.ok ? ((await res.json()) as Tokens) : null))
    .catch(() => null);

  inflight.set(refreshToken, promise);
  setTimeout(() => inflight.delete(refreshToken), 15_000);
  return promise;
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

// Las rutas /api/* las llama el editor con fetch: reciben un 401 en JSON, no una redirección.
const isApi = (request: NextRequest) => request.nextUrl.pathname.startsWith('/api/');

/** Al iniciar sesión se vuelve a la página que se pedía (por ejemplo, el formulario de un paquete). */
function loginUrl(request: NextRequest, expired: boolean) {
  const url = new URL('/login', request.url);
  if (expired) url.searchParams.set('expired', '1');
  url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return url;
}

function toLogin(request: NextRequest) {
  const response = isApi(request)
    ? NextResponse.json({ message: 'No autenticado' }, { status: 401 })
    : NextResponse.redirect(loginUrl(request, true));
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

/**
 * Etiqueta del sitio publicado si la petición llega a su dirección propia (etiqueta.localhost, etiqueta.tudominio.com).
 * `www` y direcciones con varios niveles no cuentan: son de la aplicación.
 */
function publishedLabel(request: NextRequest): string | null {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  if (!host.endsWith(`.${SITES_ROOT_HOST}`)) return null;
  const label = host.slice(0, -(SITES_ROOT_HOST.length + 1));
  return label && label !== 'www' && !label.includes('.') ? label : null;
}

/** Sirve los sitios publicados por su dirección y protege las áreas privadas (renovando el token si caducó). */
export async function proxy(request: NextRequest) {
  // 1. Dirección propia de un cliente: todo se reescribe a su sitio publicado; nunca a la aplicación.
  const label = publishedLabel(request);
  if (label) {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${label}${request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 2. Páginas públicas de la aplicación: no exigen sesión.
  const path = request.nextUrl.pathname;
  if (!PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return NextResponse.next();

  // 3. Áreas privadas.
  if (request.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return isApi(request)
      ? NextResponse.json({ message: 'No autenticado' }, { status: 401 })
      : NextResponse.redirect(loginUrl(request, false));
  }

  const tokens = await refresh(refreshToken);
  if (!tokens) return toLogin(request);

  // La petición en curso también debe ver los tokens nuevos, no solo el navegador.
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  return response;
}

// Todo salvo los archivos internos de Next: hace falta ver cada petición para reconocer las direcciones de clientes.
export const config = { matcher: ['/((?!_next/|favicon.ico|icon.svg).*)'] };
