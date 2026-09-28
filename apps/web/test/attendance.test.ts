import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  bogotaDay,
  bogotaTime,
  fromLocalInput,
  groupByDay,
  minutesLate,
  recordsCsv,
  toLocalInput,
  totalsByEmployee,
  weekOf,
  workedMinutes,
  type AttendanceRecord,
} from '../lib/attendance';

const ana = { name: 'Ana', shiftStart: '08:00', shiftEnd: '15:00' };
const record = (id: string, employeeId: string, clockIn: string, clockOut: string | null, employee: AttendanceRecord['employee'] = ana): AttendanceRecord => ({
  id,
  employeeId,
  clockIn,
  clockOut,
  editedAt: null,
  employee,
});

describe('asistencia: hora de Colombia', () => {
  it('lee día y hora en UTC-5', () => {
    // 2 a. m. UTC del 29 = 9 p. m. del 28 en Colombia.
    const date = new Date('2026-09-29T02:00:00Z');
    assert.equal(bogotaDay(date), '2026-09-28');
    assert.equal(bogotaTime(date), '21:00');
    assert.equal(toLocalInput(date), '2026-09-28T21:00');
    assert.equal(fromLocalInput('2026-09-28T21:00'), '2026-09-29T02:00:00.000Z');
    assert.equal(fromLocalInput(''), null);
    assert.equal(fromLocalInput('mañana'), null);
  });

  it('la semana va de lunes a domingo', () => {
    // Lunes 28 de septiembre de 2026, 11 p. m. en Colombia (ya es martes en UTC).
    assert.deepEqual(weekOf(new Date('2026-09-29T04:00:00Z')), { from: '2026-09-28', to: '2026-10-04' });
    // Domingo 4 de octubre.
    assert.deepEqual(weekOf(new Date('2026-10-04T15:00:00Z')), { from: '2026-09-28', to: '2026-10-04' });
    assert.equal(addDays('2026-09-28', -7), '2026-09-21');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });
});

describe('asistencia: reporte', () => {
  const records = [
    // Ana llega 7:58 (a tiempo) y sale 3:02 p. m.
    record('1', 'a', '2026-09-28T12:58:00Z', '2026-09-28T20:02:00Z'),
    // Ana llega 8:20 (20 min tarde) y olvida marcar la salida.
    record('2', 'a', '2026-09-29T13:20:00Z', null),
    // Beto (11 a. m.) llega 11:04: dentro de la gracia.
    record('3', 'b', '2026-09-28T16:04:00Z', '2026-09-28T23:00:00Z', { name: 'Beto', shiftStart: '11:00', shiftEnd: '18:00' }),
    // Carla sin turno fijo.
    record('4', 'c', '2026-09-28T19:00:00Z', '2026-09-29T02:00:00Z', { name: 'Carla', shiftStart: null, shiftEnd: null }),
  ];

  it('horas trabajadas y llegadas tarde', () => {
    assert.equal(workedMinutes(records[0]), 424);
    assert.equal(workedMinutes(records[1]), null);
    assert.equal(minutesLate(records[0]), null);
    assert.equal(minutesLate(records[1]), 20);
    assert.equal(minutesLate(records[2]), null);
    assert.equal(minutesLate(records[3]), null);
  });

  it('totales por empleado', () => {
    const totals = totalsByEmployee(records);
    assert.deepEqual(totals.map((t) => t.name), ['Ana', 'Beto', 'Carla']);
    assert.deepEqual(totals[0], { employeeId: 'a', name: 'Ana', days: 2, minutes: 424, lateCount: 1, lateMinutes: 20, missingExit: 1 });
    assert.equal(totals[1].minutes, 416);
  });

  it('agrupa por día de entrada en Colombia', () => {
    const groups = groupByDay(records);
    assert.deepEqual(groups.map((g) => [g.day, g.records.length]), [['2026-09-28', 3], ['2026-09-29', 1]]);
  });

  it('el archivo para Excel usa punto y coma, coma decimal y no deja pasar fórmulas', () => {
    const csv = recordsCsv([...records, record('5', 'd', '2026-09-28T13:00:00Z', null, { name: '=HYPERLINK("x")', shiftStart: null, shiftEnd: null })]);
    assert.ok(csv.startsWith('﻿Fecha;Empleado;'));
    const lines = csv.trim().split('\r\n');
    assert.equal(lines[1], '2026-09-28;Ana;08:00–15:00;07:58;15:02;7,07;0;');
    assert.equal(lines[2], '2026-09-29;Ana;08:00–15:00;08:20;Sin salida;;20;');
    assert.ok(lines[5].includes(`"'=HYPERLINK(""x"")"`));
  });
});
