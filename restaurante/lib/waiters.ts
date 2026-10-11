// Bares sin cajero: cada mesero cobra sus mesas, lleva su propia cuenta (cuánto vendió y en qué forma de pago) y al
// final entrega su cierre con el efectivo. El administrador ve todas las cuentas en vivo y verifica cada cierre.
// La cuenta de un mesero es un turno de caja con staff_id (ver lockWaiterShift en cash.ts): se abre sola al primer cobro.
import { query, transaction } from './db';
import { formatCop } from './format';
import { METHODS, type Method } from './cash';
import { can } from './permissions';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

const money = formatCop;

/** El dueño escoge la forma de trabajo del negocio. */
export async function updateWorkMode(actor: Actor, input: { waitersCollect: boolean; barOnly: boolean }) {
  requirePermission(actor, 'locations.manage');
  await transaction(async (db) => {
    await db.query(`UPDATE businesses SET waiters_collect = $2, bar_only = $3 WHERE id = $1`, [actor.businessId, input.waitersCollect, input.barOnly]);
    await audit(db, actor, {
      action: 'business.mode',
      entity: 'business',
      entityId: actor.businessId,
      summary: `Cambió la forma de trabajo: ${input.waitersCollect ? 'cada mesero cobra sus mesas' : 'cobra la caja'}, ${input.barOnly ? 'solo bar' : 'con cocina'}`,
    });
  });
}

export type MethodTotals = Record<Method, { amount: number; tip: number; count: number }>;

export type WaiterTable = {
  sessionId: string;
  tableNumber: string;
  status: string;
  closedAt: Date | null;
  payments: { method: Method; amount: number; tip: number }[];
  total: number;
};

export type WaiterAccount = {
  staff: { id: string; name: string; role: string };
  shift: { id: string; openedAt: Date } | null;
  byMethod: MethodTotals;
  sales: number;
  tips: number;
  /** Efectivo que el mesero debe entregar (ventas + propinas en efectivo). */
  cash: number;
  tables: WaiterTable[];
  openTables: { sessionId: string; tableNumber: string; status: string; total: number; paid: number; balance: number }[];
};

const emptyTotals = (): MethodTotals => Object.fromEntries(METHODS.map((m) => [m, { amount: 0, tip: 0, count: 0 }])) as MethodTotals;

async function shiftTables(shiftId: string): Promise<{ byMethod: MethodTotals; tables: WaiterTable[] }> {
  const rows = await query<{ sessionId: string; tableNumber: string; status: string; closedAt: Date | null; method: Method; amount: string; tip: string; count: number }>(
    `SELECT p.session_id AS "sessionId", t.number AS "tableNumber", ts.status, ts.closed_at AS "closedAt", p.method,
            sum(p.amount) AS amount, sum(p.tip) AS tip, count(*)::int AS count
       FROM payments p JOIN table_sessions ts ON ts.id = p.session_id JOIN dining_tables t ON t.id = ts.table_id
      WHERE p.shift_id = $1 AND p.reversed_at IS NULL
      GROUP BY p.session_id, t.number, ts.status, ts.closed_at, p.method
      ORDER BY min(p.created_at) DESC`,
    [shiftId],
  );
  const byMethod = emptyTotals();
  const tables = new Map<string, WaiterTable>();
  for (const r of rows) {
    const amount = Number(r.amount);
    const tip = Number(r.tip);
    byMethod[r.method].amount += amount;
    byMethod[r.method].tip += tip;
    byMethod[r.method].count += r.count;
    const table = tables.get(r.sessionId) ?? { sessionId: r.sessionId, tableNumber: r.tableNumber, status: r.status, closedAt: r.closedAt, payments: [], total: 0 };
    table.payments.push({ method: r.method, amount, tip });
    table.total += amount;
    tables.set(r.sessionId, table);
  }
  return { byMethod, tables: [...tables.values()] };
}

