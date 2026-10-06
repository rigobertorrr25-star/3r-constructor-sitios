// Impresión de comandas. Cada sede tiene sus impresoras térmicas de red (cocina, barra, caja). Al enviar un pedido, al
// anular, al pedir la precuenta o al cerrar la caja se deja un trabajo en cola; un programa de 3R en un computador del
// local los pide con el código de la sede y los manda a cada impresora. Si la impresora falla, se reintenta y queda a la
// vista en la pantalla de Impresoras para reimprimir.
import { createHash, randomBytes } from 'node:crypto';
import { getBill, METHOD_LABEL, METHODS, shiftSummary, suggestedTipFor } from './cash';
import { query, transaction, type Db } from './db';
import { anulacion, cierre, comanda, precuenta, prueba, type Ticket } from './escpos';
import { formatCop, formatDateTime, formatTime } from './format';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export type Target = 'kitchen' | 'bar' | 'cashier';
export const TARGET_LABEL: Record<Target, string> = { kitchen: 'Cocina', bar: 'Barra', cashier: 'Caja' };
const TARGET_COLUMN: Record<Target, string> = { kitchen: 'prints_kitchen', bar: 'prints_bar', cashier: 'prints_cashier' };

export const PAPER = [
  { width: 48, label: '80 mm' },
  { width: 42, label: '80 mm (letra grande)' },
  { width: 32, label: '58 mm' },
] as const;

/** Intentos antes de darla por perdida; y una comanda de hace horas ya no sirve en la cocina. */
const MAX_ATTEMPTS = 5;
const STALE_HOURS = 6;

export type Printer = {
  id: string;
  name: string;
  host: string;
  port: number;
  width: number;
  printsKitchen: boolean;
  printsBar: boolean;
  printsCashier: boolean;
  copies: number;
  isActive: boolean;
};

const PRINTER_SELECT = `SELECT id, name, host, port, width, prints_kitchen AS "printsKitchen", prints_bar AS "printsBar",
  prints_cashier AS "printsCashier", copies, is_active AS "isActive" FROM printers`;

export const printerTargets = (p: Pick<Printer, 'printsKitchen' | 'printsBar' | 'printsCashier'>) =>
  (['kitchen', 'bar', 'cashier'] as Target[]).filter((t) => (t === 'kitchen' ? p.printsKitchen : t === 'bar' ? p.printsBar : p.printsCashier));

export async function listPrinters(actor: Actor): Promise<Printer[]> {
  requirePermission(actor, 'printers.manage');
  return query<Printer>(`${PRINTER_SELECT} WHERE location_id = $1 AND business_id = $2 ORDER BY created_at`, [actor.locationId, actor.businessId]);
}

/** ¿Esta sede tiene impresora activa para esto? (para mostrar u ocultar botones). */
export async function hasPrinter(actor: Pick<Actor, 'businessId' | 'locationId'>, target: Target) {
  const rows = await query(`SELECT 1 FROM printers WHERE location_id = $1 AND business_id = $2 AND is_active AND ${TARGET_COLUMN[target]} LIMIT 1`, [
    actor.locationId,
    actor.businessId,
  ]);
  return rows.length > 0;
}

const HOST = /^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,98}[a-zA-Z0-9])?$/;

export type PrinterInput = {
  name: string;
  host: string;
  port: number;
  width: number;
  printsKitchen: boolean;
  printsBar: boolean;
  printsCashier: boolean;
  copies: number;
  isActive: boolean;
};

function cleanPrinter(input: PrinterInput) {
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 60) throw new AppError('INVALID', 'Nombre: entre 2 y 60 letras (por ejemplo «Cocina»).');
  const host = input.host.trim();
  if (!HOST.test(host)) throw new AppError('INVALID', 'Escribe la dirección IP de la impresora, por ejemplo 192.168.1.50.');
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) throw new AppError('INVALID', 'Puerto no válido (casi siempre es 9100).');
  if (!PAPER.some((p) => p.width === input.width)) throw new AppError('INVALID', 'Escoge el ancho del papel.');
  if (!Number.isInteger(input.copies) || input.copies < 1 || input.copies > 3) throw new AppError('INVALID', 'Copias: de 1 a 3.');
  return { ...input, name, host };
}

