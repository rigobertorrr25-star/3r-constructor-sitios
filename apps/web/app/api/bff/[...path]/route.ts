// Puente entre el navegador y la API: el editor guarda y consulta aquí, y el servidor de Next
// añade el token desde la cookie httpOnly. Así el JavaScript del navegador nunca ve los tokens.
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, API_URL } from '@/lib/api';

// Solo los recursos que el editor necesita; la API vuelve a comprobar dueño y permisos.
const ALLOWED = new Set(['pages', 'sites', 'media']);

const json = (message: string, status: number) => NextResponse.json({ message }, { status });

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!ALLOWED.has(path[0])) return json('Ruta no permitida', 404);

  const method = request.method;
  if (method !== 'GET') {
    // Defensa extra contra CSRF (las cookies ya son SameSite=Lax).
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) return json('Origen no permitido', 403);
    if (method !== 'DELETE' && !request.headers.get('content-type')?.includes('application/json')) {
      return json('Se esperaba JSON', 415);
    }
  }

  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return json('No autenticado', 401);

  const target = `${API_URL}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: method === 'GET' || method === 'DELETE' ? undefined : await request.text(),
      cache: 'no-store',
    });
  } catch {
    return json('No se pudo conectar con el servidor', 502);
  }

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
