import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, API_URL } from '@/lib/api';

// Pasa la petición a la API y devuelve el PDF tal cual (el navegador lo descarga). La API revisa permisos.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: 'Origen no permitido' }, { status: 403 });
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Tu sesión se cerró. Vuelve a entrar.' }, { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/companies/${id}/doc-generator/generate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'No se pudo conectar con el servidor' }, { status: 502 });
  }
  if (!upstream.ok) return new NextResponse(await upstream.text(), { status: upstream.status, headers: { 'content-type': 'application/json' } });
  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': upstream.headers.get('content-disposition') ?? 'attachment; filename="documento.pdf"',
      'cache-control': 'private, no-store',
      ...(upstream.headers.get('x-saved-document') ? { 'x-saved-document': upstream.headers.get('x-saved-document')! } : {}),
    },
  });
}
