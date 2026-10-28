// Mesas del día (28 oct 2026, pedido de Rigoberto: «una parte que muestre todas las mesas cobradas, la lista de todas las
// mesas por cobrar y quién las atendió»). Por cobrar: todas las cuentas abiertas de la sede con algún pedido, sin importar
// el día. Cobradas: las cerradas en el día (hora de la sede). Quién atendió: quien abrió la mesa y quienes mandaron pedidos.
import { query } from './db';
import { METHODS, type Method } from './cash';
import { hasOrders, requirePermission, type Actor } from './store';

export type Waiter = { id: string; name: string };
export type TableAccount = {
  id: string;
  tableNumber: string;
  zone: string;
  status: 'open' | 'bill' | 'closed';
  guests: number;
  openedAt: Date;
  closedAt: Date | null;
  /** Quien abrió la mesa primero y después quienes mandaron pedidos. */
  waiters: Waiter[];
  /** Quienes registraron los pagos (cajera o mesero). */
  collectedBy: string[];
  methods: Method[];
  total: number;
  paid: number;
  tip: number;
  balance: number;
};

export type WaiterSummary = Waiter & { collected: number; collectedTotal: number; pending: number; pendingTotal: number };

type Row = {
  id: string;
  tableNumber: string;
  zone: string;
  status: TableAccount['status'];
  guests: number;
  openedAt: Date;
  closedAt: Date | null;
  openerId: string;
  openerName: string;
  senders: Waiter[] | null;
  collectedBy: string[] | null;
  methods: string[] | null;
  subtotal: string;
  discounts: string;
  paid: string;
  tip: string;
};

export function toAccount(r: Row): TableAccount {
  const waiters: Waiter[] = [{ id: r.openerId, name: r.openerName }];
  for (const s of r.senders ?? []) if (!waiters.some((w) => w.id === s.id)) waiters.push(s);
  const total = Math.max(0, Number(r.subtotal) - Number(r.discounts));
  const paid = Number(r.paid);
  return {
    id: r.id,
    tableNumber: r.tableNumber,
    zone: r.zone,
    status: r.status,
    guests: r.guests,
    openedAt: r.openedAt,
    closedAt: r.closedAt,
    waiters,
    collectedBy: r.collectedBy ?? [],
    methods: METHODS.filter((m) => (r.methods ?? []).includes(m)),
    total,
    paid,
    tip: Number(r.tip),
    balance: Math.max(0, total - paid),
  };
}

/** Por mesero (el primero que atendió cada mesa): cuántas mesas cobradas y por cobrar, y cuánto suman. */
export function summarizeByWaiter(pending: TableAccount[], collected: TableAccount[]): WaiterSummary[] {
  const map = new Map<string, WaiterSummary>();
  const get = (w: Waiter) => map.get(w.id) ?? map.set(w.id, { ...w, collected: 0, collectedTotal: 0, pending: 0, pendingTotal: 0 }).get(w.id)!;
  for (const a of collected) {
    const s = get(a.waiters[0]);
    s.collected += 1;
    s.collectedTotal += a.paid;
  }
  for (const a of pending) {
    const s = get(a.waiters[0]);
    s.pending += 1;
    s.pendingTotal += a.balance;
  }
  return [...map.values()].sort((a, b) => b.collectedTotal + b.pendingTotal - (a.collectedTotal + a.pendingTotal) || a.name.localeCompare(b.name, 'es'));
}

/** Las mesas por cobrar (abiertas ahora) y las cobradas el día `date` (AAAA-MM-DD en la hora de la sede). */
export async function tableAccounts(actor: Actor, date: string, timeZone: string) {
  requirePermission(actor, 'cash.operate');
  const rows = await query<Row>(
    `SELECT ts.id, t.number AS "tableNumber", t.zone, ts.status, ts.guests, ts.opened_at AS "openedAt", ts.closed_at AS "closedAt",
            ts.opened_by AS "openerId", o.name AS "openerName",
            (SELECT json_agg(json_build_object('id', x.id, 'name', x.name) ORDER BY x.first)
               FROM (SELECT s.id, s.name, min(r.sent_at) AS first FROM order_rounds r JOIN staff s ON s.id = r.sent_by
                      WHERE r.session_id = ts.id GROUP BY s.id, s.name) x) AS senders,
            (SELECT array_agg(DISTINCT s.name) FROM payments p JOIN staff s ON s.id = p.created_by
              WHERE p.session_id = ts.id AND p.reversed_at IS NULL) AS "collectedBy",
            (SELECT array_agg(DISTINCT p.method) FROM payments p WHERE p.session_id = ts.id AND p.reversed_at IS NULL) AS methods,
            (SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items WHERE session_id = ts.id AND voided_at IS NULL) AS subtotal,
            (SELECT COALESCE(sum(amount), 0) FROM session_discounts WHERE session_id = ts.id AND voided_at IS NULL) AS discounts,
            (SELECT COALESCE(sum(amount), 0) FROM payments WHERE session_id = ts.id AND reversed_at IS NULL) AS paid,
            (SELECT COALESCE(sum(tip), 0) FROM payments WHERE session_id = ts.id AND reversed_at IS NULL) AS tip
       FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id JOIN staff o ON o.id = ts.opened_by
      WHERE ts.location_id = $1 AND ts.business_id = $2 AND ${hasOrders('ts')}
        AND (ts.status <> 'closed'
             OR (ts.closed_at >= ($3::date)::timestamp AT TIME ZONE $4 AND ts.closed_at < ($3::date + 1)::timestamp AT TIME ZONE $4))
      ORDER BY ts.closed_at DESC NULLS FIRST, (ts.status = 'bill') DESC, ts.opened_at`,
    [actor.locationId, actor.businessId, date, timeZone],
  );
  const all = rows.map(toAccount);
  const pending = all.filter((a) => a.status !== 'closed');
  const collected = all.filter((a) => a.status === 'closed');
  return { pending, collected, waiters: summarizeByWaiter(pending, collected) };
}
