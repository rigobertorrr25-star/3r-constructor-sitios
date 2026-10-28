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
