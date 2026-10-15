// Módulo 11: clientes, reservas (del equipo o pedidas en línea por el cliente) y la carta pública para el QR.
import { query, transaction, type Db } from './db';
import { getMenu } from './orders';
import { AppError, audit, getBusinessBySlug, isUuid, listLocations, openTable, requirePermission, type Actor } from './store';

export const RESERVATION_STATUS = ['requested', 'confirmed', 'arrived', 'no_show', 'cancelled'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUS)[number];
export const STATUS_LABEL: Record<ReservationStatus, string> = {
  requested: 'Por confirmar',
  confirmed: 'Confirmada',
  arrived: 'Llegó',
  no_show: 'No llegó',
  cancelled: 'Cancelada',
};

/** Una mesa reservada queda apartada desde 30 min antes hasta 90 min después de la hora de la reserva. */
export const HOLD_BEFORE_MIN = 30;
export const HOLD_AFTER_MIN = 90;
/** Dos reservas en la misma mesa deben estar separadas al menos esto. */
const TABLE_GAP_MIN = 120;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function requireText(value: string, label: string, min: number, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

/** Teléfono solo con números (7 a 15). "+57 310 123 4567" → "573101234567". */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new AppError('INVALID', 'Escribe un teléfono válido.');
  return digits;
}

async function upsertCustomer(db: Db, businessId: string, input: { name: string; phone: string; email?: string | null }) {
  const name = requireText(input.name, 'Nombre', 2, 120);
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim() ? input.email.trim().toLowerCase().slice(0, 160) : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('INVALID', 'Correo no válido.');
  const res = await db.query<{ id: string }>(
    `INSERT INTO customers (business_id, name, phone, email) VALUES ($1, $2, $3, $4)
     ON CONFLICT (business_id, phone) DO UPDATE SET name = EXCLUDED.name, email = COALESCE(EXCLUDED.email, customers.email)
     RETURNING id`,
    [businessId, name, phone, email],
  );
  return res.rows[0].id;
}

/** Fecha y hora del negocio → instante, y revisa que esté en el futuro y no a más de 90 días. */
async function startsAt(db: Db, businessId: string, date: string, time: string, { allowPast = false } = {}) {
  if (!DATE.test(date) || !TIME.test(time)) throw new AppError('INVALID', 'Elige fecha y hora.');
  const row = (
    await db.query<{ at: Date; past: boolean; far: boolean }>(
      `SELECT x.at, x.at < now() - interval '15 minutes' AS past, x.at > now() + interval '90 days' AS far
         FROM (SELECT ($2::date + $3::time) AT TIME ZONE b.timezone AS at FROM businesses b WHERE b.id = $1) x`,
      [businessId, date, time],
    )
  ).rows[0];
  if (!allowPast && row.past) throw new AppError('INVALID', 'Esa hora ya pasó.');
  if (row.far) throw new AppError('INVALID', 'Solo se reserva hasta con 90 días de anticipación.');
  return row.at;
}

