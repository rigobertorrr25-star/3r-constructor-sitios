import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, API_URL } from '@/lib/api';

const UUID = /^[0-9a-f-]{36}$/i;

// Descarga el certificado de un curso (el propio o, para supervisores, el de alguien del equipo).
export async function GET(request: Request, { params }: { params: Promise<{ id: string; courseId: string }> }) {
  const { id, courseId } = await params;
  if (!UUID.test(id) || !UUID.test(courseId)) return new NextResponse('No encontrado', { status: 404 });
  const memberId = new URL(request.url).searchParams.get('memberId');
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return new NextResponse('Tu sesión se cerró', { status: 401 });
  const query = memberId && UUID.test(memberId) ? `?memberId=${memberId}` : '';
  const res = await fetch(`${API_URL}/companies/${id}/training/${courseId}/certificate${query}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return new NextResponse('No se encontró el certificado', { status: res.status });
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
      'cache-control': 'private, no-store',
    },
  });
}
