// Datos de la asistencia: negocios, empleados y jornadas.
import type { PoolClient } from 'pg';
import { currentCode, isValidCode, newKioskSecret, pinHash, CODE_WINDOW_MS } from './codes';
import { query, transaction } from './db';

export type AttendanceEmployee = {
  id: string;
  name: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  isActive: boolean;
};

export type AttendanceBusinessSummary = { id: string; name: string; slug: string; isActive: boolean; employees: number };

export type AttendanceBusiness = {
  id: string;
  name: string;
  slug: string;
  kioskSecret: string;
  isActive: boolean;
  employees: AttendanceEmployee[];
};

/** Fechas en texto ISO: así pasan tal cual a los componentes del navegador. */
export type AttendanceRecord = {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  editedAt: string | null;
  employee: { name: string; shiftStart: string | null; shiftEnd: string | null };
};

export type PunchResult = { employeeName: string; type: 'in' | 'out'; at: string; workedMinutes: number | null };

/** Error con un mensaje para mostrar tal cual y un código para decidir qué ofrecer en pantalla. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MINUTE = 60_000;
/** Dos marcaciones seguidas en menos de esto son un doble escaneo, no una entrada y una salida. */
const DOUBLE_SCAN_MS = 2 * MINUTE;
/** Una entrada sin salida más vieja que esto se da por olvidada: la próxima marcación abre otra jornada. */
const FORGOTTEN_MS = 16 * 60 * MINUTE;
const MAX_SHIFT_MS = 24 * 60 * MINUTE;
const MAX_RANGE_DAYS = 62;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isUuid = (value: string) => UUID.test(value);

// ───────── validación ─────────

function cleanName(name: string, what = 'el nombre'): string {
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length < 2 || value.length > 120) throw new AppError('INVALID', `Escribe ${what} (entre 2 y 120 letras).`);
  return value;
}

function cleanPin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) throw new AppError('INVALID', 'El PIN debe tener exactamente 4 números.');
  return pin;
}

/** Turno: las dos horas o ninguna. */
function cleanShift(start: string, end: string): { shiftStart: string | null; shiftEnd: string | null } {
  if (!start && !end) return { shiftStart: null, shiftEnd: null };
  if (!start || !end) throw new AppError('INVALID', 'Pon la hora de inicio y la de fin del turno, o deja las dos vacías.');
  if (!TIME.test(start) || !TIME.test(end)) throw new AppError('INVALID', 'La hora del turno debe tener el formato HH:MM (por ejemplo 08:00).');
  return { shiftStart: start, shiftEnd: end };
}

function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'negocio';
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23505';
const pinTaken = () => new AppError('PIN_TAKEN', 'Ese PIN ya lo tiene otro empleado de este negocio.');

// ───────── público: tablet y celular del empleado ─────────

/** Lo que muestra la tablet de la entrada: el código vigente y cuánto le queda. */
export async function getKiosk(secret: string) {
  if (!secret || secret.length > 64) return null;
  const [business] = await query<{ name: string; slug: string; kiosk_secret: string }>(
    'SELECT name, slug, kiosk_secret FROM businesses WHERE kiosk_secret = $1 AND is_active',
    [secret],
  );
  if (!business) return null;
  return { name: business.name, slug: business.slug, windowMs: CODE_WINDOW_MS, ...currentCode(business.kiosk_secret, business.slug) };
}

export async function getPublicBusiness(slug: string): Promise<{ name: string } | null> {
  const [business] = await query<{ name: string }>('SELECT name FROM businesses WHERE slug = $1 AND is_active', [slug]);
  return business ?? null;
}