async function openTablesOf(actor: Actor, staffId: string) {
  const rows = await query<{ sessionId: string; tableNumber: string; status: string; subtotal: string; discounts: string; paid: string }>(
    `SELECT ts.id AS "sessionId", t.number AS "tableNumber", ts.status,
            (SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items WHERE session_id = ts.id AND voided_at IS NULL) AS subtotal,
            (SELECT COALESCE(sum(amount), 0) FROM session_discounts WHERE session_id = ts.id AND voided_at IS NULL) AS discounts,
            (SELECT COALESCE(sum(amount), 0) FROM payments WHERE session_id = ts.id AND reversed_at IS NULL) AS paid
       FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
      WHERE ts.business_id = $1 AND ts.location_id = $2 AND ts.opened_by = $3 AND ts.status <> 'closed'
      ORDER BY ts.opened_at`,
    [actor.businessId, actor.locationId, staffId],
  );
  return rows.map((r) => {
    const total = Math.max(0, Number(r.subtotal) - Number(r.discounts));
    return { sessionId: r.sessionId, tableNumber: r.tableNumber, status: r.status, total, paid: Number(r.paid), balance: total - Number(r.paid) };
  });
}

function canSee(actor: Actor, staffId: string) {
  if (staffId === actor.id) return;
  requirePermission(actor, 'waiters.verify');
}

/** La cuenta en curso de un mesero: lo que lleva vendido, por forma de pago y por mesa. */
export async function waiterAccount(actor: Actor, staffId: string = actor.id): Promise<WaiterAccount> {
  if (!isUuid(staffId)) throw new AppError('NOT_FOUND', 'No encontramos a esa persona.');
  canSee(actor, staffId);
  const person = (await query<{ id: string; name: string; role: string }>(`SELECT id, name, role FROM staff WHERE id = $1 AND business_id = $2`, [staffId, actor.businessId]))[0];
  if (!person) throw new AppError('NOT_FOUND', 'No encontramos a esa persona.');
  const shift = (
    await query<{ id: string; openedAt: Date }>(
      `SELECT id, opened_at AS "openedAt" FROM cash_shifts WHERE business_id = $1 AND location_id = $2 AND staff_id = $3 AND closed_at IS NULL`,
      [actor.businessId, actor.locationId, staffId],
    )
  )[0];
  const [{ byMethod, tables }, openTables] = await Promise.all([shift ? shiftTables(shift.id) : Promise.resolve({ byMethod: emptyTotals(), tables: [] }), openTablesOf(actor, staffId)]);
  const sales = METHODS.reduce((s, m) => s + byMethod[m].amount, 0);
  const tips = METHODS.reduce((s, m) => s + byMethod[m].tip, 0);
  return { staff: person, shift: shift ?? null, byMethod, sales, tips, cash: byMethod.cash.amount + byMethod.cash.tip, tables, openTables };
}

/** Para el administrador: la cuenta en curso de cada mesero de la sede (los activos y quien tenga cuenta abierta). */
export async function listWaiterAccounts(actor: Actor): Promise<WaiterAccount[]> {
  requirePermission(actor, 'waiters.verify');
  const people = await query<{ id: string }>(
    `SELECT s.id FROM staff s
      WHERE s.business_id = $1 AND (
        (s.is_active AND s.role = 'waiter' AND (s.location_id IS NULL OR s.location_id = $2))
        OR EXISTS (SELECT 1 FROM cash_shifts c WHERE c.staff_id = s.id AND c.location_id = $2 AND c.closed_at IS NULL)
        OR EXISTS (SELECT 1 FROM table_sessions ts WHERE ts.opened_by = s.id AND ts.location_id = $2 AND ts.status <> 'closed'))
      ORDER BY s.name`,
    [actor.businessId, actor.locationId],
  );
  return Promise.all(people.map((p) => waiterAccount(actor, p.id)));
}

export type WaiterClosing = {
  id: string;
  staffId: string;
  staffName: string;
  openedAt: Date;
  closedAt: Date;
  closedBy: string;
  byMethod: MethodTotals;
  sales: number;
  tips: number;
  expected: number;
  counted: number;
  difference: number;
  notes: string | null;
  tables: WaiterTable[];
  verifiedAt: Date | null;
  verifiedBy: string | null;
  verifyNote: string | null;
};

