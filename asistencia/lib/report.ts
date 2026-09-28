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

/**
 * Minutos tarde respecto al inicio del turno, o null si el empleado no tiene turno o llegó a tiempo
 * (dentro de la gracia). Una entrada mucho antes del turno cuenta como a tiempo.
 */
export function minutesLate(record: Pick<AttendanceRecord, 'clockIn' | 'employee'>, grace = LATE_GRACE_MIN): number | null {
  const start = record.employee.shiftStart;
  if (!start) return null;
  const [h, m] = start.split(':').map(Number);
  const inMinutes = (() => {
    const d = shifted(new Date(record.clockIn));
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  })();
  const late = inMinutes - (h * 60 + m);
  return late > grace ? late : null;
}

export type EmployeeTotals = {
  employeeId: string;
  name: string;
  days: number;
  minutes: number;
  lateCount: number;
  lateMinutes: number;
  missingExit: number;
};

/** Totales por empleado en el periodo del reporte. */
export function totalsByEmployee(records: AttendanceRecord[]): EmployeeTotals[] {
  const byId = new Map<string, EmployeeTotals & { dayset: Set<string> }>();
  for (const record of records) {
    const row =
      byId.get(record.employeeId) ??
      { employeeId: record.employeeId, name: record.employee.name, days: 0, minutes: 0, lateCount: 0, lateMinutes: 0, missingExit: 0, dayset: new Set<string>() };
    row.dayset.add(bogotaDay(new Date(record.clockIn)));
    const worked = workedMinutes(record);
    if (worked === null) row.missingExit += 1;
    else row.minutes += worked;
    const late = minutesLate(record);
    if (late !== null) {
      row.lateCount += 1;
      row.lateMinutes += late;
    }
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
export function recordsCsv(records: AttendanceRecord[]): string {
  const header = ['Fecha', 'Empleado', 'Turno', 'Entrada', 'Salida', 'Horas trabajadas', 'Minutos tarde', 'Corregido a mano'];
  const rows = records.map((record) => {
    const worked = workedMinutes(record);
    const { shiftStart, shiftEnd } = record.employee;
    return [
      bogotaDay(new Date(record.clockIn)),
      record.employee.name,
      shiftStart ? `${shiftStart}–${shiftEnd ?? ''}` : '',
      bogotaTime(new Date(record.clockIn)),
      record.clockOut ? bogotaTime(new Date(record.clockOut)) : 'Sin salida',
      worked === null ? '' : (worked / 60).toFixed(2).replace('.', ','),
      minutesLate(record) ?? 0,
      record.editedAt ? 'Sí' : '',
    ];
  });
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
