// Importar la carta de una sola vez: el dueño pega el texto (una línea por producto con su precio al final, y el nombre
// de la categoría en su propia línea) y quedan creadas las categorías y los productos. Sirve para pasar la carta impresa.
import { transaction } from './db';
import { AppError, audit, requirePermission, type Actor } from './store';
import { isStation, type Station } from './stations';

export type ParsedMenu = { categories: { name: string; products: { name: string; price: number }[] }[] };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Lee el texto de la carta. Una línea que termina en precio es un producto («Corona ........ $ 12.000», «Corona 12000»);
 * una línea sin precio es el nombre de la categoría. Lo que va antes del precio (puntos, guiones, $) se limpia.
 */
export function parseMenuText(text: string): ParsedMenu {
  const categories: ParsedMenu['categories'] = [];
  const lines = String(text ?? '').split(/\r?\n/);
  if (lines.length > 600) throw new AppError('INVALID', 'La carta es muy larga: pégala por partes (hasta 600 líneas).');
  lines.forEach((raw, i) => {
    const line = clean(raw);
    if (!line) return;
    // El precio al final: 12.000 / 12,000 / 12 000 / 12000, con o sin $.
    const match = line.match(/^(.*?)[\s.·…_\-–—:|]*\$?\s*(\d{1,3}(?:[.,\s]\d{3})+|\d{3,})\s*$/);
    if (match && clean(match[1]).length >= 2) {
      const price = Number(match[2].replace(/[.,\s]/g, ''));
      const name = clean(match[1].replace(/[\s.·…_\-–—:|$]+$/, ''));
      if (name.length > 80) throw new AppError('INVALID', `Línea ${i + 1}: el nombre es muy largo (hasta 80 letras).`);
      if (price > 100_000_000) throw new AppError('INVALID', `Línea ${i + 1}: ese precio no parece correcto.`);
      const current = categories.at(-1);
      if (!current) throw new AppError('INVALID', `Línea ${i + 1}: escribe primero el nombre de la categoría (por ejemplo «Cervezas»).`);
      current.products.push({ name, price });
      return;
    }
    const name = clean(line.replace(/^#+/, '').replace(/:$/, ''));
    if (name.length < 2 || name.length > 60) throw new AppError('INVALID', `Línea ${i + 1}: «${line.slice(0, 40)}» no tiene precio y no sirve como categoría.`);
    categories.push({ name, products: [] });
  });
  const withProducts = categories.filter((c) => c.products.length);
  if (!withProducts.length) throw new AppError('INVALID', 'No encontramos productos con precio. Pon cada producto en una línea con su precio al final.');
  return { categories: withProducts };
}

/**
 * Crea lo que falta y actualiza precios. Una categoría o un producto que ya existen (mismo nombre) no se repiten:
 * si el precio cambió, se cambia y queda en la auditoría como cualquier cambio de precio.
 */
export async function importMenu(actor: Actor, text: string, station: Station = 'bar') {
  requirePermission(actor, 'menu.edit');
  if (!isStation(station)) throw new AppError('INVALID', 'Elige si va a cocina o a barra.');
  const menu = parseMenuText(text);
  return transaction(async (db) => {
    const counts = { categories: 0, products: 0, prices: 0, same: 0 };
    for (const category of menu.categories) {
      let categoryId = (
        await db.query<{ id: string }>(`SELECT id FROM menu_categories WHERE business_id = $1 AND lower(name) = lower($2)`, [actor.businessId, category.name])
      ).rows[0]?.id;
      if (!categoryId) {
        categoryId = (
          await db.query<{ id: string }>(
            `INSERT INTO menu_categories (business_id, name, station, sort)
             VALUES ($1, $2, $3, (SELECT COALESCE(max(sort), 0) + 10 FROM menu_categories WHERE business_id = $1)) RETURNING id`,
            [actor.businessId, category.name, station],
          )
        ).rows[0].id;
        counts.categories++;
      }
      for (const product of category.products) {
        const existing = (
          await db.query<{ id: string; price: string }>(
            `SELECT id, price FROM menu_products WHERE business_id = $1 AND category_id = $2 AND lower(name) = lower($3) FOR UPDATE`,
            [actor.businessId, categoryId, product.name],
          )
        ).rows[0];
        if (!existing) {
          await db.query(
            `INSERT INTO menu_products (business_id, category_id, name, price, station, sort)
             VALUES ($1, $2, $3, $4, (SELECT station FROM menu_categories WHERE id = $2),
                     (SELECT COALESCE(max(sort), 0) + 10 FROM menu_products WHERE category_id = $2))`,
            [actor.businessId, categoryId, product.name, product.price],
          );
          counts.products++;
        } else if (Number(existing.price) !== product.price) {
          await db.query(`UPDATE menu_products SET price = $2, is_active = TRUE WHERE id = $1`, [existing.id, product.price]);
          await audit(db, actor, {
            action: 'menu.price',
            entity: 'menu_product',
            entityId: existing.id,
            summary: `Cambió el precio de ${product.name}: de $${Number(existing.price).toLocaleString('es-CO')} a $${product.price.toLocaleString('es-CO')}`,
          });
          counts.prices++;
        } else counts.same++;
      }
    }
    await audit(db, actor, {
      action: 'menu.import',
      entity: 'business',
      entityId: actor.businessId,
      summary: `Importó la carta: ${counts.categories} categorías nuevas, ${counts.products} productos nuevos y ${counts.prices} precios cambiados`,
    });
    return counts;
  });
}