async function checkTable(db: Db, actor: Pick<Actor, 'businessId' | 'locationId'>, tableId: string, at: Date, exceptId?: string) {
  if (!isUuid(tableId)) throw new AppError('INVALID', 'Elige una mesa válida.');
  const table = (
    await db.query<{ number: string; capacity: number }>(
      `SELECT number, capacity FROM dining_tables WHERE id = $1 AND location_id = $2 AND business_id = $3 AND is_active`,
      [tableId, actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!table) throw new AppError('INVALID', 'Elige una mesa válida.');
  const clash = await db.query<{ hhmm: string }>(
    `SELECT to_char(starts_at, 'HH24:MI') AS hhmm FROM reservations
      WHERE table_id = $1 AND status IN ('requested', 'confirmed') AND ($3::uuid IS NULL OR id <> $3)
        AND abs(EXTRACT(EPOCH FROM (starts_at - $2::timestamptz))) < $4 * 60`,
    [tableId, at, exceptId ?? null, TABLE_GAP_MIN],
  );
  if (clash.rowCount) throw new AppError('CONFLICT', `La mesa ${table.number} ya tiene una reserva cerca de esa hora.`);
  return table;
}

export type ReservationInput = {
  name: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: number;
  tableId?: string | null;
  notes?: string;
  deposit?: number;
};

const checkGuests = (n: number) => {
  if (!Number.isInteger(n) || n < 1 || n > 60) throw new AppError('INVALID', 'Personas: de 1 a 60.');
};

/** Reserva que toma el equipo (por teléfono, WhatsApp, en persona): queda confirmada. */
export async function createReservation(actor: Actor, input: ReservationInput) {
  requirePermission(actor, 'reservations.manage');
  checkGuests(input.guests);
  const notes = input.notes?.trim() ? requireText(input.notes, 'Nota', 2, 300) : null;
  const deposit = input.deposit ?? 0;
  if (!Number.isInteger(deposit) || deposit < 0) throw new AppError('INVALID', 'Abono: escribe el valor en pesos.');
  return transaction(async (db) => {
    const at = await startsAt(db, actor.businessId, input.date, input.time);
    const table = input.tableId ? await checkTable(db, actor, input.tableId, at) : null;
    const customerId = await upsertCustomer(db, actor.businessId, input);
    const res = await db.query<{ id: string }>(
      `INSERT INTO reservations (business_id, location_id, customer_id, table_id, starts_at, guests, notes, deposit, status, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', 'staff', $9) RETURNING id`,
      [actor.businessId, actor.locationId, customerId, input.tableId || null, at, input.guests, notes, deposit, actor.id],
    );
    await audit(db, actor, {
      action: 'reservation.create',
      entity: 'reservation',
      entityId: res.rows[0].id,
      summary: `Reservó para ${input.name.trim()} (${input.guests} p.) el ${input.date} a las ${input.time}${table ? ` en la mesa ${table.number}` : ''}`,
    });
    return res.rows[0].id;
  });
}

/** Reserva que pide el cliente desde el enlace público: queda "por confirmar" hasta que el equipo la confirme. */
export async function requestReservation(slug: string, input: ReservationInput & { locationId?: string | null }) {
  const business = await getBusinessBySlug(slug);
  if (!business || !business.isActive) throw new AppError('NOT_FOUND', 'No encontramos ese restaurante.');
  const enabled = (await query<{ on: boolean }>(`SELECT reservations_enabled AS on FROM businesses WHERE id = $1`, [business.id]))[0]?.on;
  if (!enabled) throw new AppError('FORBIDDEN', 'Este restaurante no está recibiendo reservas en línea.');
  checkGuests(input.guests);
  if (input.guests > 20) throw new AppError('INVALID', 'Para más de 20 personas, escríbele directamente al restaurante.');
  const notes = input.notes?.trim() ? requireText(input.notes, 'Comentario', 2, 300) : null;
  const locations = await listLocations(business.id, { activeOnly: true });
  const location = input.locationId ? locations.find((l) => l.id === input.locationId) : locations.length === 1 ? locations[0] : null;
  if (!location) throw new AppError('INVALID', 'Elige la sede.');
  return transaction(async (db) => {
    const at = await startsAt(db, business.id, input.date, input.time);
    const customerId = await upsertCustomer(db, business.id, input);
    // Freno: un mismo teléfono no deja más de 3 reservas pendientes.
    const pending = await db.query(`SELECT 1 FROM reservations WHERE customer_id = $1 AND status = 'requested' AND starts_at > now()`, [customerId]);
    if ((pending.rowCount ?? 0) >= 3) throw new AppError('CONFLICT', 'Ya tienes reservas por confirmar. Espera a que el restaurante te responda.');
    const res = await db.query<{ id: string }>(
      `INSERT INTO reservations (business_id, location_id, customer_id, starts_at, guests, notes, status, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'requested', 'online') RETURNING id`,
      [business.id, location.id, customerId, at, input.guests, notes],
    );
    await audit(db, { businessId: business.id, locationId: location.id, name: 'Cliente (en línea)' }, {
      action: 'reservation.request',
      entity: 'reservation',
      entityId: res.rows[0].id,
      summary: `${input.name.trim()} pidió una reserva para ${input.guests} p. el ${input.date} a las ${input.time}`,
    });
    return { id: res.rows[0].id, businessName: business.name, locationName: location.name };
  });
}

export type Reservation = {
  id: string;
  startsAt: Date;
  guests: number;
  notes: string | null;
  deposit: number;
  status: ReservationStatus;
  source: 'staff' | 'online';
  customerName: string;
  phone: string;
  tableId: string | null;
  tableNumber: string | null;
  sessionId: string | null;
};

const RES_SELECT = `SELECT r.id, r.starts_at AS "startsAt", r.guests, r.notes, r.deposit, r.status, r.source, c.name AS "customerName", c.phone,
       r.table_id AS "tableId", t.number AS "tableNumber", r.session_id AS "sessionId"
  FROM reservations r JOIN customers c ON c.id = r.customer_id LEFT JOIN dining_tables t ON t.id = r.table_id`;

type ResRow = Omit<Reservation, 'deposit'> & { deposit: string };
const toRes = (r: ResRow): Reservation => ({ ...r, deposit: Number(r.deposit) });

/** Reservas de un día (en la zona del negocio) de la sede, y las pendientes por confirmar de cualquier día. */
export async function listReservations(actor: Actor, date: string) {
  requirePermission(actor, 'reservations.manage');
  if (!DATE.test(date)) throw new AppError('INVALID', 'Fecha no válida.');
  const [day, requested] = await Promise.all([
    query<ResRow>(
      `${RES_SELECT} JOIN businesses b ON b.id = r.business_id
        WHERE r.location_id = $1 AND r.business_id = $2
          AND r.starts_at >= ($3::date)::timestamp AT TIME ZONE b.timezone AND r.starts_at < ($3::date + 1)::timestamp AT TIME ZONE b.timezone
        ORDER BY r.starts_at`,
      [actor.locationId, actor.businessId, date],
    ),
    query<ResRow>(
      `${RES_SELECT} WHERE r.location_id = $1 AND r.business_id = $2 AND r.status = 'requested' AND r.starts_at > now() - interval '1 hour' ORDER BY r.starts_at`,
      [actor.locationId, actor.businessId],
    ),
  ]);
  return { day: day.map(toRes), requested: requested.map(toRes) };
}

async function lockReservation(db: Db, actor: Actor, id: string) {
  if (!isUuid(id)) throw new AppError('NOT_FOUND', 'No encontramos esa reserva.');
  const r = (
    await db.query<ResRow>(`${RES_SELECT} WHERE r.id = $1 AND r.location_id = $2 AND r.business_id = $3 FOR UPDATE OF r`, [id, actor.locationId, actor.businessId])
  ).rows[0];
  if (!r) throw new AppError('NOT_FOUND', 'No encontramos esa reserva.');
  return toRes(r);
}

/** Confirmar, cancelar o marcar que no llegó. También asigna (o cambia) la mesa. */
export async function updateReservation(actor: Actor, id: string, input: { status?: string; tableId?: string | null }) {
  requirePermission(actor, 'reservations.manage');
  await transaction(async (db) => {
    const r = await lockReservation(db, actor, id);
    if (r.status === 'arrived') throw new AppError('CONFLICT', 'Esa reserva ya llegó: su mesa está abierta.');
    let status: ReservationStatus = r.status;
    if (input.status) {
      if (!['confirmed', 'cancelled', 'no_show'].includes(input.status)) throw new AppError('INVALID', 'Estado no válido.');
      status = input.status as ReservationStatus;
    }
    let tableId = r.tableId;
    if (input.tableId !== undefined) {
      tableId = input.tableId || null;
      if (tableId && tableId !== r.tableId) await checkTable(db, actor, tableId, r.startsAt, r.id);
    }
    await db.query(`UPDATE reservations SET status = $2, table_id = $3, updated_at = now() WHERE id = $1`, [id, status, tableId]);
    if (status !== r.status) {
      await audit(db, actor, {
        action: `reservation.${status}`,
        entity: 'reservation',
        entityId: id,
        summary: `Reserva de ${r.customerName}: ${STATUS_LABEL[r.status].toLowerCase()} → ${STATUS_LABEL[status].toLowerCase()}`,
      });
    }
  });
}

/** El cliente llegó: abre su mesa (la asignada o la que se elija) y deja la reserva como "llegó". */
export async function seatReservation(actor: Actor, id: string, tableId?: string | null) {
  requirePermission(actor, 'tables.open');
  const r = await transaction((db) => lockReservation(db, actor, id));
  if (r.status !== 'confirmed' && r.status !== 'requested') throw new AppError('CONFLICT', 'Esa reserva no está pendiente de llegar.');
  const table = tableId || r.tableId;
  if (!table) throw new AppError('INVALID', 'Elige la mesa donde se va a sentar.');
  const sessionId = await openTable(actor, table, { guests: r.guests, notes: `Reserva de ${r.customerName}${r.notes ? ` · ${r.notes}` : ''}`.slice(0, 300) });
  await transaction(async (db) => {
    await db.query(`UPDATE reservations SET status = 'arrived', session_id = $2, table_id = $3, updated_at = now() WHERE id = $1`, [id, sessionId, table]);
    await audit(db, actor, { action: 'reservation.arrived', entity: 'reservation', entityId: id, summary: `Llegó la reserva de ${r.customerName}` });
  });
  return sessionId;
}

/** Mesas apartadas por una reserva confirmada en este momento (para pintarlas en el plano). */
export async function heldTables(actor: Pick<Actor, 'businessId' | 'locationId'>) {
  const rows = await query<{ tableId: string; customerName: string; startsAt: Date; guests: number }>(
    `SELECT r.table_id AS "tableId", c.name AS "customerName", r.starts_at AS "startsAt", r.guests
       FROM reservations r JOIN customers c ON c.id = r.customer_id
      WHERE r.location_id = $1 AND r.business_id = $2 AND r.status = 'confirmed' AND r.table_id IS NOT NULL
        AND now() BETWEEN r.starts_at - make_interval(mins => $3) AND r.starts_at + make_interval(mins => $4)`,
    [actor.locationId, actor.businessId, HOLD_BEFORE_MIN, HOLD_AFTER_MIN],
  );
  return new Map(rows.map((r) => [r.tableId, r]));
}

/** La carta pública del QR: solo lo que está en la carta, con precios y agotados. */
export async function publicMenu(slug: string) {
  const business = await getBusinessBySlug(slug);
  if (!business || !business.isActive) return null;
  const extra = (
    await query<{ phone: string | null; reservations: boolean }>(`SELECT public_phone AS phone, reservations_enabled AS reservations FROM businesses WHERE id = $1`, [business.id])
  )[0];
  const menu = await getMenu(business.id, { activeOnly: true });
  const locations = await listLocations(business.id, { activeOnly: true });
  return { business, phone: extra.phone, reservations: extra.reservations, locations: locations.map(({ id, name }) => ({ id, name })), ...menu };
}

/** Datos públicos que el dueño cambia: teléfono/WhatsApp y si recibe reservas en línea. */
export async function updatePublicSettings(actor: Actor, input: { phone?: string; reservationsEnabled: boolean }) {
  requirePermission(actor, 'locations.manage');
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  await transaction(async (db) => {
    await db.query(`UPDATE businesses SET public_phone = $2, reservations_enabled = $3 WHERE id = $1`, [actor.businessId, phone, input.reservationsEnabled]);
    await audit(db, actor, {
      action: 'business.public',
      entity: 'business',
      entityId: actor.businessId,
      summary: `Cambió los datos públicos (reservas en línea ${input.reservationsEnabled ? 'activas' : 'apagadas'})`,
    });
  });
}
