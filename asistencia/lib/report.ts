// Cálculos del reporte en hora de Colombia (UTC-5, sin horario de verano).

import type { AttendanceRecord } from './store';

const OFFSET_MS = -5 * 3_600_000;
const DAY_MS = 86_400_000;
/** Minutos de gracia: llegar hasta 5 minutos después del turno no cuenta como tarde. */
export const LATE_GRACE_MIN = 5;

/** El instante visto como si UTC fuera la hora de Colombia (para leer día y hora con getUTC*). */
const shifted = (date: Date) => new Date(date.getTime() + OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, '0');

/** AAAA-MM-DD en Colombia. */
export function bogotaDay(date: Date): string {
  const d = shifted(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** HH:MM en Colombia, 24 horas (para campos de formulario). */
export function bogotaTime(date: Date): string {
  const d = shifted(date);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Valor para <input type="datetime-local"> en hora de Colombia. */
export const toLocalInput = (date: Date) => `${bogotaDay(date)}T${bogotaTime(date)}`;

/** De un <input type="datetime-local"> (hora de Colombia) a ISO. Vacío o inválido → null. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-05:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isDay(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Lunes y domingo de la semana (en Colombia) que contiene `date`. */
export function weekOf(date: Date): { from: string; to: string } {
  const today = bogotaDay(date);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const from = addDays(today, -weekday);
  return { from, to: addDays(from, 6) };
}

const clock = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });
const longDay = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDay = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "7:58 a. m." */
export const formatClock = (date: Date) => clock.format(date);
/** "lunes, 28 de septiembre" a partir de AAAA-MM-DD. */
export const formatDay = (day: string) => longDay.format(new Date(`${day}T00:00:00Z`));
export const formatShortDay = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`));

/** "7 h 05 min" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${pad(m)} min`;
}

export function workedMinutes(record: Pick<AttendanceRecord, 'clockIn' | 'clockOut'>): number | null {
  if (!record.clockOut) return null;
  return Math.round((Date.parse(record.clockOut) - Date.parse(record.clockIn)) / 60_000);
}

export type Shift = { start: string; end: string };

const DAY_MIN = 24 * 60;
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Minuto del día en Colombia (0–1439). */
const minuteOfDay = (iso: string) => {
  const d = shifted(new Date(iso));
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
/** Diferencia a - b en minutos sobre el reloj (−720 a 720): un turno puede cruzar la medianoche. */
const clockDiff = (a: number, b: number) => {
  const d = (((a - b) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return d > DAY_MIN / 2 ? d - DAY_MIN : d;
};

/**
 * Turno de una jornada, deducido de la hora de llegada: el que empieza más cerca. Si ya marcó la
 * salida, también cuenta qué tan cerca salió del fin de cada turno (así, quien llega 9:45 y sale a
 * las 3:00 p. m. queda en el de la mañana, no como si hubiera llegado temprano al de las 11).
 */
export function inferShift(record: Pick<AttendanceRecord, 'clockIn' | 'clockOut'>, shifts: Shift[]): Shift | null {
  const arrival = minuteOfDay(record.clockIn);
  const exit = record.clockOut ? minuteOfDay(record.clockOut) : null;
  let best: Shift | null = null;
  let bestScore = Infinity;
  for (const shift of shifts) {
    let score = Math.abs(clockDiff(arrival, toMinutes(shift.start)));
    if (exit !== null) score += Math.abs(clockDiff(exit, toMinutes(shift.end)));
    if (score < bestScore) {
      best = shift;
      bestScore = score;
    }
  }
  return best;
}

/** Minutos tarde respecto al inicio del turno deducido, o null si llegó a tiempo (dentro de la gracia) o no hay turnos. */
export function minutesLate(record: Pick<AttendanceRecord, 'clockIn' | 'clockOut'>, shifts: Shift[], grace = LATE_GRACE_MIN): number | null {
  const shift = inferShift(record, shifts);
  if (!shift) return null;
  const late = clockDiff(minuteOfDay(record.clockIn), toMinutes(shift.start));
  return late > grace ? late : null;
}

/** Minutos que salió antes del fin del turno deducido, o null si no salió antes (dentro de la gracia) o no hay salida. */
export function minutesEarlyExit(record: Pick<AttendanceRecord, 'clockIn' | 'clockOut'>, shifts: Shift[], grace = LATE_GRACE_MIN): number | null {
  if (!record.clockOut) return null;
  const shift = inferShift(record, shifts);
  if (!shift) return null;
  const early = clockDiff(toMinutes(shift.end), minuteOfDay(record.clockOut));
  return early > grace ? early : null;
}

export const shiftLabel = (shift: Shift) => `${shift.start}–${shift.end}`;

export type EmployeeTotals = {
  employeeId: string;
  name: string;
  days: number;
  minutes: number;
  lateCount: number;
  lateMinutes: number;
  earlyExitCount: number;
  missingExit: number;
};

/** Totales por empleado en el periodo del reporte. */
export function totalsByEmployee(records: AttendanceRecord[], shifts: Shift[]): EmployeeTotals[] {
  const byId = new Map<string, EmployeeTotals & { dayset: Set<string> }>();
  for (const record of records) {
    const row =
      byId.get(record.employeeId) ??
      {
        employeeId: record.employeeId,
        name: record.employee.name,
        days: 0,
        minutes: 0,
        lateCount: 0,
        lateMinutes: 0,
        earlyExitCount: 0,
        missingExit: 0,
        dayset: new Set<string>(),
      };
    row.dayset.add(bogotaDay(new Date(record.clockIn)));
    const worked = workedMinutes(record);
    if (worked === null) row.missingExit += 1;
    else row.minutes += worked;
    const late = minutesLate(record, shifts);
    if (late !== null) {
      row.lateCount += 1;
      row.lateMinutes += late;
    }
    if (minutesEarlyExit(record, shifts) !== null) row.earlyExitCount += 1;
    byId.set(record.employeeId, row);
  }
  return [...byId.values()]
    .map(({ dayset, ...row }) => ({ ...row, days: dayset.size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Agrupa las jornadas por día de entrada (en Colombia), en orden. */
export function groupByDay(records: AttendanceRecord[]): { day: string; records: AttendanceRecord[] }[] {
  const groups = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    const day = bogotaDay(new Date(record.clockIn));
    groups.set(day, [...(groups.get(day) ?? []), record]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, records: list }));
}

const csvCell = (value: string | number) => {
  const text = String(value);
  // Una celda que empieza con = + - @ se volvería fórmula en Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Archivo para Excel: separado por punto y coma (el Excel en español de Colombia usa la coma para
 * decimales) y con BOM para que abra las tildes bien.
 */
export function recordsCsv(records: AttendanceRecord[], shifts: Shift[]): string {
  const header = ['Fecha', 'Empleado', 'Turno (por la hora de llegada)', 'Entrada', 'Salida', 'Horas trabajadas', 'Minutos tarde', 'Minutos de salida temprano', 'Corregido a mano'];
  const rows = records.map((record) => {
    const worked = workedMinutes(record);
    const shift = inferShift(record, shifts);
    return [
      bogotaDay(new Date(record.clockIn)),
      record.employee.name,
      shift ? shiftLabel(shift) : '',
      bogotaTime(new Date(record.clockIn)),
      record.clockOut ? bogotaTime(new Date(record.clockOut)) : 'Sin salida',
      worked === null ? '' : (worked / 60).toFixed(2).replace('.', ','),
      minutesLate(record, shifts) ?? 0,
      minutesEarlyExit(record, shifts) ?? 0,
      record.editedAt ? 'Sí' : '',
    ];
  });
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
