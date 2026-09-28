// Datos de la asistencia: negocios, empleados y jornadas.
import { timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { currentCode, isValidCode, newKioskSecret, pinHash, CODE_WINDOW_MS } from './codes';
import { query, transaction } from './db';
import { t, type MessageKey, type Vars } from './i18n';
import type { Shift } from './report';

/** `hasPin` false = el empleado todavía no creó su PIN (lo crea la primera vez que escanea). */
export type AttendanceEmployee = { id: string; name: string; isActive: boolean; hasPin: boolean };

export type AttendanceBusinessSummary = { id: string; name: string; slug: string; isActive: boolean; employees: number };

export type AttendanceBusiness = {
  id: string;
  name: string;
  slug: string;
  kioskSecret: string;
  isActive: boolean;
  /** Turnos del negocio; el de cada jornada se deduce de la hora de llegada. */
  shifts: Shift[];
  employees: AttendanceEmployee[];
};

/** Fechas en texto ISO: así pasan tal cual a los componentes del navegador. */
export type AttendanceRecord = {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  editedAt: string | null;
  employee: { name: string };
};

export type PunchResult = { employeeName: string; type: 'in' | 'out'; at: string; workedMinutes: number | null; pinCreated: boolean };

/**
 * Error para mostrar en pantalla: `code` decide qué ofrecer, `key` y `vars` dan el texto en el idioma de
 * quien lo ve (ver lib/i18n.ts). El `message` queda en español para los registros del servidor.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly key: MessageKey,
    readonly vars?: Vars,
  ) {
    super(t('es', key, vars));
  }
}

const MINUTE = 60_000;
/** Dos marcaciones seguidas en menos de esto son un doble escaneo, no una entrada y una salida. */
const DOUBLE_SCAN_MS = 2 * MINUTE;
/** Una entrada sin salida más vieja que esto se da por olvidada: la próxima marcación abre otra jornada. */
const FORGOTTEN_MS = 16 * 60 * MINUTE;
const MAX_SHIFT_MS = 24 * 60 * MINUTE;
const MAX_RANGE_DAYS = 62;
const MAX_SHIFTS = 6;
/** PIN equivocados seguidos antes de bloquear a ese empleado un rato (nadie adivina el PIN de otro probando). */
const MAX_FAILED_PINS = 5;
const LOCK_MS = 15 * MINUTE;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isUuid = (value: string) => UUID.test(value);

// ───────── validación ─────────

function cleanName(name: string, what: MessageKey = 'errName'): string {
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length < 2 || value.length > 120) throw new AppError('INVALID', what);
  return value;
}