export async function savePrinter(actor: Actor, id: string | null, input: PrinterInput) {
  requirePermission(actor, 'printers.manage');
  const p = cleanPrinter(input);
  const values = [p.name, p.host, p.port, p.width, p.printsKitchen, p.printsBar, p.printsCashier, p.copies, p.isActive];
  return transaction(async (db) => {
    let printerId: string;
    if (id) {
      if (!isUuid(id)) throw new AppError('NOT_FOUND', 'No encontramos esa impresora.');
      const res = await db.query<{ id: string }>(
        `UPDATE printers SET name = $1, host = $2, port = $3, width = $4, prints_kitchen = $5, prints_bar = $6, prints_cashier = $7,
                copies = $8, is_active = $9
          WHERE id = $10 AND location_id = $11 AND business_id = $12 RETURNING id`,
        [...values, id, actor.locationId, actor.businessId],
      );
      if (!res.rows[0]) throw new AppError('NOT_FOUND', 'No encontramos esa impresora.');
      printerId = id;
    } else {
      const count = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM printers WHERE location_id = $1`, [actor.locationId])).rows[0].n;
      if (count >= 20) throw new AppError('CONFLICT', 'Máximo 20 impresoras por sede.');
      printerId = (
        await db.query<{ id: string }>(
          `INSERT INTO printers (name, host, port, width, prints_kitchen, prints_bar, prints_cashier, copies, is_active, business_id, location_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [...values, actor.businessId, actor.locationId],
        )
      ).rows[0].id;
    }
    const jobs = printerTargets(p).map((t) => TARGET_LABEL[t]).join(', ') || 'nada';
    await audit(db, actor, {
      action: id ? 'printer.update' : 'printer.create',
      entity: 'printer',
      entityId: printerId,
      summary: `${id ? 'Cambió' : 'Agregó'} la impresora ${p.name} (${p.host}:${p.port}, imprime: ${jobs}${p.isActive ? '' : ', apagada'})`,
    });
    return printerId;
  });
}

export async function removePrinter(actor: Actor, id: string) {
  requirePermission(actor, 'printers.manage');
  if (!isUuid(id)) throw new AppError('NOT_FOUND', 'No encontramos esa impresora.');
  await transaction(async (db) => {
    const res = await db.query<{ name: string }>(`DELETE FROM printers WHERE id = $1 AND location_id = $2 AND business_id = $3 RETURNING name`, [
      id,
      actor.locationId,
      actor.businessId,
    ]);
    if (!res.rows[0]) throw new AppError('NOT_FOUND', 'No encontramos esa impresora.');
    await audit(db, actor, { action: 'printer.remove', entity: 'printer', entityId: id, summary: `Quitó la impresora ${res.rows[0].name}` });
  });
}

// ───────── cola de impresión ─────────

type Who = Pick<Actor, 'businessId' | 'locationId'> & Partial<Pick<Actor, 'id'>>;

async function placeInfo(db: Db, who: Who) {
  return (
    await db.query<{ business: string; timezone: string; location: string; locations: number }>(
      `SELECT b.name AS business, b.timezone, l.name AS location,
              (SELECT count(*)::int FROM locations x WHERE x.business_id = b.id AND x.is_active) AS locations
         FROM businesses b JOIN locations l ON l.business_id = b.id WHERE b.id = $1 AND l.id = $2`,
      [who.businessId, who.locationId],
    )
  ).rows[0];
}

