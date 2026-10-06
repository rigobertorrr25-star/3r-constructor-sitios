import { finishJob } from '@/lib/printing';
import { allow, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** El programa avisa si el trabajo salió ({ "ok": true }) o no ({ "ok": false, "error": "…" }). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allow(`print:${await clientIp()}`, 300, 60_000)) return json({ error: 'Demasiadas consultas' }, 429);
  const code = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const body = (await request.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
  if (!body || typeof body.ok !== 'boolean') return json({ error: 'Falta "ok"' }, 400);
  const { id } = await params;
  const done = await finishJob(code, id, body.ok, typeof body.error === 'string' ? body.error : undefined);
  if (done === null) return json({ error: 'Código no válido' }, 401);
  return json({ ok: done });
}
