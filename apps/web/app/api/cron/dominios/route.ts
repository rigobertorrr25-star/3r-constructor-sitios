// Revisión diaria (cron de Vercel, ver vercel.json): dominios propios por vencer y alertas de la plataforma empresarial. Vercel llama aquí con
// `Authorization: Bearer <CRON_SECRET>`, y se le pasa la misma clave a la API, que manda los avisos.
import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';

// La API gratis de Render se duerme: la primera petición puede tardar casi un minuto en despertarla.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ message: 'CRON_SECRET sin configurar' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  // Una tarea tras otra: la primera despierta la API si estaba dormida.
  const run = async (path: string) => {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(18_000),
      });
      return { ok: res.ok, body: await res.json().catch(() => null) };
    } catch {
      return { ok: false, body: { message: 'La API no respondió' } };
    }
  };
  const domains = await run('/internal/domain-renewals/run');
  const alerts = await run('/internal/alerts/run');
  const billing = await run('/internal/billing/run');
  return NextResponse.json(
    { domains: domains.body, alerts: alerts.body, billing: billing.body },
    { status: domains.ok && alerts.ok && billing.ok ? 200 : 502 },
  );
}
