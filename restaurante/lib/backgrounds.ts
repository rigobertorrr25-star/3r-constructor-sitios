import { query, transaction } from './db';
import { AppError, audit, requirePermission, type Actor } from './store';

export const BACKGROUND_MAX_BYTES = 1_500_000;

/** Revisa los primeros bytes: solo se aceptan fotos JPG, PNG o WebP de verdad (no basta con el nombre). */
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** El dueño sube (o cambia) la foto de fondo de su restaurante. */
export async function saveBackground(actor: Actor, bytes: Uint8Array) {
  requirePermission(actor, 'locations.manage');
  if (!bytes.length) throw new AppError('INVALID', 'Escoge una foto.');
  if (bytes.length > BACKGROUND_MAX_BYTES) throw new AppError('INVALID', 'La foto es muy pesada. Prueba con otra más liviana.');
  const mime = imageMime(bytes);
  if (!mime) throw new AppError('INVALID', 'Solo fotos JPG, PNG o WebP.');
  await transaction(async (db) => {
    await db.query(
      `INSERT INTO business_backgrounds (business_id, mime, image) VALUES ($1, $2, $3)
       ON CONFLICT (business_id) DO UPDATE SET mime = EXCLUDED.mime, image = EXCLUDED.image, updated_at = clock_timestamp()`,
      [actor.businessId, mime, Buffer.from(bytes)],
    );
    await audit(db, actor, { action: 'business.background', entity: 'business', entityId: actor.businessId, summary: 'Cambió el fondo del restaurante' });
  });
}

export async function removeBackground(actor: Actor) {
  requirePermission(actor, 'locations.manage');
  await transaction(async (db) => {
    const res = await db.query(`DELETE FROM business_backgrounds WHERE business_id = $1`, [actor.businessId]);
    if (res.rowCount) await audit(db, actor, { action: 'business.background', entity: 'business', entityId: actor.businessId, summary: 'Quitó el fondo del restaurante' });
  });
}

/** La foto de un restaurante activo, para mostrarla (null si no tiene). */
export async function getBackground(slug: string): Promise<{ mime: string; image: Buffer; updatedAt: Date } | null> {
  const rows = await query<{ mime: string; image: Buffer; updatedAt: Date }>(
    `SELECT g.mime, g.image, g.updated_at AS "updatedAt" FROM business_backgrounds g JOIN businesses b ON b.id = g.business_id
      WHERE b.slug = $1 AND b.is_active`,
    [slug],
  );
  return rows[0] ?? null;
}

/** Versión del fondo de un negocio (para armar su dirección), o null si no tiene. */
export async function backgroundVersion(businessId: string): Promise<number | null> {
  const rows = await query<{ v: number }>(
    `SELECT (extract(epoch FROM updated_at) * 1000)::bigint::float8 AS v FROM business_backgrounds WHERE business_id = $1`,
    [businessId],
  );
  return rows[0]?.v ?? null;
}
