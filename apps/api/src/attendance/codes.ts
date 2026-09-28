import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Cada cuánto cambia el código que muestra la tablet de la entrada. */
export const CODE_WINDOW_MS = 30_000;
/**
 * Cuántas ventanas anteriores se siguen aceptando. Da unos dos minutos entre escanear y poner el PIN,
 * pero una foto del QR ya no sirve desde la casa al día siguiente (ni a la hora siguiente).
 */
const ACCEPTED_PAST_WINDOWS = 3;

export const newKioskSecret = () => randomBytes(24).toString('base64url');

export function kioskCode(secret: string, slug: string, window: number): string {
  return createHmac('sha256', secret).update(`${slug}:${window}`).digest('base64url').slice(0, 16);
}

export function currentCode(secret: string, slug: string, now = Date.now()) {
  const window = Math.floor(now / CODE_WINDOW_MS);
  return { code: kioskCode(secret, slug, window), expiresInMs: (window + 1) * CODE_WINDOW_MS - now };
}

export function isValidCode(secret: string, slug: string, code: string, now = Date.now()): boolean {
  const window = Math.floor(now / CODE_WINDOW_MS);
  const given = Buffer.from(code);
  for (let back = 0; back <= ACCEPTED_PAST_WINDOWS; back++) {
    const expected = Buffer.from(kioskCode(secret, slug, window - back));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

/** El PIN no se guarda tal cual. Con el id del negocio, el mismo PIN en dos negocios da huellas distintas. */
export const pinHash = (businessId: string, pin: string) => createHmac('sha256', businessId).update(pin).digest('hex');

// ── Fechas en hora de Colombia (UTC-5, sin horario de verano) ──

const BOGOTA_OFFSET_MS = -5 * 60 * 60_000;

/** Inicio del día AAAA-MM-DD en Colombia, como instante UTC. */
export function bogotaDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - BOGOTA_OFFSET_MS);
}