/** Turnos del negocio: cada uno con inicio y fin, sin repetir la hora de inicio; se ordenan por inicio. */
export function cleanShifts(input: { start: string; end: string }[]): Shift[] {
  const shifts: Shift[] = [];
  for (const { start, end } of input) {
    if (!start && !end) continue;
    if (!start || !end) throw new AppError('INVALID', 'errShiftBoth');
    if (!TIME.test(start) || !TIME.test(end)) throw new AppError('INVALID', 'errShiftFormat');
    if (start === end) throw new AppError('INVALID', 'errShiftSame');
    if (shifts.some((s) => s.start === start)) throw new AppError('INVALID', 'errShiftDuplicate');
    shifts.push({ start, end });
  }
  if (shifts.length > MAX_SHIFTS) throw new AppError('INVALID', 'errShiftMax', { max: MAX_SHIFTS });
  return shifts.sort((a, b) => a.start.localeCompare(b.start));
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

const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

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

type PublicBusiness = { id: string; name: string; slug: string; kiosk_secret: string };

async function activeBusiness(slug: string): Promise<PublicBusiness> {
  const [business] = await query<PublicBusiness>('SELECT id, name, slug, kiosk_secret FROM businesses WHERE slug = $1 AND is_active', [slug]);
  if (!business) throw new AppError('NOT_FOUND', 'errBusinessMissing');
  return business;
}

function checkCode(business: PublicBusiness, code: string, now: Date) {
  if (!code || code.length > 64 || !isValidCode(business.kiosk_secret, business.slug, code, now.getTime())) {
    throw new AppError('CODE_EXPIRED', 'errCodeExpired');
  }
}

/**
 * Lo que ve el empleado al escanear: el nombre del negocio y la lista de empleados para tocar el suyo.
 * Solo con un código vigente de la tablet: la lista de nombres no queda a la vista de cualquiera.
 */
export async function getPunchScreen(slug: string, code: string, now = new Date()) {
  const business = await activeBusiness(slug);
  checkCode(business, code, now);
  const employees = await query<{ id: string; name: string; has_pin: boolean }>(
    'SELECT id, name, pin_hash IS NOT NULL AS has_pin FROM employees WHERE business_id = $1 AND is_active ORDER BY name',
    [business.id],
  );
  return { name: business.name, employees: employees.map((e) => ({ id: e.id, name: e.name, hasPin: e.has_pin })) };
}

export async function getPublicBusiness(slug: string): Promise<{ name: string } | null> {
  const [business] = await query<{ name: string }>('SELECT name FROM businesses WHERE slug = $1 AND is_active', [slug]);
  return business ?? null;
}

/**
 * Marca entrada o salida: si el empleado tiene una jornada abierta, la cierra; si no, abre una.
 * Si el empleado todavía no tiene PIN, `pin` es el que está creando y queda guardado en esta misma marcación.
 */
export async function punch(slug: string, code: string, employeeId: string, pin: string, now = new Date()): Promise<PunchResult> {
  const business = await activeBusiness(slug);
  checkCode(business, code, now);
  if (!isUuid(employeeId)) throw new AppError('EMPLOYEE', 'errChooseName');
  if (!/^\d{4}$/.test(pin)) throw new AppError('PIN_INVALID', 'errPinFormat');
  const hash = pinHash(business.id, pin);

  // Un PIN equivocado se cuenta aunque la marcación falle: por eso el error sale después de guardar.
  const outcome = await transaction(async (client): Promise<PunchResult | AppError> => {
    // Bloquea al empleado: dos toques seguidos no pueden abrir dos jornadas.
    const employee = (
      await client.query<{ id: string; name: string; pin_hash: string | null; failed_pins: number; locked_until: Date | null }>(
        'SELECT id, name, pin_hash, failed_pins, locked_until FROM employees WHERE id = $1 AND business_id = $2 AND is_active FOR UPDATE',
        [employeeId, business.id],
      )
    ).rows[0];
    if (!employee) return new AppError('EMPLOYEE', 'errChooseName');
    if (employee.locked_until && employee.locked_until > now) {
      const minutes = Math.ceil((employee.locked_until.getTime() - now.getTime()) / MINUTE);
      return new AppError('LOCKED', 'errLocked', { minutes });
    }

    let pinCreated = false;
    if (!employee.pin_hash) {
      await client.query('UPDATE employees SET pin_hash = $1, failed_pins = 0, locked_until = NULL WHERE id = $2', [hash, employee.id]);
      pinCreated = true;
    } else if (!sameHash(employee.pin_hash, hash)) {
      const failed = employee.failed_pins + 1;
      const lock = failed >= MAX_FAILED_PINS;
      await client.query('UPDATE employees SET failed_pins = $1, locked_until = $2 WHERE id = $3', [
        lock ? 0 : failed,
        lock ? new Date(now.getTime() + LOCK_MS) : null,
        employee.id,
      ]);
      return lock
        ? new AppError('LOCKED', 'errLocked', { minutes: 15 })
        : new AppError('PIN_INVALID', 'errPinWrong');
    } else if (employee.failed_pins > 0) {
      await client.query('UPDATE employees SET failed_pins = 0 WHERE id = $1', [employee.id]);
    }

    const last = (
      await client.query<{ id: string; clock_in: Date; clock_out: Date | null }>(
        'SELECT id, clock_in, clock_out FROM records WHERE employee_id = $1 ORDER BY clock_in DESC LIMIT 1',
        [employee.id],
      )
    ).rows[0];
    const elapsed = (from: Date) => now.getTime() - from.getTime();

    if (last && !last.clock_out && elapsed(last.clock_in) < FORGOTTEN_MS) {
      if (elapsed(last.clock_in) < DOUBLE_SCAN_MS) return new AppError('DOUBLE_SCAN', 'errDoubleIn');
      await client.query('UPDATE records SET clock_out = $1 WHERE id = $2', [now, last.id]);
      return { employeeName: employee.name, type: 'out', at: now.toISOString(), workedMinutes: Math.round(elapsed(last.clock_in) / MINUTE), pinCreated };
    }
    if (last?.clock_out && elapsed(last.clock_out) < DOUBLE_SCAN_MS) {
      return new AppError('DOUBLE_SCAN', 'errDoubleOut');
    }
    await client.query('INSERT INTO records (business_id, employee_id, clock_in) VALUES ($1, $2, $3)', [business.id, employee.id, now]);
    return { employeeName: employee.name, type: 'in', at: now.toISOString(), workedMinutes: null, pinCreated };
  });
  if (outcome instanceof AppError) throw outcome;
  return outcome;
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
  const [business] = await query<{ id: string; name: string; slug: string; kiosk_secret: string; is_active: boolean; shifts: Shift[] }>(
    'SELECT id, name, slug, kiosk_secret, is_active, shifts FROM businesses WHERE id = $1',
    [id],
  );
  if (!business) return null;
  const employees = await query<{ id: string; name: string; is_active: boolean; has_pin: boolean }>(
    'SELECT id, name, is_active, pin_hash IS NOT NULL AS has_pin FROM employees WHERE business_id = $1 ORDER BY is_active DESC, name',
    [id],
  );
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    kioskSecret: business.kiosk_secret,
    isActive: business.is_active,
    shifts: business.shifts,
    employees: employees.map((e) => ({ id: e.id, name: e.name, isActive: e.is_active, hasPin: e.has_pin })),
  };
}

