// Cierre de caja completo (27 oct 2026, pedido de Rigoberto: «cuando la cajera haga el cierre, que le dé para imprimir
// todo: venta, propina, inventario de lo que queda, lo que falta y lo que se necesita comprar para el día siguiente»).
// Además del cuadre de plata: la propina del día (el % de Sedes → «Propina sugerida» sobre lo vendido, como en el Tablero)
// y cómo queda el inventario de la sede. «Por comprar» es lo que quedó por debajo del mínimo, hasta llegar al mínimo.
import { query } from './db';
import type { Area } from './inventory';
import type { Actor } from './store';
import { UNIT_SHORT, type Unit } from './units';

export type StockLine = { name: string; area: Area; unit: Unit; bottleSize: number | null; stock: number; minStock: number };
export type BuyLine = StockLine & { buy: number };
export type ClosingInventory = {
  /** Lo que hay (más de cero), por área y nombre. */
  remaining: StockLine[];
  /** Lo que quedó en cero o menos. */
  out: StockLine[];
  /** Lo que quedó por debajo del mínimo y cuánto comprar para llegar a él. */
  toBuy: BuyLine[];
  /** Si ningún insumo tiene mínimo, la lista de compras no puede salir: se avisa. */
  hasMinimums: boolean;
};

const byAreaAndName = (a: StockLine, b: StockLine) => (a.area === b.area ? a.name.localeCompare(b.name, 'es') : a.area === 'bar' ? -1 : 1);

/** Arma las listas del cierre con los insumos activos de la sede y lo que hay de cada uno. */
export function buildClosingInventory(items: StockLine[]): ClosingInventory {
  const sorted = [...items].sort(byAreaAndName);
  return {
    remaining: sorted.filter((i) => i.stock > 0),
    out: sorted.filter((i) => i.stock <= 0),
    toBuy: sorted.filter((i) => i.minStock > 0 && i.stock < i.minStock).map((i) => ({ ...i, buy: i.minStock - Math.max(0, i.stock) })),
    hasMinimums: items.some((i) => i.minStock > 0),
  };
}

/** El inventario de la sede al cerrar la caja. Sin revisar permisos: la cajera no ve Inventario, pero el cierre sí lo trae. */
export async function closingInventory(actor: Pick<Actor, 'businessId' | 'locationId'>): Promise<ClosingInventory> {
  const rows = await query<{ name: string; area: Area; unit: Unit; bottleSize: string | null; stock: string; minStock: string }>(
    `SELECT i.name, i.area, i.unit, i.bottle_size AS "bottleSize", i.min_stock AS "minStock",
            COALESCE((SELECT sum(m.quantity) FROM inventory_movements m WHERE m.item_id = i.id AND m.location_id = $2), 0) AS stock
       FROM inventory_items i WHERE i.business_id = $1 AND i.is_active`,
    [actor.businessId, actor.locationId],
  );
  return buildClosingInventory(
    rows.map((r) => ({ ...r, bottleSize: r.bottleSize === null ? null : Number(r.bottleSize), stock: Number(r.stock), minStock: Number(r.minStock) })),
  );
}

const n = (v: number, digits: number) => Number(v.toFixed(digits)).toLocaleString('es-CO');

/** Cantidad corta para el papel: botellas en botellas, gramos en kg y mililitros en L cuando pasan de mil. */
export function shortQuantity(value: number, unit: Unit, bottleSize: number | null) {
  if (bottleSize) return `${n(value / bottleSize, 1)} bot.`;
  if (unit === 'g' && Math.abs(value) >= 1000) return `${n(value / 1000, 2)} kg`;
  if (unit === 'ml' && Math.abs(value) >= 1000) return `${n(value / 1000, 2)} L`;
  return `${n(value, 1)} ${UNIT_SHORT[unit]}`;
}

/** La propina del día: el % de «Propina sugerida» sobre lo vendido (igual que la tarjeta del Tablero). */
export const tipOfSales = (sales: number, pct: number) => Math.round((sales * pct) / 100);

// ───────── ventas por categoría y observaciones (28 oct 2026) ─────────
// Pedido de Rigoberto: «otro informe que muestre qué se vendió por categoría (en cocina 5 almuerzos, 2 empanadas, en
// cafetería…), y al final un espacio para observaciones de lo que pasó: se cayó un vaso, se devolvió una comida».
// Lo vendido es lo de las cuentas cobradas en el turno (como «Ventas» del cierre), antes de descuentos. Lo que pasó
// sale solo del sistema (anulaciones, descuentos, mesas cerradas sin cobrar) más lo que la cajera escriba al cerrar.