/** Marca entrada o salida: si el empleado tiene una jornada abierta, la cierra; si no, abre una. */
export async function punch(slug: string, code: string, pin: string, now = new Date()): Promise<PunchResult> {
  const [business] = await query<{ id: string; slug: string; kiosk_secret: string }>(
    'SELECT id, slug, kiosk_secret FROM businesses WHERE slug = $1 AND is_active',
    [slug],
  );
  if (!business) throw new AppError('NOT_FOUND', 'Este negocio no existe.');
  if (!code || code.length > 64 || !isValidCode(business.kiosk_secret, business.slug, code, now.getTime())) {
    throw new AppError('CODE_EXPIRED', 'El código ya venció. Escanea otra vez el QR de la entrada.');
  }
  if (!/^\d{4}$/.test(pin)) throw new AppError('PIN_INVALID', 'El PIN tiene 4 números.');

  return transaction(async (client) => {
    // Bloquea al empleado: dos toques seguidos no pueden abrir dos jornadas.
    const employee = (
      await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM employees WHERE business_id = $1 AND pin_hash = $2 AND is_active FOR UPDATE',
        [business.id, pinHash(business.id, pin)],
      )
    ).rows[0];
    if (!employee) throw new AppError('PIN_INVALID', 'PIN incorrecto. Revísalo e intenta de nuevo.');

    const last = (
      await client.query<{ id: string; clock_in: Date; clock_out: Date | null }>(
        'SELECT id, clock_in, clock_out FROM records WHERE employee_id = $1 ORDER BY clock_in DESC LIMIT 1',
        [employee.id],
      )
    ).rows[0];
    const elapsed = (from: Date) => now.getTime() - from.getTime();

    if (last && !last.clock_out && elapsed(last.clock_in) < FORGOTTEN_MS) {
      if (elapsed(last.clock_in) < DOUBLE_SCAN_MS) throw new AppError('DOUBLE_SCAN', 'Ya marcaste tu entrada hace un momento.');
      await client.query('UPDATE records SET clock_out = $1 WHERE id = $2', [now, last.id]);
      return { employeeName: employee.name, type: 'out', at: now.toISOString(), workedMinutes: Math.round(elapsed(last.clock_in) / MINUTE) };
    }
    if (last?.clock_out && elapsed(last.clock_out) < DOUBLE_SCAN_MS) {
      throw new AppError('DOUBLE_SCAN', 'Ya marcaste tu salida hace un momento.');
    }
    await client.query('INSERT INTO records (business_id, employee_id, clock_in) VALUES ($1, $2, $3)', [business.id, employee.id, now]);
    return { employeeName: employee.name, type: 'in', at: now.toISOString(), workedMinutes: null };
  });
}

// ───────── panel ─────────

