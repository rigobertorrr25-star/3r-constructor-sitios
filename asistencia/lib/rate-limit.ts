// Freno simple contra intentos repetidos (adivinar la clave o un PIN), por IP y por instancia del servidor.
import { headers } from 'next/headers';

const hits = new Map<string, { count: number; resetAt: number }>();

/** true si todavía se permite; false si ya pasó el límite en esta ventana. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (hits.size > 5_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida';
}