export type CategorySales = { category: string; products: { name: string; quantity: number; total: number }[]; quantity: number; total: number };
export type ShiftIncidents = {
  voids: { name: string; quantity: number; table: string; by: string; reason: string }[];
  discounts: { table: string; amount: number; by: string; reason: string }[];
  closedUnpaid: { summary: string; by: string; reason: string }[];
};

/** Agrupa lo vendido por categoría (en el orden de la carta) y dentro de cada una, lo más vendido primero. */
export function groupByCategory(rows: { category: string; name: string; quantity: number; total: number }[]): CategorySales[] {
  const out: CategorySales[] = [];
  for (const r of rows) {
    let c = out.find((x) => x.category === r.category);
    if (!c) out.push((c = { category: r.category, products: [], quantity: 0, total: 0 }));
    c.products.push({ name: r.name, quantity: r.quantity, total: r.total });
    c.quantity += r.quantity;
    c.total += r.total;
  }
  for (const c of out) c.products.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'es'));
  return out;
}

/** Lo vendido en las cuentas cobradas en este turno de caja, por categoría. */
export async function shiftSalesByCategory(actor: Pick<Actor, 'businessId' | 'locationId'>, shiftId: string): Promise<CategorySales[]> {
  const rows = await query<{ category: string; name: string; quantity: string; total: string }>(
    `SELECT c.name AS category, i.name, sum(i.quantity) AS quantity, sum(i.quantity * i.unit_price) AS total
       FROM order_items i JOIN menu_products p ON p.id = i.product_id JOIN menu_categories c ON c.id = p.category_id
      WHERE i.business_id = $1 AND i.voided_at IS NULL
        AND i.session_id IN (SELECT session_id FROM payments WHERE shift_id = $2 AND location_id = $3 AND reversed_at IS NULL)
      GROUP BY c.name, c.sort, i.name ORDER BY c.sort, c.name`,
    [actor.businessId, shiftId, actor.locationId],
  );
  return groupByCategory(rows.map((r) => ({ ...r, quantity: Number(r.quantity), total: Number(r.total) })));
}

/** Lo que el sistema sabe que pasó en la sede mientras la caja estuvo abierta. */
export async function shiftIncidents(actor: Pick<Actor, 'businessId' | 'locationId'>, from: Date, to: Date | null): Promise<ShiftIncidents> {
  const p = [actor.businessId, actor.locationId, from, to ?? new Date()];
  const [voids, discounts, closedUnpaid] = await Promise.all([
    query<{ name: string; quantity: number; table: string; by: string | null; reason: string | null }>(
      `SELECT i.name, i.quantity, t.number AS "table", s.name AS "by", i.void_reason AS reason
         FROM order_items i JOIN table_sessions ts ON ts.id = i.session_id JOIN dining_tables t ON t.id = ts.table_id LEFT JOIN staff s ON s.id = i.voided_by
        WHERE i.business_id = $1 AND ts.location_id = $2 AND i.voided_at >= $3 AND i.voided_at <= $4 ORDER BY i.voided_at`,
      p,
    ),
    query<{ table: string; amount: string; by: string | null; reason: string }>(
      `SELECT t.number AS "table", d.amount, s.name AS "by", d.reason
         FROM session_discounts d JOIN table_sessions ts ON ts.id = d.session_id JOIN dining_tables t ON t.id = ts.table_id LEFT JOIN staff s ON s.id = d.applied_by
        WHERE d.business_id = $1 AND ts.location_id = $2 AND d.voided_at IS NULL AND d.applied_at >= $3 AND d.applied_at <= $4 ORDER BY d.applied_at`,
      p,
    ),
    query<{ summary: string; by: string | null; reason: string | null }>(
      `SELECT summary, actor_name AS "by", reason FROM audit_events
        WHERE business_id = $1 AND location_id = $2 AND action = 'table.close' AND reason IS NOT NULL AND created_at >= $3 AND created_at <= $4 ORDER BY created_at`,
      p,
    ),
  ]);
  return {
    voids: voids.map((v) => ({ ...v, by: v.by ?? '', reason: v.reason ?? '' })),
    discounts: discounts.map((d) => ({ ...d, amount: Number(d.amount), by: d.by ?? '', reason: d.reason })),
    closedUnpaid: closedUnpaid.map((c) => ({ summary: c.summary, by: c.by ?? '', reason: c.reason ?? '' })),
  };
}
