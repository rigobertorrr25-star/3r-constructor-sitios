// Módulo 04: caja y pagos. Turnos de caja, cobro en partes y con varios medios, propina, descuentos y cierre de caja.
// Nada se borra: un pago equivocado se reversa con motivo, un descuento se anula, una salida de plata se registra.
import { netAmountSql, payInDrawerSql } from './drawer-sql';
export { payInDrawerSql };
import { randomUUID } from 'node:crypto';
import { formatCop } from './format';
import { cashCountTotal, cleanCashCount, type CashCount } from './cash-count';
import { pooled, query, transaction, type Db } from './db';
import { createInvoice, voidInvoiceFor } from './invoices';
import { can } from './permissions';
import { AppError, audit, hasOrders, isUuid, releaseEmptySessions, requirePermission, type Actor } from './store';

export const METHODS = ['cash', 'card', 'transfer'] as const;
export const isMethod = (v: string): v is Method => (METHODS as readonly string[]).includes(v);
export type Method = (typeof METHODS)[number];
export const METHOD_LABEL: Record<Method, string> = { cash: 'Efectivo', card: 'Datáfono', transfer: 'Transferencia' };

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

export type Shift = {
  id: string;
  openedAt: Date;
  openedBy: string;
  openingAmount: number;
  closedAt: Date | null;
  closedBy: string | null;
  expectedCash: number | null;
  countedCash: number | null;
  notes: string | null;
  /** Cómo se repartió el efectivo al cerrar (formulario diario de Rigoberto): sobres y caja fuerte. */
  envelopeKitchen: number;
  envelopeBar: number;
  safeAmount: number;
  /** Arqueo: cuántos billetes y monedas de cada uno se contaron (null si se escribió el total a mano). */
  cashCount: CashCount | null;
  /** Día en que se abrió (AAAA-MM-DD, hora de la sede) y qué turno fue ese día: 1, 2… (dos cajeras al día, 30 oct 2026). */
  day: string;
  dayNumber: number;
  /** Si el dueño o el administrador corrigió el cierre después (4 nov 2026). */
  correctedBy: string | null;
  correctedAt: Date | null;
  correctionReason: string | null;
  /** Dólares que debían estar al cerrar y los que se contaron (8 nov 2026); null sin dólares. */
  expectedUsd: number | null;
  countedUsd: number | null;
  /** Se cuenta con la propina adentro y después se descuenta (9 nov 2026); false en las cajas de antes. */
  tipsInDrawer: boolean;
};


const SHIFT_SELECT = `SELECT c.id, c.opened_at AS "openedAt", o.name AS "openedBy", c.opening_amount AS "openingAmount", c.closed_at AS "closedAt",
       x.name AS "closedBy", c.expected_cash AS "expectedCash", c.counted_cash AS "countedCash", c.notes,
       c.envelope_kitchen AS "envelopeKitchen", c.envelope_bar AS "envelopeBar", c.safe_amount AS "safeAmount", c.cash_count AS "cashCount",
       to_char(c.opened_at AT TIME ZONE b.timezone, 'YYYY-MM-DD') AS day,
       (SELECT count(*)::int FROM cash_shifts y
         WHERE y.location_id = c.location_id AND y.staff_id IS NOT DISTINCT FROM c.staff_id AND y.opened_at <= c.opened_at
           AND (y.opened_at AT TIME ZONE b.timezone)::date = (c.opened_at AT TIME ZONE b.timezone)::date) AS "dayNumber",
       z.name AS "correctedBy", c.corrected_at AS "correctedAt", c.correction_reason AS "correctionReason",
       c.expected_usd AS "expectedUsd", c.counted_usd AS "countedUsd", c.tips_in_drawer AS "tipsInDrawer"
  FROM cash_shifts c JOIN businesses b ON b.id = c.business_id JOIN staff o ON o.id = c.opened_by LEFT JOIN staff x ON x.id = c.closed_by
  LEFT JOIN staff z ON z.id = c.corrected_by`;

type ShiftRow = Omit<Shift, 'openingAmount' | 'expectedCash' | 'countedCash' | 'envelopeKitchen' | 'envelopeBar' | 'safeAmount'> & {
  openingAmount: string;
  expectedCash: string | null;
  countedCash: string | null;
  envelopeKitchen: string;
  envelopeBar: string;
  safeAmount: string;
};
const toShift = (r: ShiftRow): Shift => ({
  ...r,
  openingAmount: Number(r.openingAmount),
  envelopeKitchen: Number(r.envelopeKitchen),
  envelopeBar: Number(r.envelopeBar),
  safeAmount: Number(r.safeAmount),
  expectedCash: r.expectedCash === null ? null : Number(r.expectedCash),
  countedCash: r.countedCash === null ? null : Number(r.countedCash),
});

export async function getOpenShift(actor: Actor): Promise<Shift | null> {
  const rows = await query<ShiftRow>(`${SHIFT_SELECT} WHERE c.location_id = $1 AND c.business_id = $2 AND c.closed_at IS NULL AND c.staff_id IS NULL`, [actor.locationId, actor.businessId]);
  return rows[0] ? toShift(rows[0]) : null;
}

export async function listShifts(actor: Actor, limit = 15): Promise<Shift[]> {
  requirePermission(actor, 'cash.operate');
  const rows = await query<ShiftRow>(`${SHIFT_SELECT} WHERE c.location_id = $1 AND c.business_id = $2 AND c.staff_id IS NULL ORDER BY c.opened_at DESC LIMIT $3`, [
    actor.locationId,
    actor.businessId,
    limit,
  ]);
  return rows.map(toShift);
}

/**
 * Lo que quedó en la caja al cerrar el turno anterior de la sede (lo contado menos sobres y caja fuerte): la base que
 * recibe la cajera del turno siguiente (dos cajeras al día, 30 oct 2026). Null si nunca se ha cerrado una caja.
 */
