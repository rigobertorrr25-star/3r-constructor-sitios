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

// ───────── formulario diario de operaciones (28 oct 2026) ─────────
// El formulario que usa Rigoberto («Formulaire quotidien / Formulario diario»): 1. ventas del día, 2. salidas de dinero
// con factura, 3. salidas sin factura, 4. facturas por pagar, 5. pérdidas del día, y los totales: ventas, salidas,
// pérdidas, en caja, sobre de la cocina, sobre del bar y caja fuerte. Todo sale del turno de caja (de la apertura al cierre).

export type OutWithInvoice = { description: string; invoiceNumber: string; amount: number; from: string };
export type OutWithoutInvoice = { description: string; reason: string; amount: number; from: string };
export type ToPay = { supplier: string; description: string; amount: number; dueOn: string | null };
export type LossLine = { description: string; amount: number };
export type DailyForm = {
  withInvoice: OutWithInvoice[];
  withoutInvoice: OutWithoutInvoice[];
  toPay: ToPay[];
  losses: LossLine[];
};

const FROM_LABEL: Record<string, string> = { cash: 'Caja', safe: 'Caja fuerte', kitchen: 'Sobre cocina', bar: 'Sobre bar', other: 'Otro' };
const CATEGORY_LABEL: Record<string, string> = {
  rent: 'Arriendo',
  payroll: 'Nómina',
  utilities: 'Servicios públicos',
  suppliers: 'Proveedores',
  packaging: 'Bolsas y empaques',
  maintenance: 'Mantenimiento',
  marketing: 'Publicidad',
  taxes: 'Impuestos',
  other: 'Otros',
};

/** Las partes 2 a 5 del formulario para la sede, entre la apertura y el cierre de la caja. */
export async function dailyForm(actor: Pick<Actor, 'businessId' | 'locationId'>, shiftId: string, from: Date, to: Date | null): Promise<DailyForm> {
  const p = [actor.businessId, actor.locationId, from, to ?? new Date()];
  const [expenses, movements, pending, losses, waste] = await Promise.all([
    // Facturas y gastos pagados en el turno (lo que se pagó después de registrado cuenta cuando se pagó).
    query<{ description: string; supplier: string | null; invoiceNumber: string | null; amount: string; paidFrom: string; category: string; hasPhoto: boolean }>(
      `SELECT e.description, e.supplier, e.invoice_number AS "invoiceNumber", e.amount, e.paid_from AS "paidFrom", e.category,
              EXISTS (SELECT 1 FROM expense_photos f WHERE f.expense_id = e.id) AS "hasPhoto"
         FROM expenses e
        WHERE e.business_id = $1 AND e.location_id = $2 AND e.voided_at IS NULL AND e.paid_from IS NOT NULL
          AND COALESCE(e.paid_at, e.created_at) >= $3 AND COALESCE(e.paid_at, e.created_at) <= $4
        ORDER BY COALESCE(e.paid_at, e.created_at)`,
      p,
    ),
    // Salidas de efectivo de la caja que no son el pago de una factura registrada.
    query<{ reason: string; amount: string }>(
      `SELECT m.reason, m.amount FROM cash_movements m
        WHERE m.shift_id = $1 AND m.kind = 'out' AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.cash_movement_id = m.id)
        ORDER BY m.created_at`,
      [shiftId],
    ),
    query<{ supplier: string | null; description: string; amount: string; dueOn: string | null }>(
      `SELECT e.supplier, e.description, e.amount, to_char(e.due_on, 'YYYY-MM-DD') AS "dueOn" FROM expenses e
        WHERE e.business_id = $1 AND e.location_id = $2 AND e.paid_from IS NULL AND e.voided_at IS NULL ORDER BY e.due_on NULLS LAST, e.spent_on`,
      [actor.businessId, actor.locationId],
    ),
    query<{ description: string; amount: string }>(
      `SELECT description, amount FROM losses WHERE business_id = $1 AND location_id = $2 AND voided_at IS NULL AND created_at >= $3 AND created_at <= $4 ORDER BY created_at`,
      p,
    ),
    // Las mermas del inventario también son pérdidas (al costo del insumo).
    query<{ name: string; reason: string | null; value: string }>(
      `SELECT i.name, m.reason, -m.quantity * m.unit_cost AS value FROM inventory_movements m JOIN inventory_items i ON i.id = m.item_id
        WHERE m.business_id = $1 AND m.location_id = $2 AND m.kind = 'waste' AND m.created_at >= $3 AND m.created_at <= $4 ORDER BY m.created_at`,
      p,
    ),
  ]);
  const withInvoice: OutWithInvoice[] = [];
  const withoutInvoice: OutWithoutInvoice[] = [];
  for (const e of expenses) {
    const description = e.supplier ? `${e.supplier}: ${e.description}` : e.description;
    if (e.invoiceNumber || e.hasPhoto) withInvoice.push({ description, invoiceNumber: e.invoiceNumber ?? 'con foto', amount: Number(e.amount), from: FROM_LABEL[e.paidFrom] ?? e.paidFrom });
    else withoutInvoice.push({ description, reason: CATEGORY_LABEL[e.category] ?? e.category, amount: Number(e.amount), from: FROM_LABEL[e.paidFrom] ?? e.paidFrom });
  }
  for (const m of movements) withoutInvoice.push({ description: m.reason, reason: 'Salida de efectivo', amount: Number(m.amount), from: 'Caja' });
  return {
    withInvoice,
    withoutInvoice,
    toPay: pending.map((e) => ({ supplier: e.supplier ?? '', description: e.description, amount: Number(e.amount), dueOn: e.dueOn })),
    losses: [
      ...losses.map((l) => ({ description: l.description, amount: Number(l.amount) })),
      ...waste.map((w) => ({ description: `Merma de ${w.name}${w.reason ? ` (${w.reason})` : ''}`, amount: Math.round(Number(w.value)) })),
    ],
  };
}

export const sumAmounts = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);