/** Cierres de meseros de los últimos días (los del mesero, o todos para el administrador), del más reciente al más viejo. */
export async function listWaiterClosings(actor: Actor, { staffId, days = 3 }: { staffId?: string; days?: number } = {}): Promise<WaiterClosing[]> {
  const only = staffId ?? (can(actor.role, 'waiters.verify') ? null : actor.id);
  if (only) canSee(actor, only);
  const rows = await query<{ id: string; staffId: string; staffName: string; openedAt: Date; closedAt: Date; closedBy: string; expected: string; counted: string; notes: string | null; verifiedAt: Date | null; verifiedBy: string | null; verifyNote: string | null }>(
    `SELECT c.id, c.staff_id AS "staffId", s.name AS "staffName", c.opened_at AS "openedAt", c.closed_at AS "closedAt", x.name AS "closedBy",
            c.expected_cash AS expected, c.counted_cash AS counted, c.notes, c.verified_at AS "verifiedAt", v.name AS "verifiedBy", c.verify_note AS "verifyNote"
       FROM cash_shifts c JOIN staff s ON s.id = c.staff_id JOIN staff x ON x.id = c.closed_by LEFT JOIN staff v ON v.id = c.verified_by
      WHERE c.business_id = $1 AND c.location_id = $2 AND c.staff_id IS NOT NULL AND c.closed_at IS NOT NULL
        AND c.closed_at > now() - make_interval(days => $3) AND ($4::uuid IS NULL OR c.staff_id = $4)
      ORDER BY (c.verified_at IS NULL) DESC, c.closed_at DESC`,
    [actor.businessId, actor.locationId, days, only],
  );
  return Promise.all(
    rows.map(async (r) => {
      const { byMethod, tables } = await shiftTables(r.id);
      const expected = Number(r.expected);
      const counted = Number(r.counted);
      return {
        ...r,
        byMethod,
        tables,
        sales: METHODS.reduce((s, m) => s + byMethod[m].amount, 0),
        tips: METHODS.reduce((s, m) => s + byMethod[m].tip, 0),
        expected,
        counted,
        difference: counted - expected,
      };
    }),
  );
}

/**
 * Cierre de un mesero: dice cuánto efectivo entrega y queda la diferencia contra lo que cobró en efectivo.
 * El mesero cierra el suyo (sin mesas por cobrar); el administrador puede cerrar el de cualquiera.
 */
