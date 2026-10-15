import { claimJobs } from '@/lib/printing';
import { allow, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** El programa de impresión del local pide sus trabajos con el código de la sede (cabecera Authorization: Bearer …). */
export async function GET(request: Request) {
  if (!allow(`print:${await clientIp()}`, 300, 60_000)) return json({ error: 'Demasiadas consultas' }, 429);
  const code = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const jobs = await claimJobs(code);
  if (!jobs) return json({ error: 'Código no válido. Crea uno nuevo en Impresoras.' }, 401);
  return json({ trabajos: jobs });
}