export async function drawerLeftByLastShift(actor: Actor): Promise<{ amount: number; closedBy: string; closedAt: Date } | null> {
  requirePermission(actor, 'cash.operate');
  const row = (
    await query<{ amount: string; closedBy: string; closedAt: Date }>(
      `SELECT GREATEST(0, c.counted_cash - c.envelope_kitchen - c.envelope_bar - c.safe_amount) AS amount, x.name AS "closedBy", c.closed_at AS "closedAt"
         FROM cash_shifts c JOIN staff x ON x.id = c.closed_by
        WHERE c.location_id = $1 AND c.business_id = $2 AND c.staff_id IS NULL AND c.closed_at IS NOT NULL
        ORDER BY c.closed_at DESC LIMIT 1`,
      [actor.locationId, actor.businessId],
    )
  )[0];
  return row ? { amount: Number(row.amount), closedBy: row.closedBy, closedAt: row.closedAt } : null;
}

/** Los turnos de caja de la sede abiertos el día `date` (AAAA-MM-DD en la hora de la sede), en orden, con su cuadre. */
export async function dayShifts(actor: Actor, date: string): Promise<ShiftSummary[]> {
  requirePermission(actor, 'cash.operate');
  const ids = await query<{ id: string }>(
    `SELECT c.id FROM cash_shifts c JOIN businesses b ON b.id = c.business_id
      WHERE c.location_id = $1 AND c.business_id = $2 AND c.staff_id IS NULL AND (c.opened_at AT TIME ZONE b.timezone)::date = $3::date
      ORDER BY c.opened_at`,
    [actor.locationId, actor.businessId, date],
  );
  const all = await Promise.all(ids.map((r) => loadShiftSummary(actor, r.id)));
  return all.filter((s): s is ShiftSummary => s !== null);
}