export async function createBusiness(name: string): Promise<string> {
  const clean = cleanName(name, 'errBusinessName');
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
  throw new AppError('INVALID', 'errCreateBusiness');
}

/** Genera un enlace nuevo para la tablet; el anterior deja de funcionar. */
export async function rotateKiosk(businessId: string) {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'errBusinessNotFound');
  await query('UPDATE businesses SET kiosk_secret = $1 WHERE id = $2', [newKioskSecret(), businessId]);
}

export async function updateShifts(businessId: string, input: { start: string; end: string }[]) {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'errBusinessNotFound');
  const shifts = cleanShifts(input);
  const rows = await query('UPDATE businesses SET shifts = $1 WHERE id = $2 RETURNING id', [JSON.stringify(shifts), businessId]);
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'errBusinessNotFound');
}

/** El empleado se crea sin PIN: lo crea él mismo la primera vez que escanea el QR. */
export async function createEmployee(businessId: string, input: { name: string }) {
  if (!(await getBusiness(businessId))) throw new AppError('NOT_FOUND', 'errBusinessNotFound');
  const name = cleanName(input.name, 'errEmployeeName');
  const [row] = await query<{ id: string }>('INSERT INTO employees (business_id, name) VALUES ($1, $2) RETURNING id', [businessId, name]);
  return row.id;
}

export async function updateEmployee(businessId: string, employeeId: string, input: { name: string; isActive: boolean }) {
  if (!isUuid(businessId) || !isUuid(employeeId)) throw new AppError('NOT_FOUND', 'errEmployeeNotFound');
  const name = cleanName(input.name, 'errEmployeeName');
  const rows = await query('UPDATE employees SET name = $1, is_active = $2 WHERE id = $3 AND business_id = $4 RETURNING id', [
    name,
    input.isActive,
    employeeId,
    businessId,
  ]);
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'errEmployeeNotFound');
}

