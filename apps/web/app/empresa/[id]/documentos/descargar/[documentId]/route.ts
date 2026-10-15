import { NextResponse } from 'next/server';
import { authedApi } from '@/lib/api';

// Pide a la API un enlace firmado (5 minutos) y lleva al navegador ahí. La API decide si esta persona puede verlo.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(documentId)) return new NextResponse('No encontrado', { status: 404 });
  const res = await authedApi<{ url: string }>(`/companies/${id}/documents/${documentId}/download`);
  if (!res.ok) return new NextResponse('Ese documento no existe o no tienes acceso.', { status: 404 });
  return NextResponse.redirect(res.data.url, { headers: { 'cache-control': 'no-store' } });
}