export async function listBusinesses(): Promise<AttendanceBusinessSummary[]> {
  const rows = await query<{ id: string; name: string; slug: string; is_active: boolean; employees: string }>(
    `SELECT b.id, b.name, b.slug, b.is_active,
            (SELECT count(*) FROM employees e WHERE e.business_id = b.id AND e.is_active) AS employees
       FROM businesses b ORDER BY b.name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, isActive: r.is_active, employees: Number(r.employees) }));
}

export async function getBusiness(id: string): Promise<AttendanceBusiness | null> {
  if (!isUuid(id)) return null;
  const [business] = await query<{ id: string; name: string; slug: string; kiosk_secret: string; is_active: boolean }>(
    'SELECT id, name, slug, kiosk_secret, is_active FROM businesses WHERE id = $1',
    [id],
  );
  if (!business) return null;
  const employees = await query<{ id: string; name: string; shift_start: string | null; shift_end: string | null; is_active: boolean }>(
    'SELECT id, name, shift_start, shift_end, is_active FROM employees WHERE business_id = $1 ORDER BY is_active DESC, name',
    [id],
  );
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    kioskSecret: business.kiosk_secret,
    isActive: business.is_active,
    employees: employees.map((e) => ({ id: e.id, name: e.name, shiftStart: e.shift_start, shiftEnd: e.shift_end, isActive: e.is_active })),
  };
}

export async function createBusiness(name: string): Promise<string> {
  const clean = cleanName(name, 'el nombre del negocio');
  const base = slugify(clean);
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    try {
      const [row] = await query<{ id: string }>('INSERT INTO businesses (name, slug, kiosk_secret) VALUES ($1, $2, $3) RETURNING id', [
        clean,
        slug,
        newKioskSecret(),
      ]);
      return row.id;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new AppError('INVALID', 'No se pudo crear el negocio con ese nombre.');
}

/** Genera un enlace nuevo para la tablet; el anterior deja de funcionar. */
export async function rotateKiosk(businessId: string) {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'Negocio no encontrado.');
  await query('UPDATE businesses SET kiosk_secret = $1 WHERE id = $2', [newKioskSecret(), businessId]);
}

export async function createEmployee(businessId: string, input: { name: string; pin: string; shiftStart: string; shiftEnd: string }) {
  if (!(await getBusiness(businessId))) throw new AppError('NOT_FOUND', 'Negocio no encontrado.');
  const name = cleanName(input.name, 'el nombre del empleado');
  const pin = cleanPin(input.pin);
  const { shiftStart, shiftEnd } = cleanShift(input.shiftStart, input.shiftEnd);
  try {
    const [row] = await query<{ id: string }>(
      'INSERT INTO employees (business_id, name, pin_hash, shift_start, shift_end) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [businessId, name, pinHash(businessId, pin), shiftStart, shiftEnd],
    );
    return row.id;
  } catch (error) {
    if (isUniqueViolation(error)) throw pinTaken();
    throw error;
  }
}

/** PIN vacío = deja el que tenía. */
export async function updateEmployee(
  businessId: string,
  employeeId: string,
  input: { name: string; pin: string; shiftStart: string; shiftEnd: string; isActive: boolean },
) {
  if (!isUuid(businessId) || !isUuid(employeeId)) throw new AppError('NOT_FOUND', 'Empleado no encontrado.');
  const name = cleanName(input.name, 'el nombre del empleado');
  const pin = input.pin ? cleanPin(input.pin) : null;
  const { shiftStart, shiftEnd } = cleanShift(input.shiftStart, input.shiftEnd);
  try {
    const rows = await query(
      `UPDATE employees SET name = $1, shift_start = $2, shift_end = $3, is_active = $4, pin_hash = COALESCE($5, pin_hash)
        WHERE id = $6 AND business_id = $7 RETURNING id`,
      [name, shiftStart, shiftEnd, input.isActive, pin ? pinHash(businessId, pin) : null, employeeId, businessId],
    );
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Empleado no encontrado.');
  } catch (error) {
    if (isUniqueViolation(error)) throw pinTaken();
    throw error;
  }
}

type RecordRow = {
  id: string;
  employee_id: string;
  clock_in: Date;
  clock_out: Date | null;
  edited_at: Date | null;
  name: string;
  shift_start: string | null;
  shift_end: string | null;
};

const toRecord = (r: RecordRow): AttendanceRecord => ({
  id: r.id,
  employeeId: r.employee_id,
  clockIn: r.clock_in.toISOString(),
  clockOut: r.clock_out?.toISOString() ?? null,
  editedAt: r.edited_at?.toISOString() ?? null,
  employee: { name: r.name, shiftStart: r.shift_start, shiftEnd: r.shift_end },
});

/** Inicio del día AAAA-MM-DD en Colombia (UTC-5, sin horario de verano). */
const dayStart = (day: string) => new Date(`${day}T00:00:00-05:00`);

/** Jornadas que empezaron entre dos días (hora de Colombia), ambos incluidos. */
export async function listRecords(businessId: string, fromDay: string, toDay: string): Promise<AttendanceRecord[]> {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'Negocio no encontrado.');
  if (!DAY.test(fromDay) || !DAY.test(toDay)) throw new AppError('INVALID', 'Fechas inválidas.');
  const from = dayStart(fromDay);
  const to = new Date(dayStart(toDay).getTime() + 24 * 60 * MINUTE);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new AppError('INVALID', 'Rango de fechas inválido.');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * MINUTE) {
    throw new AppError('INVALID', `El rango no puede pasar de ${MAX_RANGE_DAYS} días.`);
  }
  const rows = await query<RecordRow>(
    `SELECT r.id, r.employee_id, r.clock_in, r.clock_out, r.edited_at, e.name, e.shift_start, e.shift_end
       FROM records r JOIN employees e ON e.id = r.employee_id
      WHERE r.business_id = $1 AND r.clock_in >= $2 AND r.clock_in < $3
      ORDER BY r.clock_in`,
    [businessId, from, to],
  );
  return rows.map(toRecord);
}

async function lockRecord(client: PoolClient, businessId: string, recordId: string) {
  if (!isUuid(businessId) || !isUuid(recordId)) throw new AppError('NOT_FOUND', 'Registro no encontrado.');
  const record = (
    await client.query<{ employee_id: string; clock_in: Date; clock_out: Date | null }>(
      'SELECT employee_id, clock_in, clock_out FROM records WHERE id = $1 AND business_id = $2 FOR UPDATE',
      [recordId, businessId],
    )
  ).rows[0];
  if (!record) throw new AppError('NOT_FOUND', 'Registro no encontrado.');
  return record;
}

const snapshot = (r: { employee_id: string; clock_in: Date; clock_out: Date | null }) => ({
  employeeId: r.employee_id,
  clockIn: r.clock_in.toISOString(),
  clockOut: r.clock_out?.toISOString() ?? null,
});

/** Corrección a mano: una salida olvidada o una hora mal marcada. `clockOut` null = sin salida. */
export async function updateRecord(businessId: string, recordId: string, clockIn: Date, clockOut: Date | null) {
  if (Number.isNaN(clockIn.getTime()) || (clockOut && Number.isNaN(clockOut.getTime()))) throw new AppError('INVALID', 'Revisa las horas.');
  if (clockOut && clockOut <= clockIn) throw new AppError('INVALID', 'La salida debe ser después de la entrada.');
  if (clockOut && clockOut.getTime() - clockIn.getTime() > MAX_SHIFT_MS) throw new AppError('INVALID', 'Una jornada no puede pasar de 24 horas.');
  await transaction(async (client) => {
    const before = await lockRecord(client, businessId, recordId);
    await client.query('UPDATE records SET clock_in = $1, clock_out = $2, edited_at = now() WHERE id = $3', [clockIn, clockOut, recordId]);
    await client.query("INSERT INTO record_changes (record_id, action, before) VALUES ($1, 'edited', $2)", [recordId, snapshot(before)]);
  });
}

export async function deleteRecord(businessId: string, recordId: string) {
  await transaction(async (client) => {
    const before = await lockRecord(client, businessId, recordId);
    await client.query('DELETE FROM records WHERE id = $1', [recordId]);
    await client.query("INSERT INTO record_changes (record_id, action, before) VALUES ($1, 'deleted', $2)", [recordId, snapshot(before)]);
  });
}
