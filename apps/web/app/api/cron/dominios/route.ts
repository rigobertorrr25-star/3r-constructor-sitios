// Revisión diaria de dominios propios por vencer (cron de Vercel, ver vercel.json). Vercel llama aquí con
// `Authorization: Bearer <CRON_SECRET>`, y se le pasa la misma clave a la API, que manda los avisos.
import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';

// La API gratis de Render se duerme: la primera petición puede tardar casi un minuto en despertarla.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ message: 'CRON_SECRET sin configurar' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  try {
    const res = await fetch(`${API_URL}/internal/domain-renewals/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(55_000),
    });
    const body = await res.json().catch(() => null);
    return NextResponse.json(body ?? { message: 'Respuesta vacía de la API' }, { status: res.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ message: 'La API no respondió' }, { status: 502 });
  }
}