/** Para un PIN olvidado: el empleado crea uno nuevo la próxima vez que escanee. */
export async function resetPin(businessId: string, employeeId: string) {
  if (!isUuid(businessId) || !isUuid(employeeId)) throw new AppError('NOT_FOUND', 'errEmployeeNotFound');
  const rows = await query(
    'UPDATE employees SET pin_hash = NULL, failed_pins = 0, locked_until = NULL WHERE id = $1 AND business_id = $2 RETURNING id',
    [employeeId, businessId],
  );
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'errEmployeeNotFound');
}

type RecordRow = {
  id: string;
  employee_id: string;
  clock_in: Date;
  clock_out: Date | null;
  edited_at: Date | null;
  name: string;
};

const toRecord = (r: RecordRow): AttendanceRecord => ({
  id: r.id,
  employeeId: r.employee_id,
  clockIn: r.clock_in.toISOString(),
  clockOut: r.clock_out?.toISOString() ?? null,
  editedAt: r.edited_at?.toISOString() ?? null,
  employee: { name: r.name },
});

/** Inicio del día AAAA-MM-DD en Colombia (UTC-5, sin horario de verano). */
const dayStart = (day: string) => new Date(`${day}T00:00:00-05:00`);

/** Jornadas que empezaron entre dos días (hora de Colombia), ambos incluidos. */
export async function listRecords(businessId: string, fromDay: string, toDay: string): Promise<AttendanceRecord[]> {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'errBusinessNotFound');
  if (!DAY.test(fromDay) || !DAY.test(toDay)) throw new AppError('INVALID', 'errDates');
  const from = dayStart(fromDay);
  const to = new Date(dayStart(toDay).getTime() + 24 * 60 * MINUTE);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new AppError('INVALID', 'errRange');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * MINUTE) {
    throw new AppError('INVALID', 'errRangeMax', { max: MAX_RANGE_DAYS });
  }
  const rows = await query<RecordRow>(
    `SELECT r.id, r.employee_id, r.clock_in, r.clock_out, r.edited_at, e.name
       FROM records r JOIN employees e ON e.id = r.employee_id
      WHERE r.business_id = $1 AND r.clock_in >= $2 AND r.clock_in < $3
      ORDER BY r.clock_in`,
    [businessId, from, to],
  );
  return rows.map(toRecord);
}

async function lockRecord(client: PoolClient, businessId: string, recordId: string) {
  if (!isUuid(businessId) || !isUuid(recordId)) throw new AppError('NOT_FOUND', 'errRecordNotFound');
  const record = (
    await client.query<{ employee_id: string; clock_in: Date; clock_out: Date | null }>(
      'SELECT employee_id, clock_in, clock_out FROM records WHERE id = $1 AND business_id = $2 FOR UPDATE',
      [recordId, businessId],
    )
  ).rows[0];
  if (!record) throw new AppError('NOT_FOUND', 'errRecordNotFound');
  return record;
}

const snapshot = (r: { employee_id: string; clock_in: Date; clock_out: Date | null }) => ({
  employeeId: r.employee_id,
  clockIn: r.clock_in.toISOString(),
  clockOut: r.clock_out?.toISOString() ?? null,
});

/** Corrección a mano: una salida olvidada o una hora mal marcada. `clockOut` null = sin salida. */
export async function updateRecord(businessId: string, recordId: string, clockIn: Date, clockOut: Date | null) {
  if (Number.isNaN(clockIn.getTime()) || (clockOut && Number.isNaN(clockOut.getTime()))) throw new AppError('INVALID', 'errTimes');
  if (clockOut && clockOut <= clockIn) throw new AppError('INVALID', 'errExitBeforeEntry');
  if (clockOut && clockOut.getTime() - clockIn.getTime() > MAX_SHIFT_MS) throw new AppError('INVALID', 'errShiftTooLong');
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
