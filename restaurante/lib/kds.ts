// Módulo 03: pantallas de cocina y barra. Cada comanda avanza: sent (nueva) → preparing → ready (lista) → delivered.
import { query, transaction } from './db';
import { ownStation } from './permissions';
import { type Station, STATION_LABEL, isStation } from './stations';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export const TICKET_FLOW = ['sent', 'preparing', 'ready', 'delivered'] as const;
export type TicketStatus = (typeof TICKET_FLOW)[number];

export type KdsItem = { id: string; name: string; quantity: number; notes: string | null; voided: boolean };
export type KdsTicket = {
  id: string;
  station: Station;
  status: TicketStatus;
  tableNumber: string;
  zone: string;
  roundNumber: number;
  sentAt: Date;
  sentBy: string;
  startedAt: Date | null;
  readyAt: Date | null;
  items: KdsItem[];
};

function checkStation(actor: Actor, station: string): Station {
  if (!isStation(station)) throw new AppError('NOT_FOUND', 'Esa estación no existe.');
  const own = ownStation(actor.role);
  if (own && own !== station) throw new AppError('FORBIDDEN', `Tu pantalla es la de ${STATION_LABEL[own].toLowerCase()}.`);
  return station;
}

/** Comandas por hacer de una estación (y las entregadas en la última hora, para deshacer un toque equivocado). */
export async function listTickets(actor: Actor, station: string): Promise<KdsTicket[]> {
  requirePermission(actor, 'kds.view');
  const st = checkStation(actor, station);
  const rows = await query<Omit<KdsTicket, 'items'> & { itemId: string; name: string; quantity: number; notes: string | null; voided: boolean }>(
    `SELECT t.id, t.station, t.status, dt.number AS "tableNumber", dt.zone, r.number AS "roundNumber", r.sent_at AS "sentAt", s.name AS "sentBy",
            t.started_at AS "startedAt", t.ready_at AS "readyAt",
            i.id AS "itemId", i.name, i.quantity, i.notes, (i.voided_at IS NOT NULL) AS voided
       FROM station_tickets t
       JOIN order_rounds r ON r.id = t.round_id
       JOIN table_sessions ts ON ts.id = r.session_id
       JOIN dining_tables dt ON dt.id = ts.table_id
       JOIN staff s ON s.id = r.sent_by
       JOIN order_items i ON i.ticket_id = t.id
      WHERE t.location_id = $1 AND t.business_id = $2 AND t.station = $3
        AND (t.status <> 'delivered' OR t.delivered_at > now() - interval '1 hour')
      ORDER BY r.sent_at, i.name`,
    [actor.locationId, actor.businessId, st],
  );
  const tickets: KdsTicket[] = [];
  for (const row of rows) {
    let ticket = tickets.find((t) => t.id === row.id);
    if (!ticket) {
      const { itemId: _i, name: _n, quantity: _q, notes: _no, voided: _v, ...head } = row;
      tickets.push((ticket = { ...head, items: [] }));
    }
    ticket.items.push({ id: row.itemId, name: row.name, quantity: row.quantity, notes: row.notes, voided: row.voided });
  }
  return tickets;
}

/** Cuántas comandas nuevas tiene cada estación (para el aviso en el menú). */
export async function pendingCounts(actor: Actor) {
  const rows = await query<{ station: Station; n: number }>(
    `SELECT station, count(*)::int AS n FROM station_tickets WHERE location_id = $1 AND business_id = $2 AND status = 'sent' GROUP BY station`,
    [actor.locationId, actor.businessId],
  );
  return Object.fromEntries(rows.map((r) => [r.station, r.n])) as Partial<Record<Station, number>>;
}

const STEP_LABEL: Record<TicketStatus, string> = { sent: 'nueva', preparing: 'en preparación', ready: 'lista', delivered: 'entregada' };

/**
 * Mueve una comanda un paso adelante o atrás (para deshacer un toque equivocado). Entregar lo puede hacer quien
 * lleva los platos; preparar y marcar lista, solo su estación (o dueño y administrador).
 */