export async function openShift(actor: Actor, openingAmount: number) {
  requirePermission(actor, 'cash.operate');
  requireAmount(openingAmount, 'Base de caja', { allowZero: true });
  // Negocio con «Caja sin base» (Azul Caribe, 8 nov 2026): siempre abre en $0.
  if ((await workMode(actor.businessId)).noBase) openingAmount = 0;
  try {
    return await transaction(async (db) => {
      const res = await db.query<{ id: string }>(
        `INSERT INTO cash_shifts (business_id, location_id, opened_by, opening_amount, tips_in_drawer) VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
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
      `SELECT id, opening_amount AS "openingAmount" FROM cash_shifts WHERE location_id = $1 AND business_id = $2 AND closed_at IS NULL AND staff_id IS NULL FOR UPDATE`,
      [actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!shift) throw new AppError('CONFLICT', 'La caja está cerrada. Ábrela para cobrar.');
  return shift;
}

/** Forma de trabajo del negocio (las opciones que prende el dueño en Sedes). */
export async function workMode(businessId: string): Promise<{ waitersCollect: boolean; barOnly: boolean; suggestedTip: number; trackPrep: boolean; cashOnly: boolean; usdRate: number; noBase: boolean; tipsIncluded: boolean }> {
  const row = (
    await query<{ waitersCollect: boolean; barOnly: boolean; suggestedTip: number; trackPrep: boolean; cashOnly: boolean; usdRate: number; noBase: boolean; tipsIncluded: boolean }>(
      `SELECT waiters_collect AS "waitersCollect", bar_only AS "barOnly", suggested_tip AS "suggestedTip", track_prep AS "trackPrep", cash_only AS "cashOnly", usd_rate AS "usdRate", no_base AS "noBase", tips_included AS "tipsIncluded" FROM businesses WHERE id = $1`,
      [businessId],
    )
  )[0];
  return row ?? { waitersCollect: false, barOnly: false, suggestedTip: 10, trackPrep: true, cashOnly: false, usdRate: 3000, noBase: false, tipsIncluded: false };
}

/**
 * La cuenta abierta de un mesero en la sede (bares sin cajero). Si no tiene, se abre sola con base cero: el mesero
 * no recibe base, solo junta lo que cobra.
 */
export async function lockWaiterShift(db: Db, actor: Actor, staffId: string) {
  const find = () =>
    db.query<{ id: string; openingAmount: string }>(
      `SELECT id, opening_amount AS "openingAmount" FROM cash_shifts
        WHERE location_id = $1 AND business_id = $2 AND staff_id = $3 AND closed_at IS NULL FOR UPDATE`,
      [actor.locationId, actor.businessId, staffId],
    );
  const open = (await find()).rows[0];
  if (open) return open;
  await db.query(
    `INSERT INTO cash_shifts (business_id, location_id, opened_by, opening_amount, staff_id) VALUES ($1, $2, $3, 0, $3)
     ON CONFLICT (location_id, staff_id) WHERE closed_at IS NULL AND staff_id IS NOT NULL DO NOTHING`,
    [actor.businessId, actor.locationId, staffId],
  );
  return (await find()).rows[0];
}

/**
 * Quién puede cobrar una mesa: la caja (dueño, administrador, cajero) o, si cada mesero cobra, el mesero que la abrió.
 * Una mesa que abrió alguien que no es mesero (el dueño, el administrador) la puede cobrar cualquier mesero.
 */
function waiterMayCollect(actor: Actor, openedBy: string, openedByRole: string | null) {
  return actor.role === 'waiter' && (openedBy === actor.id || openedByRole !== 'waiter');
}

async function assertMayCollect(actor: Actor, openedBy: string, openedByRole: string | null, waitersCollect: boolean) {
  if (can(actor.role, 'cash.operate')) return;
  if (waitersCollect && waiterMayCollect(actor, openedBy, openedByRole)) return;
  throw new AppError('FORBIDDEN', waitersCollect && actor.role === 'waiter' ? 'Solo puedes cobrar las mesas que tú abriste.' : 'No tienes permiso para hacer esto.');
}

/** En la cuenta de qué mesero entra un pago: la del mesero que abrió la mesa; si no la abrió un mesero, la de quien cobra. */
function creditedWaiter(actor: Actor, openedBy: string, openedByRole: string | null) {
  return openedByRole !== 'waiter' && actor.role === 'waiter' ? actor.id : openedBy;
}

/** Para la pantalla del mesero: si puede cobrar esa mesa él mismo. */
export async function canCollectSession(actor: Actor, sessionId: string) {
  if (can(actor.role, 'cash.operate')) return true;
  if (actor.role !== 'waiter' || !isUuid(sessionId)) return false;
  const [mode, rows] = await Promise.all([
    workMode(actor.businessId),
    query<{ openedBy: string; openedByRole: string | null }>(
      `SELECT ts.opened_by AS "openedBy", s.role AS "openedByRole" FROM table_sessions ts LEFT JOIN staff s ON s.id = ts.opened_by
        WHERE ts.id = $1 AND ts.business_id = $2 AND ts.location_id = $3`,
      [
      sessionId,
      actor.businessId,
      actor.locationId,
    ]),
  ]);
  return mode.waitersCollect && Boolean(rows[0]) && waiterMayCollect(actor, rows[0].openedBy, rows[0].openedByRole);
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

/** Efectivo que debería haber: base + ventas en efectivo − propinas por datáfono o transferencia (se pagan de la caja) + entradas − salidas. */
async function expectedCash(db: Db, shiftId: string, opening: number) {
  const row = (
    await db.query<{ sales: string; moves: string }>(
      `SELECT
         (SELECT COALESCE(sum(${payInDrawerSql('(SELECT tips_in_drawer FROM cash_shifts WHERE id = $1)')}), 0) FROM payments WHERE shift_id = $1 AND reversed_at IS NULL) AS sales,
         (SELECT COALESCE(sum(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) FROM cash_movements WHERE shift_id = $1 AND voided_at IS NULL) AS moves`,
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
  /** Propina que se saca de la caja después de contar (toda la cobrada si la caja cuenta con la propina adentro; si no, 0). */
  tipToDeliver: number;
  /** Lo que queda de la venta en efectivo, sin base y ya sin propina: esperado − base − propina para entregar. */
  salesCash: number;
  /** Dólares recibidos en efectivo en el turno y lo que valían en pesos al cobrar (8 nov 2026). */
  usd: { dollars: number; pesos: number };
  tablesClosed: number;
  movements: { id: string; kind: 'in' | 'out'; amount: number; reason: string; createdBy: string; createdAt: Date }[];
};

/** Cuadre de un turno (abierto o cerrado). */
export async function shiftSummary(actor: Actor, shiftId: string): Promise<ShiftSummary | null> {
  requirePermission(actor, 'cash.operate');
  return loadShiftSummary(actor, shiftId);
}

/** El resumen de una caja o de la cuenta de un mesero, sin revisar permisos (quien llama ya los revisó). */
export async function loadShiftSummary(actor: Actor, shiftId: string): Promise<ShiftSummary | null> {
  if (!isUuid(shiftId)) return null;
  const row = (await query<ShiftRow>(`${SHIFT_SELECT} WHERE c.id = $1 AND c.location_id = $2 AND c.business_id = $3`, [shiftId, actor.locationId, actor.businessId]))[0];
  if (!row) return null;
  const shift = toShift(row);
  const [methods, extra, movements] = await Promise.all([
    query<{ method: Method; amount: string; tip: string; count: number; usd: string; usdPesos: string }>(
      `SELECT method, sum(${netAmountSql()}) AS amount, sum(tip) AS tip, count(*)::int AS count,
              COALESCE(sum(usd_received), 0) AS usd, COALESCE(sum(usd_received::bigint * usd_rate), 0) AS "usdPesos"
         FROM payments WHERE shift_id = $1 AND reversed_at IS NULL GROUP BY method`,
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
         FROM cash_movements m JOIN staff s ON s.id = m.created_by WHERE m.shift_id = $1 AND m.voided_at IS NULL
          -- Una factura eliminada no salió de la caja: su salida y la entrada que la devolvió se cancelan y no se muestran
          -- (5 nov 2026, Rigoberto: «me aparece que salió de caja 127.000 y esa plata no salió»). El esperado es el mismo.
          AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.cash_movement_id = m.id AND e.voided_at IS NOT NULL)
          AND NOT (m.kind = 'in' AND m.reason LIKE 'Anulación del gasto:%')
        ORDER BY m.created_at`,
      [shiftId],
    ),
  ]);
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, { amount: 0, tip: 0, count: 0 }])) as ShiftSummary['byMethod'];
  for (const m of methods) byMethod[m.method] = { amount: Number(m.amount), tip: Number(m.tip), count: m.count };
  const usd = { dollars: methods.reduce((s, m) => s + Number(m.usd), 0), pesos: methods.reduce((s, m) => s + Number(m.usdPesos), 0) };
  const moves = movements.map((m) => ({ ...m, amount: Number(m.amount) }));
  const movementsIn = moves.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0);
  const movementsOut = moves.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0);
  const tips = METHODS.reduce((s, m) => s + byMethod[m].tip, 0);
  const expectedCash =
    shift.openingAmount + byMethod.cash.amount - usd.pesos + (shift.tipsInDrawer ? byMethod.cash.tip : -(byMethod.card.tip + byMethod.transfer.tip)) + movementsIn - movementsOut;
  const tipToDeliver = shift.tipsInDrawer ? tips : 0;
  return {
    shift,
    byMethod,
    sales: METHODS.reduce((s, m) => s + byMethod[m].amount, 0),
    tips,
    discounts: Number(extra[0].discounts),
    voids: Number(extra[0].voids),
    reversed: Number(extra[0].reversed),
    movementsIn,
    movementsOut,
    // La propina se les entrega a los meseros de la caja: toda la cobrada (en efectivo, datáfono o transferencia) se
    // descuenta de lo esperado (5 nov 2026, pedido de Rigoberto).
    // Los pagos con dólares dejan dólares, no pesos: su valor en pesos se resta de los pesos esperados (8 nov 2026).
    // Desde el 9 nov 2026 (tipsInDrawer) se cuenta con la propina adentro: la de efectivo está en la caja y la de datáfono y
    // transferencia todavía no ha salido; después de contar se saca toda (tipToDeliver) y queda la venta (salesCash).
    expectedCash,
    tipToDeliver,
    salesCash: (shift.expectedCash ?? expectedCash) - shift.openingAmount - tipToDeliver,
    usd,
    tablesClosed: extra[0].tables,
    movements: moves,
  };
}

/**
 * Corrige un cierre ya hecho (4 nov 2026, pedido de Rigoberto: «una empleada mandó un cierre por error y le faltó dinero
 * por ingresar»). Solo dueño o administrador, siempre con motivo. Lo esperado no cambia (sale de las ventas); cambia lo
 * contado y cómo se repartió. Si no se escribe un arqueo nuevo, el anterior se quita (ya no sumaría lo contado).
 */
