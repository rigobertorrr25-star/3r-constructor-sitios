import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new NextResponse('No encontrado', { status: 404 });
  const res = await fetch(`${API_URL}/public/quotes/${token}/pdf`, { cache: 'no-store' });
  if (!res.ok) return new NextResponse('Esta cotización no existe o el enlace cambió.', { status: 404 });
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
      'cache-control': 'private, no-store',
    },
  });
}
