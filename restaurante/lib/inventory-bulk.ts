// Inventario masivo: armarlo de una vez desde la carta y cargar las existencias de todos los insumos en una sola pantalla.
// Pensado para bares como DELIRIUM, donde cada producto de la carta es una botella o una lata: el insumo se llama igual
// que el producto, se cuenta en unidades y cada venta descuenta 1.
import { query, transaction } from './db';
import { parseQuantity } from './inventory';
import { can } from './permissions';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

/** Categorías de la carta con cuántos productos les falta inventario (sin receta). */
export async function menuForInventory(actor: Actor) {
  requirePermission(actor, 'inventory.load');
  return query<{ id: string; name: string; products: number; withoutRecipe: number }>(
    `SELECT c.id, c.name, count(p.id)::int AS products,
            count(p.id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM recipe_lines r WHERE r.product_id = p.id))::int AS "withoutRecipe"
       FROM menu_categories c JOIN menu_products p ON p.category_id = c.id AND p.is_active
      WHERE c.business_id = $1 AND c.is_active
      GROUP BY c.id, c.name, c.sort ORDER BY c.sort, c.name`,
    [actor.businessId],
  );
}

/**
 * Crea un insumo por cada producto (de las categorías elegidas) que todavía no tiene receta: mismo nombre, en unidades,
 * y la receta «1 unidad». Si ya hay un insumo con ese nombre en unidades, lo usa. Los que ya tienen receta no se tocan.
 */
export async function inventoryFromMenu(actor: Actor, categoryIds: string[]) {
  requirePermission(actor, 'inventory.load');
  const ids = [...new Set(categoryIds)].filter(isUuid);
  if (!ids.length) throw new AppError('INVALID', 'Marca al menos una categoría de la carta.');
  return transaction(async (db) => {
    const products = (
      await db.query<{ id: string; name: string; station: string }>(
        `SELECT p.id, p.name, p.station FROM menu_products p JOIN menu_categories c ON c.id = p.category_id
          WHERE p.business_id = $1 AND p.category_id = ANY($2::uuid[]) AND p.is_active AND c.is_active
            AND NOT EXISTS (SELECT 1 FROM recipe_lines r WHERE r.product_id = p.id)
          ORDER BY c.sort, p.sort, p.name`,
        [actor.businessId, ids],
      )
    ).rows;
    let created = 0;
    let linked = 0;
    const skipped: string[] = [];
    for (const p of products) {
      const existing = (
        await db.query<{ id: string; unit: string }>(`SELECT id, unit FROM inventory_items WHERE business_id = $1 AND lower(name) = lower($2)`, [actor.businessId, p.name])
      ).rows[0];
      let itemId: string;
      if (existing) {
        // Un insumo con el mismo nombre pero en ml o g no es «una unidad»: mejor no adivinar la receta.
        if (existing.unit !== 'und') {
          skipped.push(p.name);
          continue;
        }
        itemId = existing.id;
        await db.query(`UPDATE inventory_items SET is_active = TRUE WHERE id = $1`, [itemId]);
      } else {
        itemId = (
          // El insumo queda en el área de la estación del producto (barra o cocina).
          await db.query<{ id: string }>(`INSERT INTO inventory_items (business_id, name, unit, area) VALUES ($1, $2, 'und', $3) RETURNING id`, [
            actor.businessId,
            p.name.slice(0, 80),
            p.station === 'bar' ? 'bar' : 'kitchen',
          ])
        ).rows[0].id;
        created++;
      }
      await db.query(`INSERT INTO recipe_lines (product_id, item_id, quantity) VALUES ($1, $2, 1)`, [p.id, itemId]);
      linked++;
    }
    await audit(db, actor, {
      action: 'inventory.bulk',
      entity: 'business',
      entityId: actor.businessId,
      summary: `Armó el inventario desde la carta: ${created} insumos nuevos, ${linked} productos descuentan 1 unidad por venta`,
    });
    return { created, linked, skipped };
  });
}

/** Cuánto vale «una» en la unidad en que se cuenta: unidades, botellas, kilos o litros. */
export const countFactor = (item: { unit: string; bottleSize: number | null }) => item.bottleSize ?? (item.unit === 'und' ? 1 : 1000);