export async function correctClosing(
  actor: Actor,
  shiftId: string,
  input: { countedCash: number; reason: string; envelopeKitchen?: number; envelopeBar?: number; safeAmount?: number; cashCount?: unknown },
) {
  requirePermission(actor, 'cash.correct');
  if (!isUuid(shiftId)) throw new AppError('NOT_FOUND', 'No encontramos ese cierre.');
  const why = requireText(input.reason, 'Motivo de la corrección', 3, 300);
  requireAmount(input.countedCash, 'Efectivo contado', { allowZero: true });
  const envelopeKitchen = input.envelopeKitchen ?? 0;
  const envelopeBar = input.envelopeBar ?? 0;
  const safeAmount = input.safeAmount ?? 0;
  requireAmount(envelopeKitchen, 'Sobre para la cocina', { allowZero: true });
  requireAmount(envelopeBar, 'Sobre para el bar', { allowZero: true });
  requireAmount(safeAmount, 'Caja fuerte', { allowZero: true });
  const cashCount = cleanCashCount(input.cashCount);
  if (cashCount && cashCountTotal(cashCount) !== input.countedCash)
    throw new AppError('INVALID', `El arqueo suma ${money(cashCountTotal(cashCount))} y el efectivo contado dice ${money(input.countedCash)}: revísalos.`);
  if (envelopeKitchen + envelopeBar + safeAmount > input.countedCash)
    throw new AppError('INVALID', `Los sobres y la caja fuerte suman ${money(envelopeKitchen + envelopeBar + safeAmount)}: es más de lo contado (${money(input.countedCash)}).`);
  await transaction(async (db) => {
    const before = (
      await db.query<{ closedAt: Date | null; expected: string; counted: string; kitchen: string; bar: string; safe: string }>(
        `SELECT closed_at AS "closedAt", expected_cash AS expected, counted_cash AS counted, envelope_kitchen AS kitchen, envelope_bar AS bar, safe_amount AS safe
           FROM cash_shifts WHERE id = $1 AND location_id = $2 AND business_id = $3 FOR UPDATE`,
        [shiftId, actor.locationId, actor.businessId],
      )
    ).rows[0];
    if (!before) throw new AppError('NOT_FOUND', 'No encontramos ese cierre.');
    if (!before.closedAt) throw new AppError('CONFLICT', 'Esa caja sigue abierta: se corrige al cerrarla.');
    await db.query(
      `UPDATE cash_shifts SET counted_cash = $2, envelope_kitchen = $3, envelope_bar = $4, safe_amount = $5, cash_count = $6,
              corrected_by = $7, corrected_at = now(), correction_reason = $8 WHERE id = $1`,
      [shiftId, input.countedCash, envelopeKitchen, envelopeBar, safeAmount, cashCount ? JSON.stringify(cashCount) : null, actor.id, why],
    );
    const expected = Number(before.expected);
    const diff = input.countedCash - expected;
    await audit(db, actor, {
      action: 'cash.correct',
      entity: 'cash_shift',
      entityId: shiftId,
      summary: `Corrigió un cierre de caja: contado ${money(Number(before.counted))} → ${money(input.countedCash)}${diff === 0 ? ' (cuadra)' : diff > 0 ? ` (sobran ${money(diff)})` : ` (faltan ${money(-diff)})`}`,
      reason: why,
      data: {
        before: { counted: Number(before.counted), envelopeKitchen: Number(before.kitchen), envelopeBar: Number(before.bar), safeAmount: Number(before.safe) },
        after: { counted: input.countedCash, envelopeKitchen, envelopeBar, safeAmount },
      },
    });
  });
}

