// Módulo 13: servicios y citas (barberías, peluquerías, spas). Reutiliza clientes, equipo, caja y finanzas:
// la cita se cobra en la misma caja y entra en las ventas; cada profesional ve su agenda y su comisión.
import { query, transaction, type Db } from './db';
import { METHOD_LABEL, isMethod, lockOpenShift } from './cash';
import { formatCop } from './format';
import { can } from './permissions';
import { normalizePhone } from './reservations';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export type Service = { id: string; name: string; price: number; duration: number; commission: number; isActive: boolean };
export const APPOINTMENT_STATUS = { scheduled: 'Agendada', done: 'Atendida, por cobrar', paid: 'Pagada', no_show: 'No llegó', cancelled: 'Cancelada' } as const;
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function requireText(value: string, label: string, min: number, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

// ───────── servicios ─────────

export async function listServices(businessId: string, { activeOnly = false } = {}): Promise<Service[]> {
  const rows = await query<Omit<Service, 'price'> & { price: string }>(
    `SELECT id, name, price, duration, commission, is_active AS "isActive" FROM services WHERE business_id = $1 ${activeOnly ? 'AND is_active' : ''} ORDER BY is_active DESC, name`,
    [businessId],
  );
  return rows.map((r) => ({ ...r, price: Number(r.price) }));
}

export async function saveService(actor: Actor, input: { id?: string | null; name: string; price: number; duration: number; commission: number; isActive?: boolean }) {
  requirePermission(actor, 'menu.edit');
  const name = requireText(input.name, 'Nombre del servicio', 2, 80);
  if (!Number.isInteger(input.price) || input.price < 0) throw new AppError('INVALID', 'Precio: escribe el valor en pesos.');
  if (!Number.isInteger(input.duration) || input.duration < 5 || input.duration > 600) throw new AppError('INVALID', 'Duración: de 5 a 600 minutos.');
  if (!Number.isInteger(input.commission) || input.commission < 0 || input.commission > 100) throw new AppError('INVALID', 'Comisión: de 0 a 100 %.');
  try {
    return await transaction(async (db) => {
      if (input.id) {
        if (!isUuid(input.id)) throw new AppError('NOT_FOUND', 'No encontramos ese servicio.');
        const res = await db.query(
          `UPDATE services SET name = $3, price = $4, duration = $5, commission = $6, is_active = $7 WHERE id = $1 AND business_id = $2`,
          [input.id, actor.businessId, name, input.price, input.duration, input.commission, input.isActive ?? true],
        );
        if (!res.rowCount) throw new AppError('NOT_FOUND', 'No encontramos ese servicio.');
        await audit(db, actor, { action: 'service.update', entity: 'service', entityId: input.id, summary: `Cambió el servicio ${name} (${formatCop(input.price)}, ${input.commission} % de comisión)` });
        return input.id;
      }
      const res = await db.query<{ id: string }>(
        `INSERT INTO services (business_id, name, price, duration, commission) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [actor.businessId, name, input.price, input.duration, input.commission],
      );
      await audit(db, actor, { action: 'service.create', entity: 'service', entityId: res.rows[0].id, summary: `Creó el servicio ${name} (${formatCop(input.price)}, ${input.duration} min)` });
      return res.rows[0].id;
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new AppError('CONFLICT', `Ya hay un servicio ${name}.`);
    throw error;
  }
}

/** Profesionales que atienden en la sede (rol Profesional, de esta sede o de todas). */
export async function listProfessionals(actor: Pick<Actor, 'businessId' | 'locationId'>) {
  return query<{ id: string; name: string }>(
    `SELECT id, name FROM staff WHERE business_id = $1 AND role = 'pro' AND is_active AND (location_id IS NULL OR location_id = $2) ORDER BY name`,
    [actor.businessId, actor.locationId],
  );
}

// ───────── agenda ─────────

export type Appointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  price: number;
  commission: number;
  notes: string | null;
  serviceName: string;
  staffId: string;
  staffName: string;
  customerName: string;
  phone: string;
  paid: number;
};

const APPT_SELECT = `SELECT a.id, a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.status, a.price, a.commission, a.notes,
       sv.name AS "serviceName", a.staff_id AS "staffId", st.name AS "staffName", c.name AS "customerName", c.phone,
       (SELECT COALESCE(sum(amount), 0) FROM payments p WHERE p.appointment_id = a.id AND p.reversed_at IS NULL) AS paid
  FROM appointments a JOIN services sv ON sv.id = a.service_id JOIN staff st ON st.id = a.staff_id JOIN customers c ON c.id = a.customer_id`;

type ApptRow = Omit<Appointment, 'price' | 'paid'> & { price: string; paid: string };
const toAppt = (r: ApptRow): Appointment => ({ ...r, price: Number(r.price), paid: Number(r.paid) });

export async function createAppointment(
  actor: Actor,
  input: { name: string; phone: string; serviceId: string; staffId: string; date: string; time: string; notes?: string },
) {
  requirePermission(actor, 'agenda.manage');
  if (!isUuid(input.serviceId)) throw new AppError('INVALID', 'Elige un servicio.');
  if (!isUuid(input.staffId)) throw new AppError('INVALID', 'Elige quién atiende.');
  if (!DATE.test(input.date) || !TIME.test(input.time)) throw new AppError('INVALID', 'Elige fecha y hora.');
  const name = requireText(input.name, 'Nombre del cliente', 2, 120);
  const phone = normalizePhone(input.phone);
  const notes = input.notes?.trim() ? requireText(input.notes, 'Nota', 2, 300) : null;
  return transaction(async (db) => {
    const service = (
      await db.query<{ name: string; price: string; duration: number; commission: number }>(
        `SELECT name, price, duration, commission FROM services WHERE id = $1 AND business_id = $2 AND is_active`,
        [input.serviceId, actor.businessId],
      )
    ).rows[0];
    if (!service) throw new AppError('INVALID', 'Elige un servicio.');
    const pro = (
      await db.query<{ name: string }>(
        `SELECT name FROM staff WHERE id = $1 AND business_id = $2 AND role = 'pro' AND is_active AND (location_id IS NULL OR location_id = $3) FOR UPDATE`,
        [input.staffId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!pro) throw new AppError('INVALID', 'Elige quién atiende.');
    const times = (
      await db.query<{ start: Date; end: Date; past: boolean }>(
        `SELECT x.s AS start, x.s + make_interval(mins => $4) AS end, x.s < now() - interval '1 hour' AS past
           FROM (SELECT ($2::date + $3::time) AT TIME ZONE b.timezone AS s FROM businesses b WHERE b.id = $1) x`,
        [actor.businessId, input.date, input.time, service.duration],
      )
    ).rows[0];
    if (times.past) throw new AppError('INVALID', 'Esa hora ya pasó.');
    // El candado sobre el profesional (FOR UPDATE arriba) evita que dos citas se crucen al agendarse a la vez.
    const clash = await db.query<{ hhmm: string }>(
      `SELECT to_char(a.starts_at AT TIME ZONE b.timezone, 'HH12:MI a. m.') AS hhmm FROM appointments a JOIN businesses b ON b.id = a.business_id
        WHERE a.staff_id = $1 AND a.status IN ('scheduled', 'done', 'paid') AND a.starts_at < $3 AND a.ends_at > $2 LIMIT 1`,
      [input.staffId, times.start, times.end],
    );
    if (clash.rowCount) throw new AppError('CONFLICT', `${pro.name} ya tiene una cita que se cruza con esa hora.`);
    const customer = (
      await db.query<{ id: string }>(
        `INSERT INTO customers (business_id, name, phone) VALUES ($1, $2, $3)
         ON CONFLICT (business_id, phone) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [actor.businessId, name, phone],
      )
    ).rows[0];
    const res = await db.query<{ id: string }>(
      `INSERT INTO appointments (business_id, location_id, customer_id, service_id, staff_id, starts_at, ends_at, price, commission, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [actor.businessId, actor.locationId, customer.id, input.serviceId, input.staffId, times.start, times.end, Number(service.price), service.commission, notes, actor.id],
    );
    await audit(db, actor, {
      action: 'appointment.create',
      entity: 'appointment',
      entityId: res.rows[0].id,
      summary: `Agendó ${service.name} para ${name} con ${pro.name} el ${input.date} a las ${input.time}`,
    });
    return res.rows[0].id;
  });
}

/** Citas de un día en la sede. El profesional solo ve las suyas. */
export async function listAgenda(actor: Actor, date: string) {
  requirePermission(actor, 'agenda.view');
  if (!DATE.test(date)) throw new AppError('INVALID', 'Fecha no válida.');
  const onlyMine = !can(actor.role, 'agenda.manage');
  const rows = await query<ApptRow>(
    `${APPT_SELECT} JOIN businesses b ON b.id = a.business_id
      WHERE a.location_id = $1 AND a.business_id = $2 AND ($4::uuid IS NULL OR a.staff_id = $4)
        AND a.starts_at >= ($3::date)::timestamp AT TIME ZONE b.timezone AND a.starts_at < ($3::date + 1)::timestamp AT TIME ZONE b.timezone
      ORDER BY a.starts_at`,
    [actor.locationId, actor.businessId, date, onlyMine ? actor.id : null],
  );
  return rows.map(toAppt);
}

async function lockAppointment(db: Db, actor: Actor, id: string) {
  if (!isUuid(id)) throw new AppError('NOT_FOUND', 'No encontramos esa cita.');
  const r = (await db.query<ApptRow>(`${APPT_SELECT} WHERE a.id = $1 AND a.location_id = $2 AND a.business_id = $3 FOR UPDATE OF a`, [id, actor.locationId, actor.businessId])).rows[0];
  if (!r) throw new AppError('NOT_FOUND', 'No encontramos esa cita.');
  return toAppt(r);
}

/** Atendida, no llegó o cancelada. El profesional puede marcar como atendida su propia cita. */
export async function setAppointmentStatus(actor: Actor, id: string, status: string) {
  if (!['done', 'no_show', 'cancelled', 'scheduled'].includes(status)) throw new AppError('INVALID', 'Estado no válido.');
  await transaction(async (db) => {
    const a = await lockAppointment(db, actor, id);
    const own = a.staffId === actor.id && status === 'done';
    if (!own) requirePermission(actor, 'agenda.manage');
    if (a.status === 'paid') throw new AppError('CONFLICT', 'Esa cita ya se pagó.');
    await db.query(`UPDATE appointments SET status = $2 WHERE id = $1`, [id, status]);
    await audit(db, actor, {
      action: `appointment.${status}`,
      entity: 'appointment',
      entityId: id,
      summary: `Cita de ${a.customerName} (${a.serviceName}): ${APPOINTMENT_STATUS[status as AppointmentStatus].toLowerCase()}`,
    });
  });
}

/** Cobra la cita completa en la caja abierta (con propina opcional). Un mismo `clientKey` no cobra dos veces. */
export async function payAppointment(actor: Actor, id: string, input: { method: string; tip?: number; received?: number | null; reference?: string; clientKey: string }) {
  requirePermission(actor, 'cash.operate');
  if (!isMethod(input.method)) throw new AppError('INVALID', 'Elige cómo paga.');
  if (!isUuid(input.clientKey)) throw new AppError('INVALID', 'Pago sin identificador. Recarga la página.');
  const tip = input.tip ?? 0;
  if (!Number.isInteger(tip) || tip < 0) throw new AppError('INVALID', 'Propina: escribe el valor en pesos.');
  const previous = await query<{ id: string }>(`SELECT id FROM payments WHERE business_id = $1 AND client_key = $2`, [actor.businessId, input.clientKey]);
  if (previous[0]) return { paymentId: previous[0].id, change: null, duplicate: true };
  return transaction(async (db) => {
    const shift = await lockOpenShift(db, actor);
    const a = await lockAppointment(db, actor, id);
    if (a.status === 'paid') throw new AppError('CONFLICT', 'Esa cita ya se pagó.');
    if (a.status === 'cancelled' || a.status === 'no_show') throw new AppError('CONFLICT', 'Esa cita no se atendió.');
    const amount = a.price - a.paid;
    if (amount <= 0) throw new AppError('CONFLICT', 'Esa cita no tiene nada por pagar.');
    let received: number | null = null;
    let change: number | null = null;
    if (input.method === 'cash') {
      received = input.received ?? amount + tip;
      if (!Number.isInteger(received) || received < amount + tip) throw new AppError('INVALID', `Recibiste ${formatCop(received)}: no alcanza para ${formatCop(amount + tip)}.`);
      change = received - amount - tip;
    }
    const res = await db.query<{ id: string }>(
      `INSERT INTO payments (business_id, location_id, appointment_id, shift_id, method, amount, tip, received, change_given, reference, client_key, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [actor.businessId, actor.locationId, id, shift.id, input.method, amount, tip, received, change, input.reference?.trim() || null, input.clientKey, actor.id],
    );
    await db.query(`UPDATE appointments SET status = 'paid' WHERE id = $1`, [id]);
    await audit(db, actor, {
      action: 'payment.create',
      entity: 'payment',
      entityId: res.rows[0].id,
      summary: `Cobró ${formatCop(amount)} en ${METHOD_LABEL[input.method as keyof typeof METHOD_LABEL].toLowerCase()} por ${a.serviceName} de ${a.customerName}${tip ? ` + propina ${formatCop(tip)}` : ''}`,
    });
    return { paymentId: res.rows[0].id, change, duplicate: false };
  });
}

export type CommissionRow = { staffId: string; name: string; services: number; sales: number; commission: number; tips: number };

/** Comisiones de un periodo (citas pagadas). El profesional solo ve la suya. */
export async function commissions(actor: Actor, range: { from: string; to: string }, timeZone: string): Promise<CommissionRow[]> {
  requirePermission(actor, 'agenda.view');
  if (!DATE.test(range.from) || !DATE.test(range.to) || range.from > range.to) throw new AppError('INVALID', 'Fechas no válidas.');
  const onlyMine = !can(actor.role, 'agenda.manage');
  const rows = await query<{ staffId: string; name: string; services: number; sales: string; commission: string; tips: string }>(
    `SELECT st.id AS "staffId", st.name, count(*)::int AS services, sum(a.price) AS sales, sum(a.price * a.commission / 100.0) AS commission,
            COALESCE(sum((SELECT COALESCE(sum(tip), 0) FROM payments p WHERE p.appointment_id = a.id AND p.reversed_at IS NULL)), 0) AS tips
       FROM appointments a JOIN staff st ON st.id = a.staff_id
      WHERE a.business_id = $1 AND a.location_id = $2 AND a.status = 'paid' AND ($6::uuid IS NULL OR a.staff_id = $6)
        AND a.starts_at >= ($3::date)::timestamp AT TIME ZONE $5 AND a.starts_at < ($4::date + 1)::timestamp AT TIME ZONE $5
      GROUP BY st.id, st.name ORDER BY sum(a.price) DESC`,
    [actor.businessId, actor.locationId, range.from, range.to, timeZone, onlyMine ? actor.id : null],
  );
  return rows.map((r) => ({ ...r, sales: Number(r.sales), commission: Math.round(Number(r.commission)), tips: Number(r.tips) }));
}
