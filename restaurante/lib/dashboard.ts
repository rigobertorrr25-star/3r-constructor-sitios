// Módulo 08: tablero del dueño y radar de fugas. Todo sale de los datos reales del periodo elegido.
// El radar arranca en 100 y cada señal de posible fuga resta puntos según qué tan grave es.
import { query } from './db';
import { getStatement, type Statement } from './finance';
import { lowStock } from './inventory';
import { requirePermission, isUuid, type Actor } from './store';
import { LONG_TABLE_MINUTES, formatCop } from './format';

export type Level = 'ok' | 'watch' | 'alert';

export type Signal = {
  key: string;
  title: string;
  level: Level;
  value: string;
  detail: string;
  points: number;
  link?: string;
};

export type Dashboard = {
  statement: Statement;
  openTables: number;
  openTablesValue: number;
  expectedCash: number | null;
  prep: { station: string; avgMinutes: number | null; tickets: number }[];
  topByStation: { station: string; items: { name: string; quantity: number }[] }[];
  lowStock: { name: string; stock: number; minStock: number; unit: string }[];
  signals: Signal[];
  score: number;
};

const money = (n: number) => formatCop(n);

/** Nivel según dos umbrales (desde cuánto mirar y desde cuánto alarmarse). */
export const levelOf = (value: number, watch: number, alert: number): Level => (value >= alert ? 'alert' : value >= watch ? 'watch' : 'ok');
const pointsOf = (level: Level, watch: number, alert: number) => (level === 'alert' ? alert : level === 'watch' ? watch : 0);

/** Puntaje del radar: 100 menos los puntos de cada señal, nunca por debajo de 0. */
export const radarScore = (signals: Pick<Signal, 'points'>[]) => Math.max(0, 100 - signals.reduce((s, x) => s + x.points, 0));