export type StockRow = { itemId: string; counted?: string; unitCost?: string; minStock?: string };

/**
 * Carga de existencias de muchos insumos a la vez. Por cada fila, solo lo que se escribió:
 * - lo que hay (queda como un conteo: la diferencia contra lo que el sistema esperaba),
 * - el costo de una (unidad, botella, kilo o litro),
 * - el mínimo para que avise.
 * Todo en la unidad en que se cuenta (unidades, botellas, kg o L).
 */
export async function bulkStock(actor: Actor, rows: StockRow[], reason = 'Carga de inventario') {
  requirePermission(actor, 'inventory.load');
  // El bartender carga cantidades y mínimos; los costos (plata) solo el dueño y el administrador.
  if (!can(actor.role, 'inventory.manage') && rows.some((r) => r.unitCost !== undefined && String(r.unitCost).trim() !== ''))
    throw new AppError('FORBIDDEN', 'Los costos solo los cambia el dueño o el administrador.');
  const filled = rows.filter((r) => [r.counted, r.unitCost, r.minStock].some((v) => v !== undefined && String(v).trim() !== ''));
  if (!filled.length) throw new AppError('INVALID', 'Escribe al menos una cantidad, un costo o un mínimo.');
  if (filled.length > 500) throw new AppError('INVALID', 'Son demasiados insumos de una vez (hasta 500).');
  return transaction(async (db) => {
    let counted = 0;
    let costs = 0;
    let mins = 0;
    for (const r of filled) {
      if (!isUuid(r.itemId)) throw new AppError('NOT_FOUND', 'Hay un insumo que no existe.');
      const item = (
        await db.query<{ id: string; name: string; unit: string; unitCost: string; bottleSize: string | null }>(
          `SELECT id, name, unit, unit_cost AS "unitCost", bottle_size AS "bottleSize" FROM inventory_items WHERE id = $1 AND business_id = $2 FOR UPDATE`,
          [r.itemId, actor.businessId],
        )
      ).rows[0];
      if (!item) throw new AppError('NOT_FOUND', 'Hay un insumo que no existe.');
      const f = countFactor({ unit: item.unit, bottleSize: item.bottleSize === null ? null : Number(item.bottleSize) });
      const label = (field: string) => `${item.name} (${field})`;
      let unitCost = Number(item.unitCost);
      if (r.unitCost !== undefined && String(r.unitCost).trim() !== '') {
        unitCost = parseQuantity(String(r.unitCost).replace(/[$\s.]/g, ''), label('costo'), { allowZero: true }) / f;
        await db.query(`UPDATE inventory_items SET unit_cost = $2 WHERE id = $1`, [item.id, unitCost]);
        costs++;
      }
      if (r.minStock !== undefined && String(r.minStock).trim() !== '') {
        const min = parseQuantity(r.minStock, label('mínimo'), { allowZero: true }) * f;
        await db.query(`UPDATE inventory_items SET min_stock = $2 WHERE id = $1`, [item.id, min]);
        mins++;
      }
      if (r.counted !== undefined && String(r.counted).trim() !== '') {
        const value = Math.round(parseQuantity(r.counted, label('cantidad'), { allowZero: true }) * f * 1000) / 1000;
        const expected = Number(
          (await db.query<{ s: string }>(`SELECT COALESCE(sum(quantity), 0) AS s FROM inventory_movements WHERE location_id = $1 AND item_id = $2`, [actor.locationId, item.id]))
            .rows[0].s,
        );
        const diff = Math.round((value - expected) * 1000) / 1000;
        await db.query(
          `INSERT INTO inventory_movements (business_id, location_id, item_id, kind, quantity, unit_cost, reason, expected, counted, created_by)
           VALUES ($1, $2, $3, 'count', $4, $5, $6, $7, $8, $9)`,
          [actor.businessId, actor.locationId, item.id, diff, unitCost, reason, expected, value, actor.id],
        );
        counted++;
      }
    }
    await audit(db, actor, {
      action: 'inventory.bulk',
      entity: 'location',
      entityId: actor.locationId,
      summary: `Cargó el inventario de una vez: ${counted} cantidades, ${costs} costos y ${mins} mínimos`,
    });
    return { counted, costs, mins };
  });
}
