// Módulo 07: gastos y estado de resultados (lo que entró, lo que costó y lo que quedó).
// Las fechas son días del negocio (hora de Colombia por defecto), no del servidor.
import { formatCop } from './format';
import { query, transaction } from './db';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export const EXPENSE_CATEGORIES = ['rent', 'payroll', 'utilities', 'suppliers', 'maintenance', 'marketing', 'taxes', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  rent: 'Arriendo',
  payroll: 'Nómina',
  utilities: 'Servicios públicos',
  suppliers: 'Proveedores',
  maintenance: 'Mantenimiento',
  marketing: 'Publicidad',
  taxes: 'Impuestos',
  other: 'Otros',
};

const money = (n: number) => formatCop(n);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireText(value: string, label: string, min: number, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

/** Hoy en la zona horaria del negocio, como AAAA-MM-DD. */
export function todayIn(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Primer día del mes de una fecha AAAA-MM-DD. */
export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

export { addDays } from './periods';

function checkRange(from: string, to: string) {
  if (!DATE.test(from) || !DATE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw new AppError('INVALID', 'Fechas no válidas.');
  if (from > to) throw new AppError('INVALID', 'La fecha inicial va antes de la final.');
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 400) throw new AppError('INVALID', 'Elige un periodo de máximo un año.');
}

/** El dueño puede ver una sede o todas (null); el administrador, solo la suya. */
function scopeOf(actor: Actor, locationId: string | null | undefined) {
  if (actor.role !== 'owner') return actor.locationId;
  if (locationId === 'all' || locationId === null) return null;
  return locationId && isUuid(locationId) ? locationId : actor.locationId;
}

// ───────── gastos ─────────

export type Expense = {
  id: string;
  category: ExpenseCategory;
  description: string;
  supplier: string | null;
  amount: number;
  spentOn: string;
  paidFromCash: boolean;
  createdBy: string;
  locationName: string;
  voided: boolean;
  voidReason: string | null;
};

export async function addExpense(
  actor: Actor,
  input: { category: string; description: string; supplier?: string; amount: number; spentOn: string; paidFromCash?: boolean },
) {
  requirePermission(actor, 'finance.view');
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) throw new AppError('INVALID', 'Elige el tipo de gasto.');
  const description = requireText(input.description, 'Descripción', 3, 200);
  const supplier = input.supplier?.trim() ? requireText(input.supplier, 'Proveedor', 2, 120) : null;
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 10_000_000_000) throw new AppError('INVALID', 'Valor: escribe el valor en pesos.');
  if (!DATE.test(input.spentOn)) throw new AppError('INVALID', 'Fecha no válida.');
  return transaction(async (db) => {
    let movementId: string | null = null;
    if (input.paidFromCash) {
      // Pagado con la plata de la caja: sale de la caja abierta (y se revisa que alcance).
      const shift = (
        await db.query<{ id: string; opening: string }>(
          `SELECT id, opening_amount AS opening FROM cash_shifts WHERE location_id = $1 AND business_id = $2 AND closed_at IS NULL FOR UPDATE`,
          [actor.locationId, actor.businessId],
        )
      ).rows[0];
      if (!shift) throw new AppError('CONFLICT', 'La caja está cerrada: no se puede pagar con su plata.');
      const cash = Number(
        (
          await db.query<{ cash: string }>(
            `SELECT $2::bigint
                  + (SELECT COALESCE(sum(amount + tip), 0) FROM payments WHERE shift_id = $1 AND method = 'cash' AND reversed_at IS NULL)
                  + (SELECT COALESCE(sum(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) FROM cash_movements WHERE shift_id = $1) AS cash`,
            [shift.id, shift.opening],
          )
        ).rows[0].cash,
      );
      if (input.amount > cash) throw new AppError('CONFLICT', `En caja debería haber ${money(cash)}: no alcanza para ${money(input.amount)}.`);
      movementId = (
        await db.query<{ id: string }>(
          `INSERT INTO cash_movements (business_id, shift_id, kind, amount, reason, created_by) VALUES ($1, $2, 'out', $3, $4, $5) RETURNING id`,
          [actor.businessId, shift.id, input.amount, `Gasto: ${description}`.slice(0, 200), actor.id],
        )
      ).rows[0].id;
    }
    const res = await db.query<{ id: string }>(
      `INSERT INTO expenses (business_id, location_id, category, description, supplier, amount, spent_on, paid_from_cash, cash_movement_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [actor.businessId, actor.locationId, input.category, description, supplier, input.amount, input.spentOn, Boolean(input.paidFromCash), movementId, actor.id],
    );
    await audit(db, actor, {
      action: 'expense.create',
      entity: 'expense',
      entityId: res.rows[0].id,
      summary: `Registró un gasto de ${money(input.amount)} (${EXPENSE_LABEL[input.category as ExpenseCategory]}): ${description}${input.paidFromCash ? ', pagado de la caja' : ''}`,
    });
    return res.rows[0].id;
  });
}

/** Anula un gasto mal registrado. Si salió de la caja, la plata se devuelve a la caja con una entrada. */
export async function voidExpense(actor: Actor, expenseId: string, reason: string) {
  requirePermission(actor, 'finance.view');
  const why = requireText(reason, 'Motivo', 3, 200);
  if (!isUuid(expenseId)) throw new AppError('NOT_FOUND', 'No encontramos ese gasto.');
  await transaction(async (db) => {
    const e = (
      await db.query<{ id: string; amount: string; description: string; voided: boolean; locationId: string; movementId: string | null }>(
        `SELECT id, amount, description, (voided_at IS NOT NULL) AS voided, location_id AS "locationId", cash_movement_id AS "movementId"
           FROM expenses WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [expenseId, actor.businessId],
      )
    ).rows[0];
    if (!e || (actor.role !== 'owner' && e.locationId !== actor.locationId)) throw new AppError('NOT_FOUND', 'No encontramos ese gasto.');
    if (e.voided) throw new AppError('CONFLICT', 'Ese gasto ya estaba anulado.');
    if (e.movementId) {
      const shift = (
        await db.query<{ id: string; closed: boolean }>(
          `SELECT c.id, (c.closed_at IS NOT NULL) AS closed FROM cash_movements m JOIN cash_shifts c ON c.id = m.shift_id WHERE m.id = $1`,
          [e.movementId],
        )
      ).rows[0];
      if (shift.closed) throw new AppError('CONFLICT', 'Ese gasto salió de una caja que ya se cerró: registra una entrada en la caja actual si devolvieron la plata.');
      await db.query(`INSERT INTO cash_movements (business_id, shift_id, kind, amount, reason, created_by) VALUES ($1, $2, 'in', $3, $4, $5)`, [
        actor.businessId,
        shift.id,
        Number(e.amount),
        `Anulación del gasto: ${e.description}`.slice(0, 200),
        actor.id,
      ]);
    }
    await db.query(`UPDATE expenses SET voided_at = now(), voided_by = $2, void_reason = $3 WHERE id = $1`, [expenseId, actor.id, why]);
    await audit(db, actor, { action: 'expense.void', entity: 'expense', entityId: expenseId, summary: `Anuló un gasto de ${money(Number(e.amount))}: ${e.description}`, reason: why });
  });
}

