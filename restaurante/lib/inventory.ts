// Módulos 05 y 06: inventario por sede, recetas y control de botellas.
// La existencia de cada insumo es la suma de sus movimientos (compras, ventas, mermas, conteos). Nada se borra:
// un error se corrige con otro movimiento. Cada venta descuenta sola lo de la receta.
import { formatCop } from './format';
import { query, transaction, type Db } from './db';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export const UNITS = ['g', 'ml', 'und'] as const;
export type Unit = (typeof UNITS)[number];
export const UNIT_LABEL: Record<Unit, string> = { g: 'gramos', ml: 'mililitros', und: 'unidades' };

export const MOVEMENT_LABEL: Record<string, string> = {
  purchase: 'Compra',
  sale: 'Venta',
  void: 'Devuelto (anulación)',
  waste: 'Merma',
  count: 'Conteo',
  adjust: 'Ajuste',
};

const money = (n: number) => formatCop(n);
const qty = (n: number, unit: string) => `${Number(n.toFixed(3)).toLocaleString('es-CO')} ${unit}`;

function requireText(value: string, label: string, min: number, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

/** Cantidad con hasta 3 decimales ("1,5" o "1.5"). */
export function parseQuantity(value: string | number, label = 'Cantidad', { allowZero = false, allowNegative = false } = {}) {
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || Math.abs(n) > 10_000_000) throw new AppError('INVALID', `${label}: escribe un número.`);
  if (!allowNegative && n < 0) throw new AppError('INVALID', `${label}: no puede ser negativa.`);
  if (!allowZero && n === 0) throw new AppError('INVALID', `${label}: no puede ser cero.`);
  return Math.round(n * 1000) / 1000;
}

// ───────── insumos ─────────

export type InventoryItem = {
  id: string;
  name: string;
  unit: Unit;
  unitCost: number;
  minStock: number;
  bottleSize: number | null;
  isActive: boolean;
  stock: number;
};

type ItemRow = { id: string; name: string; unit: Unit; unitCost: string; minStock: string; bottleSize: string | null; isActive: boolean; stock: string };
const toItem = (r: ItemRow): InventoryItem => ({
  ...r,
  unitCost: Number(r.unitCost),
  minStock: Number(r.minStock),
  bottleSize: r.bottleSize === null ? null : Number(r.bottleSize),
  stock: Number(r.stock),
});

/** Insumos del negocio con su existencia en la sede de quien mira. */
export async function listItems(actor: Actor, { activeOnly = false } = {}): Promise<InventoryItem[]> {
  requirePermission(actor, 'inventory.view');
  const rows = await query<ItemRow>(
    `SELECT i.id, i.name, i.unit, i.unit_cost AS "unitCost", i.min_stock AS "minStock", i.bottle_size AS "bottleSize", i.is_active AS "isActive",
            COALESCE((SELECT sum(m.quantity) FROM inventory_movements m WHERE m.item_id = i.id AND m.location_id = $2), 0) AS stock
       FROM inventory_items i WHERE i.business_id = $1 ${activeOnly ? 'AND i.is_active' : ''} ORDER BY i.is_active DESC, i.name`,
    [actor.businessId, actor.locationId],
  );
  return rows.map(toItem);
}