export async function getDashboard(actor: Actor, range: { from: string; to: string; locationId?: string | null }, timeZone: string): Promise<Dashboard> {
  requirePermission(actor, 'finance.view');
  const statement = await getStatement(actor, range, timeZone);
  const scope = statement.scope;
  const p = [actor.businessId, range.from, range.to, timeZone, scope];
  const inRange = (col: string) => `${col} >= ($2::date)::timestamp AT TIME ZONE $4 AND ${col} < ($3::date + 1)::timestamp AT TIME ZONE $4`;
  const loc = (col: string) => `($5::uuid IS NULL OR ${col} = $5)`;

  const [open, cash, prep, top, voids, overDiscount, shortages, reversed, manualClose, shifts, locks, slowTickets] = await Promise.all([
    // Mesas abiertas ahora mismo y lo que llevan consumido.
    query<{ n: number; value: string; long: number }>(
      `SELECT count(*)::int AS n,
              COALESCE(sum((SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items i WHERE i.session_id = ts.id AND i.voided_at IS NULL)), 0) AS value,
              count(*) FILTER (WHERE ts.opened_at < now() - make_interval(mins => ${LONG_TABLE_MINUTES}))::int AS long
         FROM table_sessions ts WHERE ts.business_id = $1 AND ts.status <> 'closed' AND ($2::uuid IS NULL OR ts.location_id = $2)`,
      [actor.businessId, scope],
    ),
    // Efectivo esperado en las cajas abiertas.
    query<{ cash: string | null; n: number }>(
      `SELECT count(*)::int AS n, sum(c.opening_amount
              + (SELECT COALESCE(sum(amount + tip), 0) FROM payments WHERE shift_id = c.id AND method = 'cash' AND reversed_at IS NULL)
              + (SELECT COALESCE(sum(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) FROM cash_movements WHERE shift_id = c.id)) AS cash
         FROM cash_shifts c WHERE c.business_id = $1 AND c.closed_at IS NULL AND ($2::uuid IS NULL OR c.location_id = $2)`,
      [actor.businessId, scope],
    ),
    // Tiempo promedio desde que llega la comanda hasta que está lista.
    query<{ station: string; avg: string | null; n: number }>(
      `SELECT t.station, avg(EXTRACT(EPOCH FROM (t.ready_at - r.sent_at)) / 60) AS avg, count(*)::int AS n
         FROM station_tickets t JOIN order_rounds r ON r.id = t.round_id
        WHERE t.business_id = $1 AND t.ready_at IS NOT NULL AND ${inRange('r.sent_at')} AND ${loc('t.location_id')}
        GROUP BY t.station`,
      p,
    ),
    query<{ station: string; name: string; quantity: string }>(
      `SELECT station, name, quantity FROM (
         SELECT t.station, i.name, sum(i.quantity) AS quantity,
                row_number() OVER (PARTITION BY t.station ORDER BY sum(i.quantity) DESC, i.name) AS rk
           FROM order_items i JOIN station_tickets t ON t.id = i.ticket_id JOIN order_rounds r ON r.id = i.round_id
          WHERE i.business_id = $1 AND i.voided_at IS NULL AND ${inRange('r.sent_at')} AND ${loc('t.location_id')}
          GROUP BY t.station, i.name) x
        WHERE rk <= 3 ORDER BY station, rk`,
      p,
    ),
    query<{ n: number; value: string; prepared: number }>(
      `SELECT count(*)::int AS n, COALESCE(sum(i.unit_price * i.quantity), 0) AS value,
              count(*) FILTER (WHERE t.status <> 'sent')::int AS prepared
         FROM order_items i JOIN station_tickets t ON t.id = i.ticket_id
        WHERE i.business_id = $1 AND i.voided_at IS NOT NULL AND ${inRange('i.voided_at')} AND ${loc('t.location_id')}`,
      p,
    ),
    // Cuentas cerradas cuyo descuento total pasó el límite del cajero (lo autorizó un administrador, pero se mira).
    query<{ n: number; value: string }>(
      `SELECT count(*)::int AS n, COALESCE(sum(d.total), 0) AS value FROM (
         SELECT ts.id, sum(ds.amount) AS total,
                (SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items WHERE session_id = ts.id AND voided_at IS NULL) AS subtotal,
                b.cashier_discount_limit AS lim
           FROM table_sessions ts JOIN session_discounts ds ON ds.session_id = ts.id AND ds.voided_at IS NULL JOIN businesses b ON b.id = ts.business_id
          WHERE ts.business_id = $1 AND ts.status = 'closed' AND ${inRange('ts.closed_at')} AND ${loc('ts.location_id')}
          GROUP BY ts.id, b.cashier_discount_limit) d
        WHERE d.subtotal > 0 AND d.total * 100.0 / d.subtotal > d.lim`,
      p,
    ),
    query<{ name: string; unit: string; qty: string; value: string }>(
      `SELECT i.name, i.unit, sum(-m.quantity) AS qty, sum(-m.quantity * m.unit_cost) AS value
         FROM inventory_movements m JOIN inventory_items i ON i.id = m.item_id
        WHERE m.business_id = $1 AND m.kind = 'count' AND m.quantity < 0 AND ${inRange('m.created_at')} AND ${loc('m.location_id')}
        GROUP BY i.name, i.unit ORDER BY sum(-m.quantity * m.unit_cost) DESC`,
      p,
    ),
    query<{ n: number; value: string }>(
      `SELECT count(*)::int AS n, COALESCE(sum(amount), 0) AS value FROM payments
        WHERE business_id = $1 AND reversed_at IS NOT NULL AND ${inRange('reversed_at')} AND ${loc('location_id')}`,
      p,
    ),
    // Mesas cerradas a mano sin cobrar (con motivo): no dejan venta.
    query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events
        WHERE business_id = $1 AND action = 'table.close' AND reason IS NOT NULL AND ${inRange('created_at')} AND ${loc('location_id')}`,
      p,
    ),
    query<{ n: number; short: string }>(
      `SELECT count(*)::int AS n, COALESCE(sum(GREATEST(expected_cash - counted_cash, 0)), 0) AS short FROM cash_shifts
        WHERE business_id = $1 AND closed_at IS NOT NULL AND counted_cash < expected_cash AND ${inRange('closed_at')} AND ${loc('location_id')}`,
      p,
    ),
    query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE business_id = $1 AND action = 'auth.locked' AND ${inRange('created_at')} AND ($5::uuid IS NULL OR location_id = $5 OR location_id IS NULL)`,
      p,
    ),
    query<{ n: number }>(
      `SELECT count(*)::int AS n FROM station_tickets t JOIN order_rounds r ON r.id = t.round_id
        WHERE t.business_id = $1 AND ${inRange('r.sent_at')} AND ${loc('t.location_id')}
          AND COALESCE(t.ready_at, CASE WHEN t.status IN ('sent', 'preparing') THEN now() END) - r.sent_at > interval '25 minutes'`,
      p,
    ),
  ]);

  const sales = Math.max(statement.sales, 1);
  const signals: Signal[] = [];
  const add = (s: Omit<Signal, 'points'>, watchPts: number, alertPts: number) => signals.push({ ...s, points: pointsOf(s.level, watchPts, alertPts) });

  const voidValue = Number(voids[0].value);
  const voidPct = (voidValue / sales) * 100;
  add(
    {
      key: 'voids',
      title: 'Anulaciones de pedidos',
      level: voids[0].n === 0 ? 'ok' : levelOf(voidPct, 2, 6),
      value: voids[0].n ? `${voids[0].n} · ${money(voidValue)}` : 'Ninguna',
      detail: voids[0].prepared ? `${voids[0].prepared} ya se estaban preparando (se perdieron los insumos).` : 'Productos anulados después de enviados.',
      link: '/app/auditoria?accion=order.void',
    },
    8,
    18,
  );
  add(
    {
      key: 'discounts',
      title: 'Descuentos sobre el límite',
      level: levelOf(overDiscount[0].n, 1, 4),
      value: overDiscount[0].n ? `${overDiscount[0].n} cuentas · ${money(Number(overDiscount[0].value))}` : 'Ninguno',
      detail: 'Cuentas con más descuento del que puede dar un cajero.',
      link: '/app/auditoria?accion=discount.apply',
    },
    6,
    14,
  );
  const shortValue = shortages.reduce((s, r) => s + Number(r.value), 0);
  add(
    {
      key: 'inventory',
      title: 'Diferencias de inventario',
      level: shortValue === 0 ? 'ok' : levelOf((shortValue / sales) * 100, 0.5, 2),
      value: shortValue ? `${money(shortValue)}` : 'Cuadra',
      detail: shortages.length
        ? shortages
            .slice(0, 3)
            .map((r) => `${r.name}: −${Number(Number(r.qty).toFixed(1)).toLocaleString('es-CO')} ${r.unit}`)
            .join(' · ')
        : 'Faltantes encontrados en los conteos físicos.',
      link: '/app/inventario',
    },
    10,
    22,
  );
  add(
    {
      key: 'long',
      title: `Mesas abiertas hace más de ${LONG_TABLE_MINUTES} min`,
      level: levelOf(open[0].long, 1, 3),
      value: open[0].long ? `${open[0].long} ${open[0].long === 1 ? 'mesa' : 'mesas'}` : 'Ninguna',
      detail: 'Una mesa eterna puede ser una cuenta que nadie cobró.',
      link: '/app',
    },
    4,
    10,
  );
  add(
    {
      key: 'reversed',
      title: 'Pagos reversados',
      level: levelOf(reversed[0].n, 1, 3),
      value: reversed[0].n ? `${reversed[0].n} · ${money(Number(reversed[0].value))}` : 'Ninguno',
      detail: 'Cobros que se devolvieron después de registrados.',
      link: '/app/auditoria',
    },
    6,
    14,
  );
  add(
    {
      key: 'manual',
      title: 'Mesas cerradas sin cobrar',
      level: levelOf(manualClose[0].n, 1, 3),
      value: manualClose[0].n ? `${manualClose[0].n}` : 'Ninguna',
      detail: 'Cerradas a mano con un motivo (sin consumo o con cortesía total).',
      link: '/app/auditoria?accion=table.close',
    },
    4,
    10,
  );
  const cashShort = Number(shifts[0].short);
  add(
    {
      key: 'cash',
      title: 'Cajas con faltante',
      level: cashShort === 0 ? 'ok' : levelOf(cashShort, 1, 20000),
      value: cashShort ? `${shifts[0].n} · faltaron ${money(cashShort)}` : 'Cuadran',
      detail: 'Cierres de caja donde se contó menos de lo esperado.',
      link: '/app/caja',
    },
    8,
    18,
  );
  add(
    {
      key: 'slow',
      title: 'Comandas de más de 25 min',
      level: levelOf(slowTickets[0].n, 3, 8),
      value: slowTickets[0].n ? `${slowTickets[0].n}` : 'Ninguna',
      detail: 'Desde que el mesero envía hasta que está lista.',
    },
    3,
    8,
  );
  add(
    {
      key: 'pins',
      title: 'Bloqueos por PIN equivocado',
      level: levelOf(locks[0].n, 1, 3),
      value: locks[0].n ? `${locks[0].n}` : 'Ninguno',
      detail: 'Alguien intentó entrar con un PIN que no era el suyo.',
      link: '/app/auditoria?accion=auth.locked',
    },
    3,
    8,
  );

  const topByStation = ['kitchen', 'bar'].map((station) => ({
    station,
    items: top.filter((t) => t.station === station).map((t) => ({ name: t.name, quantity: Number(t.quantity) })),
  }));
  const low = scope ? await lowStock({ businessId: actor.businessId, locationId: scope }) : [];

  return {
    statement,
    openTables: open[0].n,
    openTablesValue: Number(open[0].value),
    expectedCash: cash[0].n ? Number(cash[0].cash) : null,
    prep: ['kitchen', 'bar'].map((station) => {
      const row = prep.find((r) => r.station === station);
      return { station, avgMinutes: row?.avg ? Math.round(Number(row.avg)) : null, tickets: row?.n ?? 0 };
    }),
    topByStation,
    lowStock: low.map((l) => ({ name: l.name, stock: l.stock, minStock: l.minStock, unit: l.unit })),
    signals,
    score: radarScore(signals),
  };
}

export const isValidScope = (value: string | undefined) => !value || value === 'all' || isUuid(value);
