// Módulo 04: caja y pagos. Turnos de caja, cobro en partes y con varios medios, propina, descuentos y cierre de caja.
// Nada se borra: un pago equivocado se reversa con motivo, un descuento se anula, una salida de plata se registra.
import { formatCop } from './format';
import { pooled, query, transaction, type Db } from './db';
import { createInvoice, voidInvoiceFor } from './invoices';
import { can } from './permissions';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export const METHODS = ['cash', 'card', 'transfer'] as const;
export const isMethod = (v: string): v is Method => (METHODS as readonly string[]).includes(v);
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<Method, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

const money = (n: number) => formatCop(n);

function requireAmount(value: number, label: string, { allowZero = false } = {}) {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > 1_000_000_000) throw new AppError('INVALID', `${label}: escribe un valor en pesos.`);
  return value;
}

function requireText(value: string, label: string, min: number, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

/** Propina sugerida redondeada a la centena: 10 % de $84.000 → $8.400. */
export const suggestedTipFor = (total: number, percent: number) => Math.round((total * percent) / 100 / 100) * 100;

// ───────── turnos de caja ─────────

export type Shift = { id: string; openedAt: Date; openedBy: string; openingAmount: number; closedAt: Date | null; closedBy: string | null; expectedCash: number | null; countedCash: number | null; notes: string | null };

const SHIFT_SELECT = `SELECT c.id, c.opened_at AS "openedAt", o.name AS "openedBy", c.opening_amount AS "openingAmount", c.closed_at AS "closedAt",
       x.name AS "closedBy", c.expected_cash AS "expectedCash", c.counted_cash AS "countedCash", c.notes
  FROM cash_shifts c JOIN staff o ON o.id = c.opened_by LEFT JOIN staff x ON x.id = c.closed_by`;

type ShiftRow = Omit<Shift, 'openingAmount' | 'expectedCash' | 'countedCash'> & { openingAmount: string; expectedCash: string | null; countedCash: string | null };
const toShift = (r: ShiftRow): Shift => ({
  ...r,
  openingAmount: Number(r.openingAmount),
  expectedCash: r.expectedCash === null ? null : Number(r.expectedCash),
  countedCash: r.countedCash === null ? null : Number(r.countedCash),
});

export async function getOpenShift(actor: Actor): Promise<Shift | null> {
  const rows = await query<ShiftRow>(`${SHIFT_SELECT} WHERE c.location_id = $1 AND c.business_id = $2 AND c.closed_at IS NULL`, [actor.locationId, actor.businessId]);
  return rows[0] ? toShift(rows[0]) : null;
}

export async function listShifts(actor: Actor, limit = 15): Promise<Shift[]> {
  requirePermission(actor, 'cash.operate');
  const rows = await query<ShiftRow>(`${SHIFT_SELECT} WHERE c.location_id = $1 AND c.business_id = $2 ORDER BY c.opened_at DESC LIMIT $3`, [
    actor.locationId,
    actor.businessId,
    limit,
  ]);
  return rows.map(toShift);
}

export async function openShift(actor: Actor, openingAmount: number) {
  requirePermission(actor, 'cash.operate');
  requireAmount(openingAmount, 'Base de caja', { allowZero: true });
  try {
    return await transaction(async (db) => {
      const res = await db.query<{ id: string }>(
        `INSERT INTO cash_shifts (business_id, location_id, opened_by, opening_amount) VALUES ($1, $2, $3, $4) RETURNING id`,
        [actor.businessId, actor.locationId, actor.id, openingAmount],
      );
      await audit(db, actor, { action: 'cash.open', entity: 'cash_shift', entityId: res.rows[0].id, summary: `Abrió la caja con base de ${money(openingAmount)}` });
      return res.rows[0].id;
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new AppError('CONFLICT', 'Ya hay una caja abierta en esta sede.');
    throw error;
  }
}

export async function lockOpenShift(db: Db, actor: Actor) {
  const shift = (
    await db.query<{ id: string; openingAmount: string }>(
      `SELECT id, opening_amount AS "openingAmount" FROM cash_shifts WHERE location_id = $1 AND business_id = $2 AND closed_at IS NULL FOR UPDATE`,
      [actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!shift) throw new AppError('CONFLICT', 'La caja está cerrada. Ábrela para cobrar.');
  return shift;
}

export async function addMovement(actor: Actor, input: { kind: string; amount: number; reason: string }) {
  requirePermission(actor, 'cash.operate');
  if (input.kind !== 'in' && input.kind !== 'out') throw new AppError('INVALID', 'Elige si entra o sale plata.');
  requireAmount(input.amount, 'Valor');
  const reason = requireText(input.reason, 'Motivo', 3, 200);
  await transaction(async (db) => {
    const shift = await lockOpenShift(db, actor);
    if (input.kind === 'out') {
      const cash = await expectedCash(db, shift.id, Number(shift.openingAmount));
      if (input.amount > cash) throw new AppError('CONFLICT', `En caja debería haber ${money(cash)}: no alcanza para sacar ${money(input.amount)}.`);
    }
    const res = await db.query<{ id: string }>(
      `INSERT INTO cash_movements (business_id, shift_id, kind, amount, reason, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [actor.businessId, shift.id, input.kind, input.amount, reason, actor.id],
    );
    await audit(db, actor, {
      action: input.kind === 'in' ? 'cash.in' : 'cash.out',
      entity: 'cash_movement',
      entityId: res.rows[0].id,
      summary: `${input.kind === 'in' ? 'Entró' : 'Salió'} ${money(input.amount)} de la caja`,
      reason,
    });
  });
}

/** Efectivo que debería haber: base + ventas y propinas en efectivo + entradas − salidas. */
async function expectedCash(db: Db, shiftId: string, opening: number) {
  const row = (
    await db.query<{ sales: string; moves: string }>(
      `SELECT
         (SELECT COALESCE(sum(amount + tip), 0) FROM payments WHERE shift_id = $1 AND method = 'cash' AND reversed_at IS NULL) AS sales,
         (SELECT COALESCE(sum(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) FROM cash_movements WHERE shift_id = $1) AS moves`,
      [shiftId],
    )
  ).rows[0];
  return opening + Number(row.sales) + Number(row.moves);
}

export type ShiftSummary = {
  shift: Shift;
  byMethod: Record<Method, { amount: number; tip: number; count: number }>;
  sales: number;
  tips: number;
  discounts: number;
  voids: number;
  reversed: number;
  movementsIn: number;
  movementsOut: number;
  expectedCash: number;
  tablesClosed: number;
  movements: { id: string; kind: 'in' | 'out'; amount: number; reason: string; createdBy: string; createdAt: Date }[];
};

/** Cuadre de un turno (abierto o cerrado). */
export async function shiftSummary(actor: Actor, shiftId: string): Promise<ShiftSummary | null> {
  requirePermission(actor, 'cash.operate');
  if (!isUuid(shiftId)) return null;
  const row = (await query<ShiftRow>(`${SHIFT_SELECT} WHERE c.id = $1 AND c.location_id = $2 AND c.business_id = $3`, [shiftId, actor.locationId, actor.businessId]))[0];
  if (!row) return null;
  const shift = toShift(row);
  const [methods, extra, movements] = await Promise.all([
    query<{ method: Method; amount: string; tip: string; count: number }>(
      `SELECT method, sum(amount) AS amount, sum(tip) AS tip, count(*)::int AS count FROM payments WHERE shift_id = $1 AND reversed_at IS NULL GROUP BY method`,
      [shiftId],
    ),
    query<{ discounts: string; voids: string; reversed: string; tables: number }>(
      `SELECT
         (SELECT COALESCE(sum(d.amount), 0) FROM session_discounts d WHERE d.voided_at IS NULL AND d.session_id IN (SELECT session_id FROM payments WHERE shift_id = $1)) AS discounts,
         (SELECT COALESCE(sum(i.unit_price * i.quantity), 0) FROM order_items i WHERE i.voided_at IS NOT NULL AND i.session_id IN (SELECT session_id FROM payments WHERE shift_id = $1)) AS voids,
         (SELECT COALESCE(sum(amount), 0) FROM payments WHERE shift_id = $1 AND reversed_at IS NOT NULL) AS reversed,
         (SELECT count(DISTINCT p.session_id)::int FROM payments p JOIN table_sessions ts ON ts.id = p.session_id WHERE p.shift_id = $1 AND ts.status = 'closed') AS tables`,
      [shiftId],
    ),
    query<{ id: string; kind: 'in' | 'out'; amount: string; reason: string; createdBy: string; createdAt: Date }>(
      `SELECT m.id, m.kind, m.amount, m.reason, s.name AS "createdBy", m.created_at AS "createdAt"
         FROM cash_movements m JOIN staff s ON s.id = m.created_by WHERE m.shift_id = $1 ORDER BY m.created_at`,
      [shiftId],
    ),
  ]);
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, { amount: 0, tip: 0, count: 0 }])) as ShiftSummary['byMethod'];
  for (const m of methods) byMethod[m.method] = { amount: Number(m.amount), tip: Number(m.tip), count: m.count };
  const moves = movements.map((m) => ({ ...m, amount: Number(m.amount) }));
  const movementsIn = moves.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0);
  const movementsOut = moves.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0);
  return {
    shift,
    byMethod,
    sales: METHODS.reduce((s, m) => s + byMethod[m].amount, 0),
    tips: METHODS.reduce((s, m) => s + byMethod[m].tip, 0),
    discounts: Number(extra[0].discounts),
    voids: Number(extra[0].voids),
    reversed: Number(extra[0].reversed),
    movementsIn,
    movementsOut,
    expectedCash: shift.openingAmount + byMethod.cash.amount + byMethod.cash.tip + movementsIn - movementsOut,
    tablesClosed: extra[0].tables,
    movements: moves,
  };
}

/** Cierra la caja: se cuenta la plata y queda la diferencia contra lo esperado. */
export async function closeShift(actor: Actor, countedCash: number, notes?: string) {
  requirePermission(actor, 'cash.operate');
  requireAmount(countedCash, 'Efectivo contado', { allowZero: true });
  const why = notes?.trim() ? requireText(notes, 'Nota', 2, 300) : null;
  return transaction(async (db) => {
    const shift = await lockOpenShift(db, actor);
    const expected = await expectedCash(db, shift.id, Number(shift.openingAmount));
    const diff = countedCash - expected;
    await db.query(`UPDATE cash_shifts SET closed_at = now(), closed_by = $2, expected_cash = $3, counted_cash = $4, notes = $5 WHERE id = $1`, [
      shift.id,
      actor.id,
      expected,
      countedCash,
      why,
    ]);
    await audit(db, actor, {
      action: 'cash.close',
      entity: 'cash_shift',
      entityId: shift.id,
      summary: `Cerró la caja: esperado ${money(expected)}, contado ${money(countedCash)}${diff === 0 ? ' (cuadra)' : diff > 0 ? ` (sobran ${money(diff)})` : ` (faltan ${money(-diff)})`}`,
      reason: why,
      data: { expected, counted: countedCash, difference: diff },
    });
    return { shiftId: shift.id, expected, counted: countedCash, difference: diff };
  });
}

// ───────── cobrar una mesa ─────────

export type Checkout = {
  session: { id: string; tableNumber: string; zone: string; status: string; guests: number; openedAt: Date; openedBy: string; closedAt: Date | null };
  lines: { name: string; unitPrice: number; quantity: number; total: number }[];
  subtotal: number;
  discounts: { id: string; amount: number; percent: number | null; reason: string; appliedBy: string; voided: boolean }[];
  discountTotal: number;
  total: number;
  payments: { id: string; method: Method; amount: number; tip: number; received: number | null; change: number | null; reference: string | null; createdBy: string; createdAt: Date; reversed: boolean; reverseReason: string | null }[];
  paid: number;
  tips: number;
  balance: number;
  suggestedTipPercent: number;
  discountLimit: number;
};

async function loadCheckout(db: Db, actor: Actor, sessionId: string): Promise<Checkout | null> {
  const session = (
    await db.query<Checkout['session'] & { tipPct: number; discountLimit: number }>(
      `SELECT ts.id, t.number AS "tableNumber", t.zone, ts.status, ts.guests, ts.opened_at AS "openedAt", s.name AS "openedBy", ts.closed_at AS "closedAt",
              b.suggested_tip AS "tipPct", b.cashier_discount_limit AS "discountLimit"
         FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id JOIN staff s ON s.id = ts.opened_by JOIN businesses b ON b.id = ts.business_id
        WHERE ts.id = $1 AND ts.location_id = $2 AND ts.business_id = $3`,
      [sessionId, actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!session) return null;
  const [lines, discounts, payments] = await Promise.all([
    db.query<{ name: string; unitPrice: string; quantity: string }>(
      `SELECT name, unit_price AS "unitPrice", sum(quantity) AS quantity FROM order_items
        WHERE session_id = $1 AND voided_at IS NULL GROUP BY name, unit_price ORDER BY name`,
      [sessionId],
    ),
    db.query<{ id: string; amount: string; percent: number | null; reason: string; appliedBy: string; voided: boolean }>(
      `SELECT d.id, d.amount, d.percent, d.reason, s.name AS "appliedBy", (d.voided_at IS NOT NULL) AS voided
         FROM session_discounts d JOIN staff s ON s.id = d.applied_by WHERE d.session_id = $1 ORDER BY d.applied_at`,
      [sessionId],
    ),
    db.query<{ id: string; method: Method; amount: string; tip: string; received: string | null; change: string | null; reference: string | null; createdBy: string; createdAt: Date; reversed: boolean; reverseReason: string | null }>(
      `SELECT p.id, p.method, p.amount, p.tip, p.received, p.change_given AS change, p.reference, s.name AS "createdBy", p.created_at AS "createdAt",
              (p.reversed_at IS NOT NULL) AS reversed, p.reverse_reason AS "reverseReason"
         FROM payments p JOIN staff s ON s.id = p.created_by WHERE p.session_id = $1 ORDER BY p.created_at`,
      [sessionId],
    ),
  ]);
  const ls = lines.rows.map((l) => ({ name: l.name, unitPrice: Number(l.unitPrice), quantity: Number(l.quantity), total: Number(l.unitPrice) * Number(l.quantity) }));
  const subtotal = ls.reduce((s, l) => s + l.total, 0);
  const ds = discounts.rows.map((d) => ({ ...d, amount: Number(d.amount) }));
  const discountTotal = ds.filter((d) => !d.voided).reduce((s, d) => s + d.amount, 0);
  const ps = payments.rows.map((p) => ({
    ...p,
    amount: Number(p.amount),
    tip: Number(p.tip),
    received: p.received === null ? null : Number(p.received),
    change: p.change === null ? null : Number(p.change),
  }));
  const paid = ps.filter((p) => !p.reversed).reduce((s, p) => s + p.amount, 0);
  const tips = ps.filter((p) => !p.reversed).reduce((s, p) => s + p.tip, 0);
  const total = Math.max(0, subtotal - discountTotal);
  const { tipPct, discountLimit, ...head } = session;
  return { session: head, lines: ls, subtotal, discounts: ds, discountTotal, total, payments: ps, paid, tips, balance: total - paid, suggestedTipPercent: tipPct, discountLimit };
}

export async function getCheckout(actor: Actor, sessionId: string) {
  requirePermission(actor, 'cash.operate');
  if (!isUuid(sessionId)) return null;
  return loadCheckout(pooled(), actor, sessionId);
}

async function lockSessionForCash(db: Db, actor: Actor, sessionId: string) {
  if (!isUuid(sessionId)) throw new AppError('NOT_FOUND', 'No encontramos esa cuenta.');
  const row = (
    await db.query<{ id: string; status: string; number: string; tableId: string }>(
      `SELECT ts.id, ts.status, t.number, ts.table_id AS "tableId" FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
        WHERE ts.id = $1 AND ts.location_id = $2 AND ts.business_id = $3 FOR UPDATE OF ts`,
      [sessionId, actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'No encontramos esa cuenta.');
  return row;
}

/** Descuento por porcentaje o por valor. El cajero llega hasta el límite del negocio; más allá, el administrador. */
export async function applyDiscount(actor: Actor, sessionId: string, input: { percent?: number | null; amount?: number | null; reason: string }) {
  requirePermission(actor, 'cash.operate');
  const reason = requireText(input.reason, 'Motivo del descuento', 3, 200);
  const hasPercent = input.percent !== null && input.percent !== undefined && !Number.isNaN(input.percent);
  const hasAmount = input.amount !== null && input.amount !== undefined && !Number.isNaN(input.amount);
  if (hasPercent === hasAmount) throw new AppError('INVALID', 'Escribe el descuento en porcentaje o en pesos (uno de los dos).');
  if (hasPercent && (!Number.isInteger(input.percent) || input.percent! < 1 || input.percent! > 100)) throw new AppError('INVALID', 'Porcentaje: de 1 a 100.');
  return transaction(async (db) => {
    const session = await lockSessionForCash(db, actor, sessionId);
    if (session.status === 'closed') throw new AppError('CONFLICT', 'Esa mesa ya se cerró.');
    const checkout = (await loadCheckout(db, actor, sessionId))!;
    const amount = hasPercent ? Math.round((checkout.subtotal * input.percent!) / 100) : requireAmount(input.amount!, 'Descuento');
    if (amount <= 0) throw new AppError('INVALID', 'La cuenta no tiene consumo para descontar.');
    if (amount > checkout.balance) throw new AppError('CONFLICT', `El descuento (${money(amount)}) es mayor que lo que falta por pagar (${money(checkout.balance)}).`);
    const totalPct = ((checkout.discountTotal + amount) / checkout.subtotal) * 100;
    if (!can(actor.role, 'discounts.unlimited') && totalPct > checkout.discountLimit + 1e-9) {
      throw new AppError('FORBIDDEN', `Puedes descontar hasta ${checkout.discountLimit} % de la cuenta. Para más, pídeselo al administrador.`);
    }
    const res = await db.query<{ id: string }>(
      `INSERT INTO session_discounts (business_id, session_id, amount, percent, reason, applied_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [actor.businessId, sessionId, amount, hasPercent ? input.percent : null, reason, actor.id],
    );
    await audit(db, actor, {
      action: 'discount.apply',
      entity: 'session_discount',
      entityId: res.rows[0].id,
      summary: `Descuento de ${money(amount)}${hasPercent ? ` (${input.percent} %)` : ''} en la mesa ${session.number} (${Math.round(totalPct)} % de la cuenta en total)`,
      reason,
      data: { sessionId, amount, percentOfBill: totalPct },
    });
    return res.rows[0].id;
  });
}

export async function voidDiscount(actor: Actor, discountId: string) {
  requirePermission(actor, 'cash.operate');
  if (!isUuid(discountId)) throw new AppError('NOT_FOUND', 'No encontramos ese descuento.');
  await transaction(async (db) => {
    const d = (
      await db.query<{ sessionId: string; amount: string; voided: boolean }>(
        `SELECT session_id AS "sessionId", amount, (voided_at IS NOT NULL) AS voided FROM session_discounts WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [discountId, actor.businessId],
      )
    ).rows[0];
    if (!d || d.voided) throw new AppError('NOT_FOUND', 'Ese descuento ya no está.');
    const session = await lockSessionForCash(db, actor, d.sessionId);
    if (session.status === 'closed') throw new AppError('CONFLICT', 'Esa mesa ya se cerró.');
    await db.query(`UPDATE session_discounts SET voided_at = now(), voided_by = $2 WHERE id = $1`, [discountId, actor.id]);
    await audit(db, actor, { action: 'discount.void', entity: 'session_discount', entityId: discountId, summary: `Quitó un descuento de ${money(Number(d.amount))} en la mesa ${session.number}` });
  });
}

export type PaymentInput = { method: string; amount: number; tip?: number; received?: number | null; reference?: string; clientKey: string };

/**
 * Registra un pago (puede ser una parte de la cuenta). Cuando la cuenta queda en cero, la mesa se cierra sola.
 * Si llega dos veces el mismo `clientKey`, no cobra dos veces.
 */
export async function pay(actor: Actor, sessionId: string, input: PaymentInput) {
  requirePermission(actor, 'cash.operate');
  if (!(METHODS as readonly string[]).includes(input.method)) throw new AppError('INVALID', 'Elige cómo paga.');
  const method = input.method as Method;
  if (!isUuid(input.clientKey)) throw new AppError('INVALID', 'Pago sin identificador. Recarga la página.');
  requireAmount(input.amount, 'Valor a pagar');
  const tip = input.tip ? requireAmount(input.tip, 'Propina', { allowZero: true }) : 0;
  const reference = input.reference?.trim() ? requireText(input.reference, 'Referencia', 2, 60) : null;
  let received: number | null = null;
  let change: number | null = null;
  if (method === 'cash') {
    received = input.received ? requireAmount(input.received, 'Efectivo recibido') : input.amount + tip;
    if (received < input.amount + tip) throw new AppError('INVALID', `Recibiste ${money(received)}: no alcanza para ${money(input.amount + tip)}.`);
    change = received - input.amount - tip;
  }

  const previous = await query<{ id: string }>(`SELECT id FROM payments WHERE business_id = $1 AND client_key = $2`, [actor.businessId, input.clientKey]);
  if (previous[0]) {
    const checkout = (await getCheckout(actor, sessionId))!;
    return { paymentId: previous[0].id, change, closed: checkout.session.status === 'closed', duplicate: true };
  }

  try {
    return await transaction(async (db) => {
      const shift = await lockOpenShift(db, actor);
      const session = await lockSessionForCash(db, actor, sessionId);
      if (session.status === 'closed') throw new AppError('CONFLICT', 'Esa mesa ya se cerró.');
      const checkout = (await loadCheckout(db, actor, sessionId))!;
      if (checkout.balance <= 0) throw new AppError('CONFLICT', 'Esta cuenta no tiene nada por pagar.');
      if (input.amount > checkout.balance) throw new AppError('INVALID', `Falta por pagar ${money(checkout.balance)}: el pago no puede ser mayor.`);
      const res = await db.query<{ id: string }>(
        `INSERT INTO payments (business_id, location_id, session_id, shift_id, method, amount, tip, received, change_given, reference, client_key, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [actor.businessId, actor.locationId, sessionId, shift.id, method, input.amount, tip, received, change, reference, input.clientKey, actor.id],
      );
      await audit(db, actor, {
        action: 'payment.create',
        entity: 'payment',
        entityId: res.rows[0].id,
        summary: `Cobró ${money(input.amount)} en ${METHOD_LABEL[method].toLowerCase()} de la mesa ${session.number}${tip ? ` + propina ${money(tip)}` : ''}`,
      });
      const closed = input.amount === checkout.balance;
      if (closed) {
        await db.query(`UPDATE table_sessions SET status = 'closed', closed_at = now(), closed_by = $2 WHERE id = $1`, [sessionId, actor.id]);
        // Una factura por la venta completa (sin propinas, que no son ingreso del negocio).
        const tips = checkout.tips + tip;
        await createInvoice(db, actor, { sessionId, total: checkout.total, tip: tips });
        await audit(db, actor, {
          action: 'table.close',
          entity: 'table_session',
          entityId: sessionId,
          summary: `Cobró y cerró la mesa ${session.number}: ${money(checkout.total)}${checkout.discountTotal ? ` (con ${money(checkout.discountTotal)} de descuento)` : ''}`,
        });
      }
      return { paymentId: res.rows[0].id, change, closed, duplicate: false };
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      const again = await query<{ id: string }>(`SELECT id FROM payments WHERE business_id = $1 AND client_key = $2`, [actor.businessId, input.clientKey]);
      if (again[0]) return { paymentId: again[0].id, change, closed: false, duplicate: true };
    }
    throw error;
  }
}

/**
 * Reversa un pago equivocado (solo dueño o administrador, con motivo, mientras su turno de caja siga abierto).
 * Si ese pago había cerrado la mesa, la mesa vuelve a quedar abierta con la cuenta pedida.
 */
export async function reversePayment(actor: Actor, paymentId: string, reason: string) {
  requirePermission(actor, 'payments.reverse');
  const why = requireText(reason, 'Motivo', 3, 300);
  if (!isUuid(paymentId)) throw new AppError('NOT_FOUND', 'No encontramos ese pago.');
  await transaction(async (db) => {
    const p = (
      await db.query<{ id: string; sessionId: string | null; appointmentId: string | null; amount: string; method: Method; reversed: boolean; shiftClosed: boolean }>(
        `SELECT p.id, p.session_id AS "sessionId", p.appointment_id AS "appointmentId", p.amount, p.method, (p.reversed_at IS NOT NULL) AS reversed, (c.closed_at IS NOT NULL) AS "shiftClosed"
           FROM payments p JOIN cash_shifts c ON c.id = p.shift_id
          WHERE p.id = $1 AND p.business_id = $2 AND p.location_id = $3 FOR UPDATE OF p`,
        [paymentId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!p) throw new AppError('NOT_FOUND', 'No encontramos ese pago.');
    if (p.reversed) throw new AppError('CONFLICT', 'Ese pago ya estaba reversado.');
    if (p.shiftClosed) throw new AppError('CONFLICT', 'La caja de ese pago ya se cerró. Registra la devolución como una salida de caja.');
    if (p.appointmentId) {
      // Pago de una cita: la cita vuelve a quedar "atendida, por cobrar".
      await db.query(`UPDATE appointments SET status = 'done' WHERE id = $1`, [p.appointmentId]);
      await db.query(`UPDATE payments SET reversed_at = now(), reversed_by = $2, reverse_reason = $3 WHERE id = $1`, [paymentId, actor.id, why]);
      const sent = await voidInvoiceFor(db, { appointmentId: p.appointmentId });
      await audit(db, actor, {
        action: 'payment.reverse',
        entity: 'payment',
        entityId: paymentId,
        summary: `Reversó el pago de una cita (${money(Number(p.amount))})${sent ? '. Su factura ya estaba en la DIAN: hace falta nota crédito' : ''}`,
        reason: why,
      });
      return;
    }
    const session = await lockSessionForCash(db, actor, p.sessionId!);
    if (session.status === 'closed') {
      const busy = await db.query(`SELECT 1 FROM table_sessions WHERE table_id = $1 AND status <> 'closed'`, [session.tableId]);
      if (busy.rowCount) throw new AppError('CONFLICT', `La mesa ${session.number} ya tiene otra cuenta abierta. Registra la devolución como una salida de caja.`);
      await db.query(`UPDATE table_sessions SET status = 'bill', closed_at = NULL, closed_by = NULL, bill_at = now() WHERE id = $1`, [session.id]);
      if (await voidInvoiceFor(db, { sessionId: session.id })) {
        await audit(db, actor, { action: 'invoice.credit_note', entity: 'table_session', entityId: session.id, summary: `La factura de la mesa ${session.number} ya estaba en la DIAN: hace falta nota crédito` });
      }
    }
    await db.query(`UPDATE payments SET reversed_at = now(), reversed_by = $2, reverse_reason = $3 WHERE id = $1`, [paymentId, actor.id, why]);
    await audit(db, actor, {
      action: 'payment.reverse',
      entity: 'payment',
      entityId: paymentId,
      summary: `Reversó un pago de ${money(Number(p.amount))} en ${METHOD_LABEL[p.method].toLowerCase()} de la mesa ${session.number}${session.status === 'closed' ? ' (la mesa volvió a quedar abierta)' : ''}`,
      reason: why,
    });
  });
}

/** Cuentas abiertas de la sede con su saldo, para la pantalla de caja (primero las que pidieron la cuenta). */
export async function openAccounts(actor: Actor) {
  requirePermission(actor, 'cash.operate');
  const rows = await query<{ id: string; tableNumber: string; zone: string; status: string; guests: number; openedAt: Date; subtotal: string; discounts: string; paid: string }>(
    `SELECT ts.id, t.number AS "tableNumber", t.zone, ts.status, ts.guests, ts.opened_at AS "openedAt",
            (SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items WHERE session_id = ts.id AND voided_at IS NULL) AS subtotal,
            (SELECT COALESCE(sum(amount), 0) FROM session_discounts WHERE session_id = ts.id AND voided_at IS NULL) AS discounts,
            (SELECT COALESCE(sum(amount), 0) FROM payments WHERE session_id = ts.id AND reversed_at IS NULL) AS paid
       FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
      WHERE ts.location_id = $1 AND ts.business_id = $2 AND ts.status <> 'closed'
      ORDER BY (ts.status = 'bill') DESC, ts.bill_at, ts.opened_at`,
    [actor.locationId, actor.businessId],
  );
  return rows.map((r) => {
    const total = Math.max(0, Number(r.subtotal) - Number(r.discounts));
    return { id: r.id, tableNumber: r.tableNumber, zone: r.zone, status: r.status, guests: r.guests, openedAt: r.openedAt, total, paid: Number(r.paid), balance: total - Number(r.paid) };
  });
}

/** La precuenta que pide el cliente: la puede ver e imprimir quien toma pedidos. */
export async function getBill(actor: Actor, sessionId: string) {
  requirePermission(actor, 'orders.take');
  if (!isUuid(sessionId)) return null;
  return loadCheckout(pooled(), actor, sessionId);
}