export async function getItem(actor: Actor, itemId: string) {
  requirePermission(actor, 'inventory.view');
  if (!isUuid(itemId)) return null;
  const rows = await query<ItemRow>(
    `SELECT i.id, i.name, i.unit, i.unit_cost AS "unitCost", i.min_stock AS "minStock", i.bottle_size AS "bottleSize", i.is_active AS "isActive",
            COALESCE((SELECT sum(m.quantity) FROM inventory_movements m WHERE m.item_id = i.id AND m.location_id = $3), 0) AS stock
       FROM inventory_items i WHERE i.id = $1 AND i.business_id = $2`,
    [itemId, actor.businessId, actor.locationId],
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function saveItem(
  actor: Actor,
  input: { id?: string | null; name: string; unit: string; minStock: string | number; bottleSize?: string | number | null; unitCost?: string | number | null; isActive?: boolean },
) {
  requirePermission(actor, 'inventory.manage');
  const name = requireText(input.name, 'Nombre del insumo', 2, 80);
  if (!(UNITS as readonly string[]).includes(input.unit)) throw new AppError('INVALID', 'Elige la unidad: gramos, mililitros o unidades.');
  const minStock = parseQuantity(input.minStock || 0, 'Mínimo', { allowZero: true });
  const bottle = input.bottleSize === null || input.bottleSize === undefined || input.bottleSize === '' ? null : parseQuantity(input.bottleSize, 'Tamaño de la botella');
  if (bottle !== null && input.unit !== 'ml') throw new AppError('INVALID', 'Las botellas se manejan en mililitros.');
  const cost = input.unitCost === null || input.unitCost === undefined || input.unitCost === '' ? null : parseQuantity(input.unitCost, 'Costo', { allowZero: true });
  try {
    return await transaction(async (db) => {
      if (input.id) {
        if (!isUuid(input.id)) throw new AppError('NOT_FOUND', 'No encontramos ese insumo.');
        const res = await db.query(
          `UPDATE inventory_items SET name = $3, unit = $4, min_stock = $5, bottle_size = $6, unit_cost = COALESCE($7, unit_cost), is_active = $8
            WHERE id = $1 AND business_id = $2`,
          [input.id, actor.businessId, name, input.unit, minStock, bottle, cost, input.isActive ?? true],
        );
        if (!res.rowCount) throw new AppError('NOT_FOUND', 'No encontramos ese insumo.');
        await audit(db, actor, { action: 'inventory.item', entity: 'inventory_item', entityId: input.id, summary: `Cambió el insumo ${name}` });
        return input.id;
      }
      const res = await db.query<{ id: string }>(
        `INSERT INTO inventory_items (business_id, name, unit, min_stock, bottle_size, unit_cost) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [actor.businessId, name, input.unit, minStock, bottle, cost ?? 0],
      );
      await audit(db, actor, { action: 'inventory.item', entity: 'inventory_item', entityId: res.rows[0].id, summary: `Creó el insumo ${name} (${input.unit})` });
      return res.rows[0].id;
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new AppError('CONFLICT', `Ya hay un insumo ${name}.`);
    throw error;
  }
}

async function lockItem(db: Db, actor: Actor, itemId: string) {
  if (!isUuid(itemId)) throw new AppError('NOT_FOUND', 'No encontramos ese insumo.');
  const item = (
    await db.query<{ id: string; name: string; unit: Unit; unitCost: string; bottleSize: string | null; isActive: boolean }>(
      `SELECT id, name, unit, unit_cost AS "unitCost", bottle_size AS "bottleSize", is_active AS "isActive"
         FROM inventory_items WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [itemId, actor.businessId],
    )
  ).rows[0];
  if (!item) throw new AppError('NOT_FOUND', 'No encontramos ese insumo.');
  return item;
}

async function stockOf(db: Db, locationId: string, itemId: string) {
  const r = (await db.query<{ stock: string }>(`SELECT COALESCE(sum(quantity), 0) AS stock FROM inventory_movements WHERE location_id = $1 AND item_id = $2`, [locationId, itemId])).rows[0];
  return Number(r.stock);
}

async function insertMovement(
  db: Db,
  actor: Pick<Actor, 'businessId' | 'locationId'> & { id?: string },
  m: { itemId: string; kind: string; quantity: number; unitCost: number; reason?: string | null; orderItemId?: string | null; expected?: number; counted?: number },
) {
  await db.query(
    `INSERT INTO inventory_movements (business_id, location_id, item_id, kind, quantity, unit_cost, reason, order_item_id, expected, counted, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [actor.businessId, actor.locationId, m.itemId, m.kind, m.quantity, m.unitCost, m.reason ?? null, m.orderItemId ?? null, m.expected ?? null, m.counted ?? null, actor.id ?? null],
  );
}

/** Compra: entra mercancía. El costo del insumo pasa a ser el promedio ponderado. `total` es lo que se pagó por todo. */
export async function registerPurchase(actor: Actor, input: { itemId: string; quantity: string | number; total: string | number; reason?: string }) {
  requirePermission(actor, 'inventory.manage');
  const quantity = parseQuantity(input.quantity);
  const total = parseQuantity(input.total, 'Valor pagado', { allowZero: true });
  await transaction(async (db) => {
    const item = await lockItem(db, actor, input.itemId);
    const unitCost = total / quantity;
    // El promedio usa las existencias de todas las sedes: el costo es uno solo para el negocio.
    const all = Number(
      (await db.query<{ s: string }>(`SELECT COALESCE(sum(quantity), 0) AS s FROM inventory_movements WHERE item_id = $1`, [item.id])).rows[0].s,
    );
    const oldCost = Number(item.unitCost);
    const newCost = all > 0 ? (all * oldCost + quantity * unitCost) / (all + quantity) : unitCost;
    await insertMovement(db, actor, { itemId: item.id, kind: 'purchase', quantity, unitCost, reason: input.reason?.trim() || null });
    await db.query(`UPDATE inventory_items SET unit_cost = $2 WHERE id = $1`, [item.id, newCost]);
    await audit(db, actor, {
      action: 'inventory.purchase',
      entity: 'inventory_item',
      entityId: item.id,
      summary: `Compró ${qty(quantity, item.unit)} de ${item.name} por ${money(total)}`,
      reason: input.reason?.trim() || null,
    });
  });
}

/** Merma: se dañó, se cayó, se venció. Siempre con motivo. */
export async function registerWaste(actor: Actor, input: { itemId: string; quantity: string | number; reason: string }) {
  requirePermission(actor, 'inventory.waste');
  const quantity = parseQuantity(input.quantity);
  const reason = requireText(input.reason, 'Motivo', 3, 200);
  await transaction(async (db) => {
    const item = await lockItem(db, actor, input.itemId);
    await insertMovement(db, actor, { itemId: item.id, kind: 'waste', quantity: -quantity, unitCost: Number(item.unitCost), reason });
    await audit(db, actor, {
      action: 'inventory.waste',
      entity: 'inventory_item',
      entityId: item.id,
      summary: `Merma de ${qty(quantity, item.unit)} de ${item.name} (${money(quantity * Number(item.unitCost))})`,
      reason,
    });
  });
}

/**
 * Conteo físico: se escribe lo que hay de verdad y queda la diferencia contra lo que el sistema esperaba.
 * En botellas se cuenta en botellas (2,3 = dos llenas y un 30 % de otra). La diferencia negativa es una fuga.
 */
export async function registerCount(actor: Actor, input: { itemId: string; counted: string | number; inBottles?: boolean; reason?: string }) {
  requirePermission(actor, 'inventory.manage');
  return transaction(async (db) => {
    const item = await lockItem(db, actor, input.itemId);
    const raw = parseQuantity(input.counted, 'Lo contado', { allowZero: true });
    const bottle = item.bottleSize === null ? null : Number(item.bottleSize);
    if (input.inBottles && !bottle) throw new AppError('INVALID', 'Ese insumo no es una botella.');
    const counted = input.inBottles && bottle ? Math.round(raw * bottle * 1000) / 1000 : raw;
    const expected = await stockOf(db, actor.locationId, item.id);
    const diff = Math.round((counted - expected) * 1000) / 1000;
    await insertMovement(db, actor, { itemId: item.id, kind: 'count', quantity: diff, unitCost: Number(item.unitCost), reason: input.reason?.trim() || null, expected, counted });
    await audit(db, actor, {
      action: 'inventory.count',
      entity: 'inventory_item',
      entityId: item.id,
      summary:
        diff === 0
          ? `Contó ${item.name}: cuadra (${qty(counted, item.unit)})`
          : `Contó ${item.name}: debía haber ${qty(expected, item.unit)} y hay ${qty(counted, item.unit)} (${diff > 0 ? 'sobran' : 'faltan'} ${qty(Math.abs(diff), item.unit)}, ${money(Math.abs(diff) * Number(item.unitCost))})`,
      reason: input.reason?.trim() || null,
      data: { expected, counted, difference: diff },
    });
    return { expected, counted, difference: diff, unit: item.unit };
  });
}

export type Movement = {
  id: string;
  itemId: string;
  itemName: string;
  unit: Unit;
  kind: string;
  quantity: number;
  unitCost: number;
  reason: string | null;
  expected: number | null;
  counted: number | null;
  createdBy: string | null;
  createdAt: Date;
};

export async function listMovements(actor: Actor, options: { itemId?: string; kind?: string; limit?: number } = {}): Promise<Movement[]> {
  requirePermission(actor, 'inventory.view');
  const params: unknown[] = [actor.locationId, actor.businessId, Math.min(options.limit ?? 100, 500)];
  let where = 'm.location_id = $1 AND m.business_id = $2';
  if (options.itemId && isUuid(options.itemId)) {
    params.push(options.itemId);
    where += ` AND m.item_id = $${params.length}`;
  }
  if (options.kind) {
    params.push(options.kind);
    where += ` AND m.kind = $${params.length}`;
  }
  const rows = await query<Omit<Movement, 'quantity' | 'unitCost' | 'expected' | 'counted'> & { quantity: string; unitCost: string; expected: string | null; counted: string | null }>(
    `SELECT m.id, m.item_id AS "itemId", i.name AS "itemName", i.unit, m.kind, m.quantity, m.unit_cost AS "unitCost", m.reason, m.expected, m.counted,
            s.name AS "createdBy", m.created_at AS "createdAt"
       FROM inventory_movements m JOIN inventory_items i ON i.id = m.item_id LEFT JOIN staff s ON s.id = m.created_by
      WHERE ${where} ORDER BY m.created_at DESC LIMIT $3`,
    params,
  );
  return rows.map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    unitCost: Number(r.unitCost),
    expected: r.expected === null ? null : Number(r.expected),
    counted: r.counted === null ? null : Number(r.counted),
  }));
}

// ───────── recetas ─────────

export type RecipeLine = { itemId: string; name: string; unit: Unit; quantity: number; unitCost: number };

export async function getRecipe(actor: Actor, productId: string): Promise<RecipeLine[]> {
  requirePermission(actor, 'inventory.view');
  if (!isUuid(productId)) return [];
  const rows = await query<{ itemId: string; name: string; unit: Unit; quantity: string; unitCost: string }>(
    `SELECT r.item_id AS "itemId", i.name, i.unit, r.quantity, i.unit_cost AS "unitCost"
       FROM recipe_lines r JOIN inventory_items i ON i.id = r.item_id JOIN menu_products p ON p.id = r.product_id
      WHERE r.product_id = $1 AND p.business_id = $2 ORDER BY i.name`,
    [productId, actor.businessId],
  );
  return rows.map((r) => ({ ...r, quantity: Number(r.quantity), unitCost: Number(r.unitCost) }));
}

/** Reemplaza la receta de un producto (lista de insumo + cantidad por unidad vendida). */
export async function saveRecipe(actor: Actor, productId: string, lines: { itemId: string; quantity: string | number }[]) {
  requirePermission(actor, 'inventory.manage');
  if (!isUuid(productId)) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
  const clean = lines
    .filter((l) => l.itemId && String(l.quantity).trim() !== '')
    .map((l) => {
      if (!isUuid(l.itemId)) throw new AppError('INVALID', 'Hay un insumo que no existe.');
      return { itemId: l.itemId, quantity: parseQuantity(l.quantity) };
    });
  if (new Set(clean.map((l) => l.itemId)).size !== clean.length) throw new AppError('INVALID', 'Un insumo aparece dos veces en la receta.');
  await transaction(async (db) => {
    const product = (await db.query<{ name: string }>(`SELECT name FROM menu_products WHERE id = $1 AND business_id = $2`, [productId, actor.businessId])).rows[0];
    if (!product) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
    if (clean.length) {
      const ok = await db.query(`SELECT id FROM inventory_items WHERE id = ANY($1::uuid[]) AND business_id = $2`, [clean.map((l) => l.itemId), actor.businessId]);
      if (ok.rowCount !== clean.length) throw new AppError('INVALID', 'Hay un insumo que no existe.');
    }
    await db.query(`DELETE FROM recipe_lines WHERE product_id = $1`, [productId]);
    for (const l of clean) await db.query(`INSERT INTO recipe_lines (product_id, item_id, quantity) VALUES ($1, $2, $3)`, [productId, l.itemId, l.quantity]);
    await audit(db, actor, {
      action: 'inventory.recipe',
      entity: 'menu_product',
      entityId: productId,
      summary: clean.length ? `Cambió la receta de ${product.name} (${clean.length} insumos)` : `Quitó la receta de ${product.name}`,
    });
  });
}

/** Costo de los insumos de cada producto según su receta (para ver el margen en la carta). */
export async function productCosts(businessId: string) {
  const rows = await query<{ productId: string; cost: string }>(
    `SELECT r.product_id AS "productId", sum(r.quantity * i.unit_cost) AS cost
       FROM recipe_lines r JOIN inventory_items i ON i.id = r.item_id WHERE i.business_id = $1 GROUP BY r.product_id`,
    [businessId],
  );
  return new Map(rows.map((r) => [r.productId, Number(r.cost)]));
}

// ───────── lo que llaman los pedidos ─────────

/** Descuenta los insumos de lo enviado en una ronda (va dentro de la misma transacción del pedido). */
export async function consumeForRound(db: Db, actor: Actor, roundId: string) {
  const lines = (
    await db.query<{ orderItemId: string; itemId: string; quantity: string; unitCost: string }>(
      `SELECT oi.id AS "orderItemId", r.item_id AS "itemId", r.quantity * oi.quantity AS quantity, i.unit_cost AS "unitCost"
         FROM order_items oi JOIN recipe_lines r ON r.product_id = oi.product_id JOIN inventory_items i ON i.id = r.item_id
        WHERE oi.round_id = $1`,
      [roundId],
    )
  ).rows;
  for (const l of lines) {
    await insertMovement(db, actor, { itemId: l.itemId, kind: 'sale', quantity: -Number(l.quantity), unitCost: Number(l.unitCost), orderItemId: l.orderItemId });
  }
}

/**
 * Al anular algo que la cocina todavía no empezó, sus insumos vuelven al inventario.
 * Si ya se estaba preparando o estaba listo, se quedan gastados (es merma real).
 */
export async function returnForVoid(db: Db, actor: Actor, orderItemId: string) {
  const lines = (
    await db.query<{ itemId: string; quantity: string; unitCost: string }>(
      `SELECT item_id AS "itemId", -quantity AS quantity, unit_cost AS "unitCost" FROM inventory_movements WHERE order_item_id = $1 AND kind = 'sale'`,
      [orderItemId],
    )
  ).rows;
  for (const l of lines) {
    await insertMovement(db, actor, { itemId: l.itemId, kind: 'void', quantity: Number(l.quantity), unitCost: Number(l.unitCost), orderItemId, reason: 'Anulado antes de prepararse' });
  }
  return lines.length;
}

/** Insumos por debajo del mínimo en la sede (para alertas y el tablero). */
export async function lowStock(actor: Pick<Actor, 'businessId' | 'locationId'>) {
  const rows = await query<{ id: string; name: string; unit: Unit; stock: string; minStock: string }>(
    `SELECT i.id, i.name, i.unit, i.min_stock AS "minStock",
            COALESCE((SELECT sum(m.quantity) FROM inventory_movements m WHERE m.item_id = i.id AND m.location_id = $2), 0) AS stock
       FROM inventory_items i WHERE i.business_id = $1 AND i.is_active AND i.min_stock > 0`,
    [actor.businessId, actor.locationId],
  );
  return rows.map((r) => ({ ...r, stock: Number(r.stock), minStock: Number(r.minStock) })).filter((r) => r.stock < r.minStock);
}