/** Deja un trabajo por cada impresora activa que imprime `target`. Devuelve cuántas impresoras lo recibieron. */
async function enqueue(db: Db, who: Who, target: Target, kind: string, title: string, build: (width: number) => Ticket, printerId?: string) {
  const printers = (
    await db.query<{ id: string; width: number; copies: number }>(
      `SELECT id, width, copies FROM printers
        WHERE location_id = $1 AND business_id = $2 AND is_active AND ${printerId ? 'id = $3' : TARGET_COLUMN[target]}`,
      printerId ? [who.locationId, who.businessId, printerId] : [who.locationId, who.businessId],
    )
  ).rows;
  for (const p of printers) {
    const { data, preview } = build(p.width).finish(p.copies);
    await db.query(
      `INSERT INTO print_jobs (business_id, location_id, printer_id, kind, title, data, preview, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [who.businessId, who.locationId, p.id, kind, title.slice(0, 160), data, preview, who.id ?? null],
    );
  }
  return printers.length;
}

/** Al enviar una ronda: una comanda por estación a sus impresoras (va en la misma transacción del pedido). */
export async function enqueueRound(db: Db, who: Who & Pick<Actor, 'name'>, roundId: string) {
  const rows = (
    await db.query<{ station: 'kitchen' | 'bar'; table: string; zone: string; round: number; sentAt: Date; name: string; quantity: number; notes: string | null }>(
      `SELECT st.station, t.number AS "table", t.zone, r.number AS round, r.sent_at AS "sentAt", i.name, i.quantity, i.notes
         FROM order_rounds r JOIN table_sessions ts ON ts.id = r.session_id JOIN dining_tables t ON t.id = ts.table_id
         JOIN station_tickets st ON st.round_id = r.id JOIN order_items i ON i.ticket_id = st.id
        WHERE r.id = $1 AND r.business_id = $2 ORDER BY st.station, i.name`,
      [roundId, who.businessId],
    )
  ).rows;
  if (!rows.length) return 0;
  const place = await placeInfo(db, who);
  let sent = 0;
  for (const station of ['kitchen', 'bar'] as const) {
    const items = rows.filter((r) => r.station === station);
    if (!items.length) continue;
    const first = items[0];
    sent += await enqueue(db, who, station, 'comanda', `Mesa ${first.table} · ${TARGET_LABEL[station]} · Ronda ${first.round}`, (w) =>
      comanda(w, {
        station,
        table: first.table,
        zone: first.zone,
        round: first.round,
        sentBy: who.name,
        time: formatTime(first.sentAt, place.timezone),
        items: items.map((i) => ({ quantity: i.quantity, name: i.name, notes: i.notes })),
      }),
    );
  }
  return sent;
}

/** Al anular algo ya enviado: la estación recibe un papel de «ANULADO» (si ya se entregó, no hace falta). */
export async function enqueueVoid(db: Db, who: Who & Pick<Actor, 'name'>, itemId: string, reason: string) {
  const item = (
    await db.query<{ station: 'kitchen' | 'bar'; status: string; table: string; name: string; quantity: number }>(
      `SELECT st.station, st.status, t.number AS "table", i.name, i.quantity
         FROM order_items i JOIN station_tickets st ON st.id = i.ticket_id JOIN table_sessions ts ON ts.id = i.session_id
         JOIN dining_tables t ON t.id = ts.table_id WHERE i.id = $1 AND i.business_id = $2`,
      [itemId, who.businessId],
    )
  ).rows[0];
  if (!item || item.status === 'delivered') return 0;
  const place = await placeInfo(db, who);
  return enqueue(db, who, item.station, 'anulacion', `ANULADO · Mesa ${item.table} · ${item.quantity} x ${item.name}`, (w) =>
    anulacion(w, { station: item.station, table: item.table, quantity: item.quantity, name: item.name, reason, by: who.name, time: formatTime(new Date(), place.timezone) }),
  );
}

/** Precuenta a la impresora de caja. */
export async function printBill(actor: Actor, sessionId: string) {
  requirePermission(actor, 'tables.bill');
  const bill = await getBill(actor, sessionId);
  if (!bill) throw new AppError('NOT_FOUND', 'No encontramos esa mesa.');
  return transaction(async (db) => {
    const place = await placeInfo(db, actor);
    const tip = suggestedTipFor(bill.balance, bill.suggestedTipPercent);
    const n = await enqueue(db, actor, 'cashier', 'precuenta', `Precuenta · Mesa ${bill.session.tableNumber} · ${formatCop(bill.balance || bill.total)}`, (w) =>
      precuenta(w, {
        business: place.business,
        location: place.locations > 1 ? place.location : null,
        table: bill.session.tableNumber,
        guests: bill.session.guests,
        waiter: bill.session.openedBy,
        time: formatDateTime(new Date(), place.timezone),
        lines: bill.lines.map((l) => ({ quantity: l.quantity, name: l.name, total: formatCop(l.total) })),
        subtotal: formatCop(bill.subtotal),
        discounts: bill.discountTotal ? formatCop(bill.discountTotal) : null,
        total: formatCop(bill.total),
        paid: bill.paid ? formatCop(bill.paid) : null,
        balance: bill.paid && bill.balance > 0 ? formatCop(bill.balance) : null,
        tip: bill.balance > 0 && bill.suggestedTipPercent > 0 ? { percent: bill.suggestedTipPercent, amount: formatCop(tip), withTip: formatCop(bill.balance + tip) } : null,
      }),
    );
    if (!n) throw new AppError('CONFLICT', 'Esta sede no tiene impresora de caja. Agrégala en Impresoras.');
    return n;
  });
}

/** Resumen del cierre de caja a la impresora de caja (después de cerrar; si no hay impresora, no pasa nada). */
export async function enqueueClosing(actor: Actor, shiftId: string) {
  const s = await shiftSummary(actor, shiftId);
  if (!s || !s.shift.closedAt) return 0;
  return transaction(async (db) => {
    const place = await placeInfo(db, actor);
    const counted = s.shift.countedCash ?? 0;
    const diff = counted - (s.shift.expectedCash ?? 0);
    return enqueue(db, actor, 'cashier', 'cierre', `Cierre de caja · ${formatDateTime(s.shift.closedAt!, place.timezone)}`, (w) =>
      cierre(w, {
        business: place.business,
        location: place.locations > 1 ? place.location : null,
        openedBy: s.shift.openedBy,
        openedAt: formatDateTime(s.shift.openedAt, place.timezone),
        closedBy: s.shift.closedBy ?? '',
        closedAt: formatDateTime(s.shift.closedAt!, place.timezone),
        opening: formatCop(s.shift.openingAmount),
        methods: METHODS.map((m) => ({ label: METHOD_LABEL[m], amount: formatCop(s.byMethod[m].amount), count: s.byMethod[m].count })),
        sales: formatCop(s.sales),
        tips: formatCop(s.tips),
        discounts: formatCop(s.discounts),
        voids: formatCop(s.voids),
        movementsIn: formatCop(s.movementsIn),
        movementsOut: formatCop(s.movementsOut),
        expected: formatCop(s.shift.expectedCash ?? 0),
        counted: formatCop(counted),
        result: diff === 0 ? 'CUADRA' : diff > 0 ? `SOBRAN ${formatCop(diff)}` : `FALTAN ${formatCop(-diff)}`,
        tables: s.tablesClosed,
        notes: s.shift.notes,
      }),
    );
  });
}

export async function printTest(actor: Actor, printerId: string) {
  requirePermission(actor, 'printers.manage');
  if (!isUuid(printerId)) throw new AppError('NOT_FOUND', 'No encontramos esa impresora.');
  return transaction(async (db) => {
    const p = (await db.query<Printer>(`${PRINTER_SELECT} WHERE id = $1 AND location_id = $2 AND business_id = $3`, [printerId, actor.locationId, actor.businessId])).rows[0];
    if (!p) throw new AppError('NOT_FOUND', 'No encontramos esa impresora.');
    const place = await placeInfo(db, actor);
    await enqueue(db, actor, 'cashier', 'prueba', `Prueba · ${p.name}`, (w) =>
      prueba(w, { business: place.business, printer: p.name, address: `${p.host}:${p.port}`, time: formatDateTime(new Date(), place.timezone), jobs: printerTargets(p).map((t) => TARGET_LABEL[t]) }),
      p.id,
    );
  });
}

export type PrintJob = { id: string; kind: string; title: string; printer: string; status: string; attempts: number; error: string | null; createdAt: Date; printedAt: Date | null; preview: string };

export async function listJobs(actor: Actor, limit = 40): Promise<PrintJob[]> {
  requirePermission(actor, 'printers.manage');
  return query<PrintJob>(
    `SELECT j.id, j.kind, j.title, p.name AS printer, j.status, j.attempts, j.error, j.created_at AS "createdAt", j.printed_at AS "printedAt", j.preview
       FROM print_jobs j JOIN printers p ON p.id = j.printer_id
      WHERE j.location_id = $1 AND j.business_id = $2 ORDER BY j.created_at DESC LIMIT $3`,
    [actor.locationId, actor.businessId, limit],
  );
}

/** Vuelve a mandar un papel (salió mal, se mojó, se perdió). Queda como trabajo nuevo; el anterior no se toca. */
export async function reprint(actor: Actor, jobId: string) {
  requirePermission(actor, 'printers.manage');
  if (!isUuid(jobId)) throw new AppError('NOT_FOUND', 'No encontramos esa impresión.');
  await transaction(async (db) => {
    const res = await db.query<{ title: string }>(
      `INSERT INTO print_jobs (business_id, location_id, printer_id, kind, title, data, preview, created_by)
       SELECT business_id, location_id, printer_id, kind, left('Reimpresión · ' || title, 160), data, preview, $4
         FROM print_jobs WHERE id = $1 AND location_id = $2 AND business_id = $3 RETURNING title`,
      [jobId, actor.locationId, actor.businessId, actor.id],
    );
    if (!res.rows[0]) throw new AppError('NOT_FOUND', 'No encontramos esa impresión.');
    await audit(db, actor, { action: 'print.reprint', entity: 'print_job', entityId: jobId, summary: res.rows[0].title });
  });
}

/** Trabajos sin imprimir hace rato (para avisar que el computador de impresión está apagado). */
export async function stuckJobs(actor: Pick<Actor, 'businessId' | 'locationId'>) {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM print_jobs
      WHERE location_id = $1 AND business_id = $2 AND status IN ('pending', 'printing')
        AND created_at < now() - interval '30 seconds' AND created_at > now() - make_interval(hours => $3)`,
    [actor.locationId, actor.businessId, STALE_HOURS],
  );
  return rows[0]?.n ?? 0;
}

// ───────── programa de impresión del local ─────────

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

/** Código nuevo para el programa de impresión de la sede (se ve una sola vez; el anterior deja de servir). */
export async function createAgentCode(actor: Actor) {
  requirePermission(actor, 'printers.manage');
  const code = `rc_${randomBytes(24).toString('base64url')}`;
  await transaction(async (db) => {
    await db.query(`UPDATE locations SET print_token_hash = $3, print_agent_seen_at = NULL WHERE id = $1 AND business_id = $2`, [
      actor.locationId,
      actor.businessId,
      hashCode(code),
    ]);
    await audit(db, actor, { action: 'printer.code', entity: 'location', entityId: actor.locationId, summary: 'Creó un código nuevo para el programa de impresión' });
  });
  return code;
}

export async function agentStatus(actor: Actor) {
  requirePermission(actor, 'printers.manage');
  const row = (
    await query<{ hasCode: boolean; seenAt: Date | null }>(
      `SELECT print_token_hash IS NOT NULL AS "hasCode", print_agent_seen_at AS "seenAt" FROM locations WHERE id = $1 AND business_id = $2`,
      [actor.locationId, actor.businessId],
    )
  )[0];
  return row ?? { hasCode: false, seenAt: null };
}

async function locationForCode(db: Db, code: string) {
  if (!/^rc_[A-Za-z0-9_-]{20,60}$/.test(code)) return null;
  return (
    await db.query<{ id: string }>(`UPDATE locations SET print_agent_seen_at = now() WHERE print_token_hash = $1 AND is_active RETURNING id`, [hashCode(code)])
  ).rows[0]?.id ?? null;
}

export type AgentJob = { id: string; title: string; host: string; port: number; data: string };

/** El programa del local pide qué imprimir. Los trabajos quedan «imprimiendo» hasta que avise; si no avisa, se reintentan. */
export async function claimJobs(code: string): Promise<AgentJob[] | null> {
  return transaction(async (db) => {
    const locationId = await locationForCode(db, code);
    if (!locationId) return null;
    await db.query(
      `UPDATE print_jobs SET status = 'failed', error = 'Muy vieja: no se imprimió a tiempo (¿el computador estaba apagado?)'
        WHERE location_id = $1 AND status IN ('pending', 'printing') AND created_at < now() - make_interval(hours => $2)`,
      [locationId, STALE_HOURS],
    );
    const rows = (
      await db.query<{ id: string; title: string; host: string; port: number; data: Buffer }>(
        `WITH picked AS (
           UPDATE print_jobs SET status = 'printing', claimed_at = now(), attempts = attempts + 1
            WHERE id IN (SELECT id FROM print_jobs
                          WHERE location_id = $1 AND (status = 'pending' OR (status = 'printing' AND claimed_at < now() - interval '2 minutes'))
                          ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED)
           RETURNING id, title, printer_id, data, created_at)
         SELECT k.id, k.title, p.host, p.port, k.data FROM picked k JOIN printers p ON p.id = k.printer_id ORDER BY k.created_at`,
        [locationId],
      )
    ).rows;
    return rows.map((r) => ({ id: r.id, title: r.title, host: r.host, port: r.port, data: r.data.toString('base64') }));
  });
}

/** El programa avisa si salió o no. Si no salió, vuelve a la cola hasta el quinto intento. */
export async function finishJob(code: string, jobId: string, ok: boolean, error?: string) {
  if (!isUuid(jobId)) return false;
  return transaction(async (db) => {
    const locationId = await locationForCode(db, code);
    if (!locationId) return null;
    const res = await db.query(
      `UPDATE print_jobs
          SET status = CASE WHEN $3 THEN 'done' WHEN attempts >= $5 THEN 'failed' ELSE 'pending' END,
              printed_at = CASE WHEN $3 THEN now() ELSE NULL END,
              error = CASE WHEN $3 THEN NULL ELSE $4 END,
              claimed_at = NULL
        WHERE id = $1 AND location_id = $2 AND status = 'printing'`,
      [jobId, locationId, ok, (error || 'La impresora no respondió').slice(0, 300), MAX_ATTEMPTS],
    );
    return (res.rowCount ?? 0) > 0;
  });
}