export async function listExpenses(actor: Actor, range: { from: string; to: string; locationId?: string | null }): Promise<Expense[]> {
  requirePermission(actor, 'finance.view');
  checkRange(range.from, range.to);
  const scope = scopeOf(actor, range.locationId);
  const rows = await query<Omit<Expense, 'amount' | 'spentOn'> & { amount: string; spentOn: string }>(
    `SELECT e.id, e.category, e.description, e.supplier, e.amount, to_char(e.spent_on, 'YYYY-MM-DD') AS "spentOn", e.paid_from_cash AS "paidFromCash",
            s.name AS "createdBy", l.name AS "locationName", (e.voided_at IS NOT NULL) AS voided, e.void_reason AS "voidReason"
       FROM expenses e JOIN staff s ON s.id = e.created_by JOIN locations l ON l.id = e.location_id
      WHERE e.business_id = $1 AND e.spent_on BETWEEN $2 AND $3 AND ($4::uuid IS NULL OR e.location_id = $4)
      ORDER BY e.spent_on DESC, e.created_at DESC`,
    [actor.businessId, range.from, range.to, scope],
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

// ───────── estado de resultados ─────────

export type Statement = {
  from: string;
  to: string;
  scope: string | null;
  sales: number;
  tips: number;
  discounts: number;
  voids: number;
  costOfSales: number;
  grossProfit: number;
  waste: number;
  inventoryShortage: number;
  inventorySurplus: number;
  expenses: { category: ExpenseCategory; amount: number }[];
  expensesTotal: number;
  operatingProfit: number;
  tables: number;
  guests: number;
  averageTicket: number;
  byMethod: { method: string; amount: number }[];
  topProducts: { name: string; quantity: number; total: number }[];
  byDay: { day: string; sales: number }[];
};

/**
 * Lo que pasó en un periodo. Ventas = lo cobrado (sin propinas, que son del equipo). Costo de ventas = insumos que
 * descontaron las recetas (menos lo devuelto por anulaciones). La utilidad operativa resta mermas, faltantes de
 * inventario y gastos.
 */
export async function getStatement(actor: Actor, range: { from: string; to: string; locationId?: string | null }, timeZone: string): Promise<Statement> {
  requirePermission(actor, 'finance.view');
  checkRange(range.from, range.to);
  const scope = scopeOf(actor, range.locationId);
  // [desde, hasta] en días del negocio → instantes.
  const p = [actor.businessId, range.from, range.to, timeZone, scope];
  const inRange = (col: string) =>
    `${col} >= ($2::date)::timestamp AT TIME ZONE $4 AND ${col} < ($3::date + 1)::timestamp AT TIME ZONE $4`;
  const loc = (col: string) => `($5::uuid IS NULL OR ${col} = $5)`;

  const [money1, inv, exp, tables, methods, top, days] = await Promise.all([
    query<{ sales: string; tips: string }>(
      `SELECT COALESCE(sum(amount), 0) AS sales, COALESCE(sum(tip), 0) AS tips FROM payments
        WHERE business_id = $1 AND reversed_at IS NULL AND ${inRange('created_at')} AND ${loc('location_id')}`,
      p,
    ),
    query<{ kind: string; value: string }>(
      `SELECT kind, sum(quantity * unit_cost) AS value FROM inventory_movements
        WHERE business_id = $1 AND ${inRange('created_at')} AND ${loc('location_id')} GROUP BY kind`,
      p,
    ),
    query<{ category: ExpenseCategory; amount: string }>(
      `SELECT category, sum(amount) AS amount FROM expenses
        WHERE business_id = $1 AND voided_at IS NULL AND spent_on BETWEEN $2 AND $3 AND ($4::uuid IS NULL OR location_id = $4) GROUP BY category ORDER BY sum(amount) DESC`,
      [actor.businessId, range.from, range.to, scope],
    ),
    query<{ tables: number; guests: string; discounts: string; voids: string }>(
      `SELECT count(*)::int AS tables, COALESCE(sum(ts.guests), 0) AS guests,
              COALESCE(sum((SELECT COALESCE(sum(amount), 0) FROM session_discounts d WHERE d.session_id = ts.id AND d.voided_at IS NULL)), 0) AS discounts,
              COALESCE(sum((SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items i WHERE i.session_id = ts.id AND i.voided_at IS NOT NULL)), 0) AS voids
         FROM table_sessions ts
        WHERE ts.business_id = $1 AND ts.status = 'closed' AND ${inRange('ts.closed_at')} AND ${loc('ts.location_id')}`,
      p,
    ),
    query<{ method: string; amount: string }>(
      `SELECT method, sum(amount) AS amount FROM payments
        WHERE business_id = $1 AND reversed_at IS NULL AND ${inRange('created_at')} AND ${loc('location_id')} GROUP BY method ORDER BY sum(amount) DESC`,
      p,
    ),
    query<{ name: string; quantity: string; total: string }>(
      `SELECT i.name, sum(i.quantity) AS quantity, sum(i.quantity * i.unit_price) AS total
         FROM order_items i JOIN order_rounds r ON r.id = i.round_id
        WHERE i.business_id = $1 AND i.voided_at IS NULL AND ${inRange('r.sent_at')} AND ${loc('r.location_id')}
        GROUP BY i.name ORDER BY sum(i.quantity) DESC, i.name LIMIT 10`,
      p,
    ),
    query<{ day: string; sales: string }>(
      `SELECT to_char((created_at AT TIME ZONE $4)::date, 'YYYY-MM-DD') AS day, sum(amount) AS sales FROM payments
        WHERE business_id = $1 AND reversed_at IS NULL AND ${inRange('created_at')} AND ${loc('location_id')}
        GROUP BY 1 ORDER BY 1`,
      p,
    ),
  ]);
  const invBy = Object.fromEntries(inv.map((r) => [r.kind, Number(r.value)]));
  const sales = Number(money1[0].sales);
  // Las ventas descuentan (valor negativo); las devoluciones por anulación lo reponen.
  const costOfSales = -((invBy.sale ?? 0) + (invBy.void ?? 0));
  const waste = -(invBy.waste ?? 0);
  // Conteos: lo que faltó es pérdida; lo que sobró corrige a favor. Se separan sumando por signo.
  const countSplit = await query<{ short: string; over: string }>(
    `SELECT COALESCE(sum(CASE WHEN quantity < 0 THEN -quantity * unit_cost ELSE 0 END), 0) AS short,
            COALESCE(sum(CASE WHEN quantity > 0 THEN quantity * unit_cost ELSE 0 END), 0) AS over
       FROM inventory_movements WHERE business_id = $1 AND kind = 'count' AND ${inRange('created_at')} AND ${loc('location_id')}`,
    p,
  );
  const shortage = Number(countSplit[0].short);
  const surplus = Number(countSplit[0].over);
  const expenses = exp.map((e) => ({ category: e.category, amount: Number(e.amount) }));
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const grossProfit = sales - costOfSales;
  const t = tables[0];
  return {
    from: range.from,
    to: range.to,
    scope,
    sales,
    tips: Number(money1[0].tips),
    discounts: Number(t.discounts),
    voids: Number(t.voids),
    costOfSales: Math.round(costOfSales),
    grossProfit: Math.round(grossProfit),
    waste: Math.round(waste),
    inventoryShortage: Math.round(shortage),
    inventorySurplus: Math.round(surplus),
    expenses,
    expensesTotal,
    operatingProfit: Math.round(grossProfit - waste - shortage + surplus - expensesTotal),
    tables: t.tables,
    guests: Number(t.guests),
    averageTicket: t.tables ? Math.round(sales / t.tables) : 0,
    byMethod: methods.map((m) => ({ method: m.method, amount: Number(m.amount) })),
    topProducts: top.map((r) => ({ name: r.name, quantity: Number(r.quantity), total: Number(r.total) })),
    byDay: days.map((d) => ({ day: d.day, sales: Number(d.sales) })),
  };
}
