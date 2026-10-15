import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_URL } from '@/lib/api';

// Descarga el PDF de una cotización (la API revisa permisos).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(quoteId)) return new NextResponse('No encontrado', { status: 404 });
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return new NextResponse('Tu sesión se cerró', { status: 401 });
  const res = await fetch(`${API_URL}/companies/${id}/quotes/${quoteId}/pdf`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return new NextResponse('No se encontró la cotización', { status: res.status });
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
      'cache-control': 'private, no-store',
    },
  });
}
