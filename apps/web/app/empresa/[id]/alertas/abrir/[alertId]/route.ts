import { NextResponse, type NextRequest } from 'next/server';
import { authedApi } from '@/lib/api';

// Marca el aviso como leído y lleva a lo que avisa (solo rutas de esta misma empresa).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; alertId: string }> }) {
  const { id, alertId } = await params;
  const back = new URL(`/empresa/${id}/alertas`, request.nextUrl.origin);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(alertId)) return NextResponse.redirect(back);
  const res = await authedApi<{ href: string | null }>(`/companies/${id}/alerts/${alertId}/read`, { method: 'POST' });
  const href = res.ok ? res.data.href : null;
  // Solo caminos relativos simples (nunca otro sitio).
  if (!href || !/^[a-z0-9_\-/?=&]+$/i.test(href) || href.startsWith('/')) return NextResponse.redirect(back);
  return NextResponse.redirect(new URL(`/empresa/${id}/${href}`, request.nextUrl.origin));
}