export async function moveTicket(actor: Actor, ticketId: string, to: string) {
  if (!(TICKET_FLOW as readonly string[]).includes(to)) throw new AppError('INVALID', 'Estado no válido.');
  const target = to as TicketStatus;
  if (!isUuid(ticketId)) throw new AppError('NOT_FOUND', 'No encontramos esa comanda.');
  await transaction(async (db) => {
    const ticket = (
      await db.query<{ id: string; station: Station; status: TicketStatus; tableNumber: string; roundNumber: number }>(
        `SELECT t.id, t.station, t.status, dt.number AS "tableNumber", r.number AS "roundNumber"
           FROM station_tickets t JOIN order_rounds r ON r.id = t.round_id
           JOIN table_sessions ts ON ts.id = r.session_id JOIN dining_tables dt ON dt.id = ts.table_id
          WHERE t.id = $1 AND t.location_id = $2 AND t.business_id = $3 FOR UPDATE OF t`,
        [ticketId, actor.locationId, actor.businessId],
      )
    ).rows[0];
    if (!ticket) throw new AppError('NOT_FOUND', 'No encontramos esa comanda.');
    const from = TICKET_FLOW.indexOf(ticket.status);
    const next = TICKET_FLOW.indexOf(target);
    if (from === next) return;
    // Una comanda con todo anulado se descarta de una vez ("Entendido").
    const allVoided =
      target === 'delivered' &&
      !(await db.query(`SELECT 1 FROM order_items WHERE ticket_id = $1 AND voided_at IS NULL LIMIT 1`, [ticketId])).rowCount;
    if (Math.abs(next - from) !== 1 && !allVoided) throw new AppError('CONFLICT', 'La comanda cambió en otra pantalla. Mira su estado actual.');
    if (target === 'delivered' || (ticket.status === 'delivered' && target === 'ready')) requirePermission(actor, 'tickets.deliver');
    else {
      requirePermission(actor, 'kds.view');
      checkStation(actor, ticket.station);
    }
    // Las horas reales de inicio y de "lista" son las que usa el tablero para medir tiempos de preparación.
    await db.query(
      `UPDATE station_tickets SET status = $2::varchar,
              started_at = CASE WHEN $2::varchar = 'preparing' AND started_at IS NULL THEN now() WHEN $2::varchar = 'sent' THEN NULL ELSE started_at END,
              ready_at = CASE WHEN $2::varchar = 'ready' AND ready_at IS NULL THEN now() WHEN $2::varchar IN ('sent', 'preparing') THEN NULL ELSE ready_at END,
              delivered_at = CASE WHEN $2::varchar = 'delivered' THEN now() ELSE NULL END
        WHERE id = $1`,
      [ticketId, target],
    );
    // Avanzar es la rutina de cada minuto; solo deshacer queda en la auditoría.
    if (next < from) {
      await audit(db, actor, {
        action: 'ticket.undo',
        entity: 'station_ticket',
        entityId: ticketId,
        summary: `Devolvió la comanda de ${STATION_LABEL[ticket.station].toLowerCase()} de la mesa ${ticket.tableNumber} (ronda ${ticket.roundNumber}) a ${STEP_LABEL[target]}`,
      });
    }
  });
}

export type ReadyTicket = { id: string; station: Station; tableNumber: string; sessionId: string; readyAt: Date; items: string[] };

/** Lo que está listo para llevar a las mesas (lo ven meseros y cajeros en el plano). */
export async function readyToServe(actor: Actor): Promise<ReadyTicket[]> {
  requirePermission(actor, 'tickets.deliver');
  const rows = await query<{ id: string; station: Station; tableNumber: string; sessionId: string; readyAt: Date; item: string }>(
    `SELECT t.id, t.station, dt.number AS "tableNumber", ts.id AS "sessionId", t.ready_at AS "readyAt", i.quantity || ' × ' || i.name AS item
       FROM station_tickets t JOIN order_rounds r ON r.id = t.round_id
       JOIN table_sessions ts ON ts.id = r.session_id JOIN dining_tables dt ON dt.id = ts.table_id
       JOIN order_items i ON i.ticket_id = t.id AND i.voided_at IS NULL
      WHERE t.location_id = $1 AND t.business_id = $2 AND t.status = 'ready'
      ORDER BY t.ready_at, i.name`,
    [actor.locationId, actor.businessId],
  );
  const out: ReadyTicket[] = [];
  for (const row of rows) {
    let t = out.find((x) => x.id === row.id);
    if (!t) out.push((t = { id: row.id, station: row.station, tableNumber: row.tableNumber, sessionId: row.sessionId, readyAt: row.readyAt, items: [] }));
    t.items.push(row.item);
  }
  return out;
}
