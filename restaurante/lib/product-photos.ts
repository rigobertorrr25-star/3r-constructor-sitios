import { imageMime } from './backgrounds';
import { query, transaction } from './db';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export const PRODUCT_PHOTO_MAX_BYTES = 800_000;

/** Quien edita la carta sube (o cambia) la foto de un producto. */
export async function saveProductPhoto(actor: Actor, productId: string, bytes: Uint8Array) {
  requirePermission(actor, 'menu.edit');
  if (!isUuid(productId)) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
  if (!bytes.length) throw new AppError('INVALID', 'Escoge una foto.');
  if (bytes.length > PRODUCT_PHOTO_MAX_BYTES) throw new AppError('INVALID', 'La foto es muy pesada. Prueba con otra más liviana.');
  const mime = imageMime(bytes);
  if (!mime) throw new AppError('INVALID', 'Solo fotos JPG, PNG o WebP.');
  await transaction(async (db) => {
    const product = (await db.query<{ name: string }>(`SELECT name FROM menu_products WHERE id = $1 AND business_id = $2`, [productId, actor.businessId]))
      .rows[0];
    if (!product) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
    await db.query(
      `INSERT INTO product_photos (product_id, business_id, mime, image) VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id) DO UPDATE SET mime = EXCLUDED.mime, image = EXCLUDED.image, updated_at = clock_timestamp()`,
      [productId, actor.businessId, mime, Buffer.from(bytes)],
    );
    await audit(db, actor, {
      action: 'menu.photo',
      entity: 'menu_product',
      entityId: productId,
      summary: `Cambió la foto de ${product.name}`,
    });
  });
}

export async function removeProductPhoto(actor: Actor, productId: string) {
  requirePermission(actor, 'menu.edit');
  if (!isUuid(productId)) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
  await transaction(async (db) => {
    const res = await db.query<{ name: string }>(
      `DELETE FROM product_photos f USING menu_products p WHERE f.product_id = $1 AND f.business_id = $2 AND p.id = f.product_id RETURNING p.name`,
      [productId, actor.businessId],
    );
    if (res.rows[0])
      await audit(db, actor, {
        action: 'menu.photo',
        entity: 'menu_product',
        entityId: productId,
        summary: `Quitó la foto de ${res.rows[0].name}`,
      });
  });
}

/** La foto de un producto de un restaurante activo, para mostrarla (null si no tiene). */
export async function getProductPhoto(productId: string): Promise<{ mime: string; image: Buffer } | null> {
  if (!isUuid(productId)) return null;
  const rows = await query<{ mime: string; image: Buffer }>(
    `SELECT f.mime, f.image FROM product_photos f JOIN businesses b ON b.id = f.business_id WHERE f.product_id = $1 AND b.is_active`,
    [productId],
  );
  return rows[0] ?? null;
}
