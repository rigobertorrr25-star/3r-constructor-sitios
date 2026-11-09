// Entrar solo desde el wifi del local (6 nov 2026, pedido de Rigoberto: «que la página solo sirva para meseros y
// cajeros teniendo el wifi del local, para que no puedan hacer nada estando en sus casas»).
//
// Cada sede guarda las direcciones de internet (IP pública) de su wifi. Si tiene alguna, quien no es dueño ni
// administrador solo entra (y solo sigue trabajando) desde una de ellas. El dueño y el administrador entran desde
// cualquier parte para poder arreglarlo si el proveedor de internet cambia la dirección.
// IPv4 se compara exacta; IPv6 por su prefijo /64 (los celulares cambian la parte final a cada rato).
import { query, transaction } from './db';
import { AppError, audit, requirePermission, type Actor } from './store';
import type { Role } from './permissions';

export const ANYWHERE_ROLES: readonly Role[] = ['owner', 'manager'];

/** La parte de la dirección que se compara: la IPv4 completa o los primeros 4 grupos de una IPv6. */
export function networkKey(ip: string): string {
  const clean = ip.trim().toLowerCase().replace(/^::ffff:/, '');
  if (!clean.includes(':')) return clean;
  // Expande «::» para tomar los 4 primeros grupos.
  const [head, tail = ''] = clean.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = clean.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

export function allowedFrom(ip: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  const key = networkKey(ip);
  return allowed.some((a) => networkKey(a) === key);
}

export async function locationNetworks(locationId: string): Promise<string[]> {
  const row = (await query<{ ips: string[] | null }>(`SELECT allowed_ips AS ips FROM locations WHERE id = $1`, [locationId]))[0];
  return row?.ips ?? [];
}

/** ¿Puede esta persona trabajar desde esta dirección? */
// Quitado (9 nov 2026, Rigoberto: «elimina lo del wifi»): todos entran desde cualquier conexión. Las conexiones guardadas
// siguen en la base (no se borra nada) pero ya no se revisan. Para volver a prenderlo, poner WIFI_LOCK = true.
const WIFI_LOCK = false;

export async function canWorkFrom(staff: { role: Role; locationId: string }, ip: string): Promise<boolean> {
  if (!WIFI_LOCK || ANYWHERE_ROLES.includes(staff.role)) return true;
  return allowedFrom(ip, await locationNetworks(staff.locationId));
}

/** Agrega la conexión de ahora (el dueño o el administrador, estando en el local) a la lista de la sede. */
export async function addLocationNetwork(actor: Actor, ip: string) {
  requirePermission(actor, 'locations.manage');
  if (!ip || ip === 'desconocida') throw new AppError('INVALID', 'No pudimos ver la dirección de esta conexión.');
  const key = networkKey(ip);
  await transaction(async (db) => {
    const current = (await db.query<{ ips: string[] | null }>(`SELECT allowed_ips AS ips FROM locations WHERE id = $1 AND business_id = $2 FOR UPDATE`, [actor.locationId, actor.businessId])).rows[0];
    const ips = current?.ips ?? [];
    if (ips.some((x) => networkKey(x) === key)) throw new AppError('CONFLICT', 'Esta conexión ya está en la lista.');
    if (ips.length >= 10) throw new AppError('INVALID', 'Ya hay 10 conexiones: quita alguna primero.');
    await db.query(`UPDATE locations SET allowed_ips = $2 WHERE id = $1`, [actor.locationId, [...ips, key]]);
    await audit(db, actor, { action: 'location.network', entity: 'location', entityId: actor.locationId, summary: `Agregó la conexión ${key} al wifi del local` });
  });
}

/** Quita una conexión; sin ninguna, se vuelve a poder entrar desde cualquier parte. */
export async function removeLocationNetwork(actor: Actor, key: string) {
  requirePermission(actor, 'locations.manage');
  await transaction(async (db) => {
    const current = (await db.query<{ ips: string[] | null }>(`SELECT allowed_ips AS ips FROM locations WHERE id = $1 AND business_id = $2 FOR UPDATE`, [actor.locationId, actor.businessId])).rows[0];
    const ips = (current?.ips ?? []).filter((x) => x !== key);
    await db.query(`UPDATE locations SET allowed_ips = $2 WHERE id = $1`, [actor.locationId, ips]);
    await audit(db, actor, {
      action: 'location.network',
      entity: 'location',
      entityId: actor.locationId,
      summary: ips.length ? `Quitó la conexión ${key} del wifi del local` : `Quitó la última conexión: el equipo vuelve a entrar desde cualquier parte`,
    });
  });
}