export async function closeWaiterShift(actor: Actor, staffId: string, countedCash: number, notes?: string) {
  if (!isUuid(staffId)) throw new AppError('NOT_FOUND', 'No encontramos a esa persona.');
  canSee(actor, staffId);
  if (!Number.isInteger(countedCash) || countedCash < 0) throw new AppError('INVALID', 'Efectivo que entrega: escribe un valor en pesos.');
  const note = notes?.trim() ? notes.trim().replace(/\s+/g, ' ') : null;
  if (note && (note.length < 2 || note.length > 300)) throw new AppError('INVALID', 'Nota: entre 2 y 300 caracteres.');
  return transaction(async (db) => {
    const shift = (
      await db.query<{ id: string; name: string }>(
        `SELECT c.id, s.name FROM cash_shifts c JOIN staff s ON s.id = c.staff_id
          WHERE c.business_id = $1 AND c.location_id = $2 AND c.staff_id = $3 AND c.closed_at IS NULL FOR UPDATE OF c`,
        [actor.businessId, actor.locationId, staffId],
      )
    ).rows[0];
    if (!shift) throw new AppError('CONFLICT', staffId === actor.id ? 'Todavía no has cobrado nada en este turno.' : 'Esa persona no tiene cobros en este turno.');
    if (!can(actor.role, 'waiters.verify')) {
      const pending = await db.query<{ number: string }>(
        `SELECT t.number FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
          WHERE ts.business_id = $1 AND ts.location_id = $2 AND ts.opened_by = $3 AND ts.status <> 'closed' ORDER BY t.number`,
        [actor.businessId, actor.locationId, staffId],
      );
      if (pending.rows.length) {
        throw new AppError(
          'CONFLICT',
          pending.rows.length === 1
            ? `Todavía tienes la mesa ${pending.rows[0].number} abierta. Cóbrala antes de cerrar tu cuenta.`
            : `Todavía tienes ${pending.rows.length} mesas abiertas. Cóbralas antes de cerrar tu cuenta.`,
        );
      }
    }
    const cash = (
      await db.query<{ cash: string }>(`SELECT COALESCE(sum(amount + tip), 0) AS cash FROM payments WHERE shift_id = $1 AND method = 'cash' AND reversed_at IS NULL`, [
        shift.id,
      ])
    ).rows[0];
    const expected = Number(cash.cash);
    const diff = countedCash - expected;
    await db.query(`UPDATE cash_shifts SET closed_at = now(), closed_by = $2, expected_cash = $3, counted_cash = $4, notes = $5 WHERE id = $1`, [
      shift.id,
      actor.id,
      expected,
      countedCash,
      note,
    ]);
    const result = diff === 0 ? ' (cuadra)' : diff > 0 ? ` (sobran ${money(diff)})` : ` (faltan ${money(-diff)})`;
    await audit(db, actor, {
      action: 'waiter.close',
      entity: 'cash_shift',
      entityId: shift.id,
      summary:
        staffId === actor.id
          ? `Cerró su cuenta: entregó ${money(countedCash)} en efectivo de ${money(expected)}${result}`
          : `Cerró la cuenta de ${shift.name}: ${money(countedCash)} en efectivo de ${money(expected)}${result}`,
      reason: note,
      data: { expected, counted: countedCash, difference: diff },
    });
    return { shiftId: shift.id, waiter: shift.name, expected, counted: countedCash, difference: diff };
  });
}

/** El administrador revisa el cierre de un mesero (con la plata en la mano) y lo marca como verificado. */
export async function verifyWaiterShift(actor: Actor, shiftId: string, note?: string) {
  requirePermission(actor, 'waiters.verify');
  if (!isUuid(shiftId)) throw new AppError('NOT_FOUND', 'No encontramos ese cierre.');
  const why = note?.trim() ? note.trim().replace(/\s+/g, ' ') : null;
  if (why && (why.length < 2 || why.length > 300)) throw new AppError('INVALID', 'Nota: entre 2 y 300 caracteres.');
  await transaction(async (db) => {
    const shift = (
      await db.query<{ name: string; closed: boolean; verified: boolean; expected: string; counted: string }>(
        `SELECT s.name, (c.closed_at IS NOT NULL) AS closed, (c.verified_at IS NOT NULL) AS verified, c.expected_cash AS expected, c.counted_cash AS counted
           FROM cash_shifts c JOIN staff s ON s.id = c.staff_id
          WHERE c.id = $1 AND c.business_id = $2 AND c.location_id = $3 AND c.staff_id IS NOT NULL FOR UPDATE OF c`,
        [shiftId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!shift) throw new AppError('NOT_FOUND', 'No encontramos ese cierre.');
    if (!shift.closed) throw new AppError('CONFLICT', 'Esa cuenta todavía está abierta. Primero se cierra.');
    if (shift.verified) throw new AppError('CONFLICT', 'Ese cierre ya estaba verificado.');
    await db.query(`UPDATE cash_shifts SET verified_at = now(), verified_by = $2, verify_note = $3 WHERE id = $1`, [shiftId, actor.id, why]);
    await audit(db, actor, {
      action: 'waiter.verify',
      entity: 'cash_shift',
      entityId: shiftId,
      summary: `Verificó el cierre de ${shift.name}: ${money(Number(shift.counted))} en efectivo de ${money(Number(shift.expected))}`,
      reason: why,
    });
  });
}