/** Cierra la caja: se cuenta la plata y queda la diferencia contra lo esperado. */
export async function closeShift(
  actor: Actor,
  countedCash: number,
  notes?: string,
  split: { envelopeKitchen?: number; envelopeBar?: number; safeAmount?: number; cashCount?: unknown; countedUsd?: number | null } = {},
) {
  requirePermission(actor, 'cash.operate');
  if (split.countedUsd != null && (!Number.isInteger(split.countedUsd) || split.countedUsd < 0 || split.countedUsd > 1_000_000))
    throw new AppError('INVALID', 'Dólares contados: escribe cuántos dólares hay en la caja.');
  requireAmount(countedCash, 'Efectivo contado', { allowZero: true });
  const why = notes?.trim() ? requireText(notes, 'Observaciones', 2, 1500) : null;
  // El efectivo contado se reparte en sobres y caja fuerte; lo que sobra queda en la caja. No se puede repartir más de lo contado.
  const envelopeKitchen = split.envelopeKitchen ?? 0;
  const envelopeBar = split.envelopeBar ?? 0;
  const safeAmount = split.safeAmount ?? 0;
  requireAmount(envelopeKitchen, 'Sobre para la cocina', { allowZero: true });
  requireAmount(envelopeBar, 'Sobre para el bar', { allowZero: true });
  requireAmount(safeAmount, 'Caja fuerte', { allowZero: true });
  // Con arqueo, lo contado tiene que ser la suma de los billetes y monedas.
  const cashCount = cleanCashCount(split.cashCount);
  if (cashCount && cashCountTotal(cashCount) !== countedCash)
    throw new AppError('INVALID', `El arqueo suma ${money(cashCountTotal(cashCount))} y el efectivo contado dice ${money(countedCash)}: revísalos.`);
  if (envelopeKitchen + envelopeBar + safeAmount > countedCash)
    throw new AppError('INVALID', `Los sobres y la caja fuerte suman ${money(envelopeKitchen + envelopeBar + safeAmount)}: es más de lo contado (${money(countedCash)}).`);
  return transaction(async (db) => {
    const shift = await lockOpenShift(db, actor);
    const expected = await expectedCash(db, shift.id, Number(shift.openingAmount));
    const diff = countedCash - expected;
    // Dólares recibidos en el turno: si hubo, se cuentan aparte (8 nov 2026).
    const usdIn = Number(
      (await db.query<{ usd: string }>(`SELECT COALESCE(sum(usd_received), 0) AS usd FROM payments WHERE shift_id = $1 AND reversed_at IS NULL`, [shift.id])).rows[0].usd,
    );
    if (usdIn && split.countedUsd == null) throw new AppError('INVALID', `En este turno se recibieron US$ ${usdIn}: escribe cuántos dólares hay en la caja.`);
    const countedUsd = usdIn || split.countedUsd ? (split.countedUsd ?? 0) : null;
    await db.query(
      `UPDATE cash_shifts SET closed_at = now(), closed_by = $2, expected_cash = $3, counted_cash = $4, notes = $5,
              envelope_kitchen = $6, envelope_bar = $7, safe_amount = $8, cash_count = $9, expected_usd = $10, counted_usd = $11 WHERE id = $1`,
      [shift.id, actor.id, expected, countedCash, why, envelopeKitchen, envelopeBar, safeAmount, cashCount ? JSON.stringify(cashCount) : null, usdIn || countedUsd ? usdIn : null, countedUsd],
    );
    await audit(db, actor, {
      action: 'cash.close',
      entity: 'cash_shift',
      entityId: shift.id,
      summary: `Cerró la caja: esperado ${money(expected)}, contado ${money(countedCash)}${diff === 0 ? ' (cuadra)' : diff > 0 ? ` (sobran ${money(diff)})` : ` (faltan ${money(-diff)})`}${countedUsd !== null ? `; dólares: esperados US$ ${usdIn}, contados US$ ${countedUsd}` : ''}`,
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
  if (!can(actor.role, 'cash.operate')) {
    if (!(await canCollectSession(actor, sessionId))) requirePermission(actor, 'cash.operate');
  }
  if (!isUuid(sessionId)) return null;
  return loadCheckout(pooled(), actor, sessionId);
}

async function lockSessionForCash(db: Db, actor: Actor, sessionId: string) {
  if (!isUuid(sessionId)) throw new AppError('NOT_FOUND', 'No encontramos esa cuenta.');
  const row = (
    await db.query<{ id: string; status: string; number: string; tableId: string; openedBy: string; openedByRole: string | null }>(
      `SELECT ts.id, ts.status, t.number, ts.table_id AS "tableId", ts.opened_by AS "openedBy",
              (SELECT role FROM staff WHERE id = ts.opened_by) AS "openedByRole"
         FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
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
    // Si el descuento deja la cuenta en $0 (cortesía del 100 %, p. ej. un jefe; 3 nov 2026) no queda nada por cobrar y
    // ningún pago la cerraría: se cierra aquí, como cuando el último pago deja el saldo en cero.
    if (amount === checkout.balance) await closeZeroInTx(db, actor, sessionId, session.number);
    return res.rows[0].id;
  });
}

async function closeZeroInTx(db: Db, actor: Actor, sessionId: string, number: string) {
  await db.query(`UPDATE table_sessions SET status = 'closed', closed_at = now(), closed_by = $2 WHERE id = $1`, [sessionId, actor.id]);
  await audit(db, actor, { action: 'table.close', entity: 'table_session', entityId: sessionId, summary: `Cerró la mesa ${number}: la cuenta quedó en $0` });
}

/** Cierra una mesa que ya quedó en $0 y abierta (las de antes del 3 nov 2026, o si algo quedó a medias). */
export async function closeZeroBalance(actor: Actor, sessionId: string) {
  requirePermission(actor, 'cash.operate');
  await transaction(async (db) => {
    const session = await lockSessionForCash(db, actor, sessionId);
    if (session.status === 'closed') throw new AppError('CONFLICT', 'Esa mesa ya se cerró.');
    const checkout = (await loadCheckout(db, actor, sessionId))!;
    if (checkout.balance > 0) throw new AppError('CONFLICT', `La mesa ${session.number} tiene saldo por pagar: se cierra cobrando.`);
    await closeZeroInTx(db, actor, sessionId, session.number);
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

export type PaymentInput = { method: string; amount: number; tip?: number; received?: number | null; reference?: string; clientKey: string; usdReceived?: number | null };

/**
 * Registra un pago (puede ser una parte de la cuenta). Cuando la cuenta queda en cero, la mesa se cierra sola.
 * Si llega dos veces el mismo `clientKey`, no cobra dos veces.
 */
export async function pay(actor: Actor, sessionId: string, input: PaymentInput) {
  const mode = await workMode(actor.businessId);
  // Bar sin cajero: el mesero cobra sus propias mesas (se revisa abajo, con la mesa ya bloqueada).
  if (!(mode.waitersCollect && actor.role === 'waiter')) requirePermission(actor, 'cash.operate');
  if (!(METHODS as readonly string[]).includes(input.method)) throw new AppError('INVALID', 'Elige cómo paga.');
  const method = input.method as Method;
  if (mode.cashOnly && method !== 'cash') throw new AppError('INVALID', 'Este negocio cobra solo en efectivo.');
  // Pago con dólares: solo en efectivo; se pasan a pesos al cambio del negocio y las vueltas salen en pesos.
  const usd = input.usdReceived ? Number(input.usdReceived) : 0;
  if (usd && (method !== 'cash' || !Number.isInteger(usd) || usd < 1 || usd > 100_000)) throw new AppError('INVALID', 'Dólares: escribe cuántos dólares entregó el cliente.');
  const usdRate = usd ? mode.usdRate : null;
  if (!isUuid(input.clientKey)) throw new AppError('INVALID', 'Pago sin identificador. Recarga la página.');
  requireAmount(input.amount, 'Valor a pagar');
  const tip = input.tip ? requireAmount(input.tip, 'Propina', { allowZero: true }) : 0;
  // Propina incluida en lo que paga el cliente (9 nov 2026): no se suma al cobro; sale de adentro.
  const included = mode.tipsIncluded;
  if (included && tip > input.amount) throw new AppError('INVALID', 'La propina no puede ser mayor que lo que se cobra.');
  const extra = included ? 0 : tip;
  const reference = input.reference?.trim() ? requireText(input.reference, 'Referencia', 2, 60) : null;
  let received: number | null = null;
  let change: number | null = null;
  if (method === 'cash') {
    received = usd ? usd * mode.usdRate : input.received ? requireAmount(input.received, 'Efectivo recibido') : input.amount + extra;
    if (received < input.amount + extra) throw new AppError('INVALID', `Recibiste ${money(received)}: no alcanza para ${money(input.amount + extra)}.`);
    change = received - input.amount - extra;
  }

  const previous = await query<{ id: string }>(`SELECT id FROM payments WHERE business_id = $1 AND client_key = $2`, [actor.businessId, input.clientKey]);
  if (previous[0]) {
    const checkout = (await getCheckout(actor, sessionId))!;
    return { paymentId: previous[0].id, change, closed: checkout.session.status === 'closed', duplicate: true };
  }

  try {
    return await transaction(async (db) => {
      const session = await lockSessionForCash(db, actor, sessionId);
      await assertMayCollect(actor, session.openedBy, session.openedByRole, mode.waitersCollect);
      // Sin cajero, cada pago entra a la cuenta del mesero que abrió la mesa (aunque lo registre el administrador).
      const shift = mode.waitersCollect
        ? await lockWaiterShift(db, actor, creditedWaiter(actor, session.openedBy, session.openedByRole))
        : await lockOpenShift(db, actor);
      if (session.status === 'closed') throw new AppError('CONFLICT', 'Esa mesa ya se cerró.');
      const checkout = (await loadCheckout(db, actor, sessionId))!;
      if (checkout.balance <= 0) throw new AppError('CONFLICT', 'Esta cuenta no tiene nada por pagar.');
      if (input.amount > checkout.balance) throw new AppError('INVALID', `Falta por pagar ${money(checkout.balance)}: el pago no puede ser mayor.`);
      const res = await db.query<{ id: string }>(
        `INSERT INTO payments (business_id, location_id, session_id, shift_id, method, amount, tip, received, change_given, reference, client_key, created_by, usd_received, usd_rate, tip_included)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [actor.businessId, actor.locationId, sessionId, shift.id, method, input.amount, tip, received, change, reference, input.clientKey, actor.id, usd || null, usdRate, included],
      );
      await audit(db, actor, {
        action: 'payment.create',
        entity: 'payment',
        entityId: res.rows[0].id,
        summary: `Cobró ${money(input.amount)} en ${METHOD_LABEL[method].toLowerCase()} de la mesa ${session.number}${tip ? ` + propina ${money(tip)}` : ''}${usd ? ` (pagó US$ ${usd} a ${money(usdRate!)})` : ''}`,
      });
      const closed = input.amount === checkout.balance;
      if (closed) {
        await db.query(`UPDATE table_sessions SET status = 'closed', closed_at = now(), closed_by = $2 WHERE id = $1`, [sessionId, actor.id]);
        // Una factura por la venta completa (sin propinas, que no son ingreso del negocio).
        const tips = checkout.tips + tip;
        // Con la propina incluida en lo que pagó el cliente (9 nov 2026), la factura es por la cuenta menos esa propina.
        const inside = Number(
          (await db.query<{ t: string }>(`SELECT COALESCE(sum(tip) FILTER (WHERE tip_included), 0) AS t FROM payments WHERE session_id = $1 AND reversed_at IS NULL`, [sessionId])).rows[0].t,
        );
        await createInvoice(db, actor, { sessionId, total: checkout.total - inside, tip: tips });
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
      await releaseEmptySessions(db, { tableId: session.tableId });
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

// ───────── faltante al cerrar (29 oct 2026) ─────────
// Pedido de Rigoberto en pleno cierre: «cuando el arqueo me manda que me faltan dinero, agrega 2 opciones: dinero que se
// agarró para pagar, y las diferencias que pagaron en transferencia pero que marcaron en efectivo». Lo primero es una
// salida de caja (`addMovement`); lo segundo cambia el medio de un cobro en efectivo de la caja abierta.

/** `total`: lo que pagó el cliente (con la propina, esté incluida o sumada; 9 nov 2026). */
export type CashPayment = { id: string; tableNumber: string | null; amount: number; tip: number; total: number; createdBy: string; createdAt: Date };

/** Los cobros en efectivo (sin reversar) de la caja abierta, lo más nuevo primero. */
export async function openShiftCashPayments(actor: Actor): Promise<CashPayment[]> {
  requirePermission(actor, 'cash.operate');
  const rows = await query<{ id: string; tableNumber: string | null; amount: string; tip: string; included: boolean; createdBy: string; createdAt: Date }>(
    `SELECT p.id, t.number AS "tableNumber", p.amount, p.tip, p.tip_included AS included, s.name AS "createdBy", p.created_at AS "createdAt"
       FROM payments p
       JOIN cash_shifts c ON c.id = p.shift_id AND c.closed_at IS NULL AND c.staff_id IS NULL
       JOIN staff s ON s.id = p.created_by
       LEFT JOIN table_sessions ts ON ts.id = p.session_id
       LEFT JOIN dining_tables t ON t.id = ts.table_id
      WHERE p.location_id = $1 AND p.business_id = $2 AND p.method = 'cash' AND p.reversed_at IS NULL
      ORDER BY p.created_at DESC`,
    [actor.locationId, actor.businessId],
  );
  return rows.map((r) => ({
    id: r.id,
    tableNumber: r.tableNumber,
    amount: Number(r.amount),
    tip: Number(r.tip),
    total: Number(r.amount) + (r.included ? 0 : Number(r.tip)),
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

/**
 * Un cobro marcado en efectivo que en verdad fue por transferencia o datáfono. `amount` es cuánto fue por el otro medio:
 * todo el cobro (con su propina) cambia de medio; una parte (hasta el valor sin propina) se separa en otro pago del mismo
 * cobro, así lo cobrado no cambia y el efectivo esperado baja justo eso. Solo en la caja abierta.
 */
export async function moveCashPayment(actor: Actor, paymentId: string, input: { method: string; amount: number }) {
  requirePermission(actor, 'cash.operate');
  if (input.method !== 'transfer' && input.method !== 'card') throw new AppError('INVALID', 'Elige transferencia o datáfono.');
  const method = input.method;
  requireAmount(input.amount, 'Valor');
  if (!isUuid(paymentId)) throw new AppError('NOT_FOUND', 'No encontramos ese cobro.');
  return transaction(async (db) => {
    const shift = await lockOpenShift(db, actor);
    const p = (
      await db.query<{ id: string; sessionId: string | null; appointmentId: string | null; amount: string; tip: string; included: boolean; method: Method; reversed: boolean; shiftId: string; createdBy: string; createdAt: Date; tableNumber: string | null }>(
        `SELECT p.id, p.session_id AS "sessionId", p.appointment_id AS "appointmentId", p.amount, p.tip, p.tip_included AS included, p.method, (p.reversed_at IS NOT NULL) AS reversed,
                p.shift_id AS "shiftId", p.created_by AS "createdBy", p.created_at AS "createdAt", t.number AS "tableNumber"
           FROM payments p LEFT JOIN table_sessions ts ON ts.id = p.session_id LEFT JOIN dining_tables t ON t.id = ts.table_id
          WHERE p.id = $1 AND p.business_id = $2 AND p.location_id = $3 FOR UPDATE OF p`,
        [paymentId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!p || p.reversed) throw new AppError('NOT_FOUND', 'No encontramos ese cobro.');
    if (p.shiftId !== shift.id) throw new AppError('CONFLICT', 'Ese cobro no es de la caja abierta.');
    if (p.method !== 'cash') throw new AppError('CONFLICT', 'Ese cobro ya no está en efectivo.');
    // Con la propina incluida (9 nov 2026) el cliente pagó `amount`, con la propina adentro; una parte solo puede ser de la venta.
    const amount = Number(p.amount) - (p.included ? Number(p.tip) : 0);
    const total = Number(p.amount) + (p.included ? 0 : Number(p.tip));
    const where = p.tableNumber ? `de la mesa ${p.tableNumber}` : 'de una cita';
    const label = METHOD_LABEL[method].toLowerCase();
    if (input.amount === total) {
      await db.query(`UPDATE payments SET method = $2, received = NULL, change_given = NULL WHERE id = $1`, [p.id, method]);
    } else if (input.amount < amount) {
      await db.query(`UPDATE payments SET amount = amount - $2, received = NULL, change_given = NULL WHERE id = $1`, [p.id, input.amount]);
      await db.query(
        `INSERT INTO payments (business_id, location_id, session_id, appointment_id, shift_id, method, amount, tip, client_key, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)`,
        [actor.businessId, actor.locationId, p.sessionId, p.appointmentId, p.shiftId, method, input.amount, randomUUID(), p.createdBy, p.createdAt],
      );
    } else {
      throw new AppError('INVALID', `Ese cobro fue de ${money(total)}: escribe ${money(total)} si todo fue por ${label}, o una parte menor a ${money(amount)}.`);
    }
    await audit(db, actor, {
      action: 'payment.method',
      entity: 'payment',
      entityId: p.id,
      summary: `Pasó ${money(input.amount)} de un cobro en efectivo ${where} a ${label} (se había marcado en efectivo)`,
    });
    return { expectedCash: await expectedCash(db, shift.id, Number(shift.openingAmount)) };
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
      WHERE ts.location_id = $1 AND ts.business_id = $2 AND ts.status <> 'closed' AND ${hasOrders('ts')}
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

/**
 * Corrige una entrada o salida de efectivo de un turno, también de uno ya cerrado (6 nov 2026, pedido de Rigoberto:
 * «eliminar del cierre de ayer la salida de efectivo o que se pueda modificar el valor»). Dueño y administrador
 * (`cash.correct`), siempre con motivo. `amount` 0 la elimina (queda marcada, no se borra). Si era el pago de una factura
 * de la caja, la factura cambia con ella (o se anula). En un turno cerrado, el efectivo esperado guardado se ajusta por la
 * diferencia; lo de antes queda en la auditoría.
 */
export async function correctMovement(actor: Actor, movementId: string, input: { amount: number; reason: string }) {
  requirePermission(actor, 'cash.correct');
  if (!isUuid(movementId)) throw new AppError('NOT_FOUND', 'No encontramos ese movimiento.');
  const why = requireText(input.reason, 'Motivo', 3, 300);
  const amount = requireAmount(input.amount, 'Valor', { allowZero: true });
  await transaction(async (db) => {
    const m = (
      await db.query<{ id: string; shiftId: string; kind: 'in' | 'out'; amount: string; reason: string; voided: boolean; closed: boolean }>(
        `SELECT m.id, m.shift_id AS "shiftId", m.kind, m.amount, m.reason, (m.voided_at IS NOT NULL) AS voided, (c.closed_at IS NOT NULL) AS closed
           FROM cash_movements m JOIN cash_shifts c ON c.id = m.shift_id
          WHERE m.id = $1 AND m.business_id = $2 AND c.location_id = $3 FOR UPDATE OF m, c`,
        [movementId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!m) throw new AppError('NOT_FOUND', 'No encontramos ese movimiento.');
    if (m.voided) throw new AppError('CONFLICT', 'Ese movimiento ya estaba eliminado.');
    const before = Number(m.amount);
    if (amount === before) throw new AppError('INVALID', 'El valor es el mismo.');
    if (amount === 0) await db.query(`UPDATE cash_movements SET voided_at = now() WHERE id = $1`, [m.id]);
    else await db.query(`UPDATE cash_movements SET amount = $2 WHERE id = $1`, [m.id, amount]);
    // La factura pagada con esa salida va con ella.
    const expense = (await db.query<{ id: string }>(`SELECT id FROM expenses WHERE cash_movement_id = $1 AND voided_at IS NULL`, [m.id])).rows[0];
    if (expense) {
      if (amount === 0) await db.query(`UPDATE expenses SET voided_at = now(), voided_by = $2, void_reason = $3 WHERE id = $1`, [expense.id, actor.id, why]);
      else await db.query(`UPDATE expenses SET amount = $2 WHERE id = $1`, [expense.id, amount]);
    }
    // Una salida menor (o eliminada) deja más efectivo esperado; una entrada menor, menos.
    const delta = m.kind === 'out' ? before - amount : amount - before;
    if (m.closed) await db.query(`UPDATE cash_shifts SET expected_cash = expected_cash + $2 WHERE id = $1`, [m.shiftId, delta]);
    await audit(db, actor, {
      action: 'cash.movement.correct',
      entity: 'cash_movement',
      entityId: m.id,
      summary: `${amount === 0 ? 'Eliminó' : 'Corrigió'} la ${m.kind === 'out' ? 'salida' : 'entrada'} de efectivo «${m.reason}»: ${money(before)} → ${amount === 0 ? 'eliminada' : money(amount)}${expense ? ' (y su factura)' : ''}`,
      reason: why,
      data: { shiftId: m.shiftId, before, after: amount, delta },
    });
  });
}

/**
 * Cambia el medio de un cobro ya hecho, también de una caja cerrada (8 nov 2026, Rigoberto: «la cuenta de 293.000 se pasó
 * a transferencia, pásala a efectivo»). Dueño y administrador (`cash.correct`). En una caja cerrada, el efectivo esperado
 * guardado se ajusta: en efectivo el cobro suma su valor; por datáfono o transferencia resta su propina (se paga de la caja).
 * Un cobro hecho con dólares no se cambia.
 */
export async function changePaymentMethod(actor: Actor, paymentId: string, method: string) {
  requirePermission(actor, 'cash.correct');
  if (!isUuid(paymentId)) throw new AppError('NOT_FOUND', 'No encontramos ese pago.');
  if (!(METHODS as readonly string[]).includes(method)) throw new AppError('INVALID', 'Escoge el medio de pago.');
  const to = method as Method;
  await transaction(async (db) => {
    const p = (
      await db.query<{ id: string; method: Method; amount: string; tip: string; reversed: boolean; usd: number | null; shiftId: string; closed: boolean; table: string; tipsIn: boolean; tipIncluded: boolean }>(
        `SELECT p.id, p.method, p.amount, p.tip, (p.reversed_at IS NOT NULL) AS reversed, p.usd_received AS usd, p.shift_id AS "shiftId",
                (c.closed_at IS NOT NULL) AS closed, t.number AS table, c.tips_in_drawer AS "tipsIn", p.tip_included AS "tipIncluded"
           FROM payments p JOIN cash_shifts c ON c.id = p.shift_id JOIN table_sessions ts ON ts.id = p.session_id JOIN dining_tables t ON t.id = ts.table_id
          WHERE p.id = $1 AND p.business_id = $2 AND p.location_id = $3 FOR UPDATE OF p, c`,
        [paymentId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!p) throw new AppError('NOT_FOUND', 'No encontramos ese pago.');
    if (p.reversed) throw new AppError('CONFLICT', 'Ese pago está reversado.');
    if (p.usd) throw new AppError('CONFLICT', 'Ese cobro se hizo con dólares: no se le cambia el medio.');
    if (p.method === to) throw new AppError('INVALID', 'El pago ya está en ese medio.');
    const tip = Number(p.tip);
    // Con la propina incluida en lo cobrado (9 nov 2026), la venta es lo cobrado menos la propina.
    const amount = Number(p.amount) - (p.tipIncluded ? tip : 0);
    const inDrawer = (m: Method) => (p.tipsIn ? (m === 'cash' ? amount + tip : 0) : m === 'cash' ? amount : -tip);
    const delta = inDrawer(to) - inDrawer(p.method);
    await db.query(
      `UPDATE payments SET method = $2::varchar, received = CASE WHEN $2::varchar = 'cash' THEN amount + tip ELSE NULL END, change_given = CASE WHEN $2::varchar = 'cash' THEN 0 ELSE NULL END WHERE id = $1`,
      [p.id, to],
    );
    if (p.closed) await db.query(`UPDATE cash_shifts SET expected_cash = expected_cash + $2 WHERE id = $1`, [p.shiftId, delta]);
    await audit(db, actor, {
      action: 'payment.method',
      entity: 'payment',
      entityId: p.id,
      summary: `Cambió el cobro de ${money(amount)} de la mesa ${p.table}: de ${METHOD_LABEL[p.method].toLowerCase()} a ${METHOD_LABEL[to].toLowerCase()}${p.closed ? ` (caja ya cerrada: el esperado cambió ${delta >= 0 ? '+' : '−'}${money(Math.abs(delta))})` : ''}`,
      data: { from: p.method, to, delta },
    });
  });
}

/** Pasa a efectivo todos los cobros por datáfono o transferencia de los turnos de un día (8 nov 2026, pedido de Rigoberto). */
export async function changeDayToCash(actor: Actor, date: string) {
  requirePermission(actor, 'cash.correct');
  const shifts = await dayShifts(actor, date);
  if (!shifts.length) throw new AppError('NOT_FOUND', 'Ese día no hubo caja.');
  const rows = await query<{ id: string }>(
    `SELECT id FROM payments WHERE shift_id = ANY($1::uuid[]) AND method <> 'cash' AND reversed_at IS NULL AND usd_received IS NULL`,
    [shifts.map((s) => s.shift.id)],
  );
  for (const r of rows) await changePaymentMethod(actor, r.id, 'cash');
  return rows.length;
}

/**
 * Corrige la base de una caja (11 nov 2026, Rigoberto: «¿cómo modifico la base que tengo el día de hoy?»). Dueño y
 * administrador (`cash.correct`), con motivo; sirve con la caja abierta o ya cerrada. En una caja cerrada el efectivo
 * esperado guardado se ajusta por la diferencia, así el cuadra/sobra/falta se recalcula. Queda en la auditoría.
 */
export async function correctOpening(actor: Actor, shiftId: string, input: { amount: number; reason: string }) {
  requirePermission(actor, 'cash.correct');
  if (!isUuid(shiftId)) throw new AppError('NOT_FOUND', 'No encontramos esa caja.');
  requireAmount(input.amount, 'Base', { allowZero: true });
  const why = requireText(input.reason, 'Motivo', 3, 300);
  await transaction(async (db) => {
    const c = (
      await db.query<{ opening: string; closed: boolean }>(
        `SELECT opening_amount AS opening, (closed_at IS NOT NULL) AS closed FROM cash_shifts
          WHERE id = $1 AND business_id = $2 AND location_id = $3 AND staff_id IS NULL FOR UPDATE`,
        [shiftId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!c) throw new AppError('NOT_FOUND', 'No encontramos esa caja.');
    const before = Number(c.opening);
    if (before === input.amount) throw new AppError('INVALID', 'La base ya tiene ese valor.');
    const delta = input.amount - before;
    await db.query(
      `UPDATE cash_shifts SET opening_amount = $2, expected_cash = CASE WHEN closed_at IS NULL THEN expected_cash ELSE expected_cash + $3 END WHERE id = $1`,
      [shiftId, input.amount, delta],
    );
    await audit(db, actor, {
      action: 'cash.base',
      entity: 'cash_shift',
      entityId: shiftId,
      summary: `Corrigió la base de la caja: de ${money(before)} a ${money(input.amount)}${c.closed ? ' (caja ya cerrada: el esperado cambió igual)' : ''}`,
      reason: why,
      data: { before, after: input.amount },
    });
  });
}
