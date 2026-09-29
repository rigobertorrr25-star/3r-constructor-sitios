import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  bogotaDay,
  bogotaTime,
  fromLocalInput,
  groupByDay,
  inferShift,
  minutesEarlyExit,
  minutesLate,
  ongoingMinutes,
  recordsCsv,
  toLocalInput,
  totalsByEmployee,
  weekOf,
  workedMinutes,
} from '../lib/report';
import type { AttendanceRecord } from '../lib/store';

const record = (id: string, name: string, clockIn: string, clockOut: string | null): AttendanceRecord => ({
  id,
  employeeId: name,
  clockIn,
  clockOut,
  editedAt: null,
  employee: { name },
});

// Los turnos de Azul Caribe Lounge.
const shifts = [
  { start: '08:00', end: '15:00' },
  { start: '11:00', end: '18:00' },
  { start: '14:00', end: '21:00' },
];

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

describe('asistencia: turno deducido por la hora de llegada', () => {
  const at = (dayTime: string) => new Date(`${dayTime}:00-05:00`).toISOString();

  it('toma el turno que empieza más cerca de la llegada', () => {
    assert.deepEqual(inferShift(record('1', 'Ana', at('2026-09-28T07:58'), null), shifts), shifts[0]);
    assert.deepEqual(inferShift(record('2', 'Ana', at('2026-09-28T08:10'), null), shifts), shifts[0]);
    assert.deepEqual(inferShift(record('3', 'Beto', at('2026-09-28T11:04'), null), shifts), shifts[1]);
    assert.deepEqual(inferShift(record('4', 'Carla', at('2026-09-28T13:50'), null), shifts), shifts[2]);
    assert.equal(inferShift(record('5', 'Ana', at('2026-09-28T08:10'), null), []), null);
  });

  it('con la salida marcada, también cuenta a qué hora salió', () => {
    // Llega 9:45: sin salida parece el de las 11 (llegó temprano)…
    const open = record('6', 'Dani', at('2026-09-28T09:45'), null);
    assert.deepEqual(inferShift(open, shifts), shifts[1]);
    assert.equal(minutesLate(open, shifts), null);
    // …pero si salió a las 3:00 p. m., era el de la mañana y llegó 1 h 45 min tarde.
    const closed = record('6', 'Dani', at('2026-09-28T09:45'), at('2026-09-28T15:00'));
    assert.deepEqual(inferShift(closed, shifts), shifts[0]);
    assert.equal(minutesLate(closed, shifts), 105);
  });

  it('llegadas tarde y salidas temprano, con 5 minutos de gracia', () => {
    assert.equal(minutesLate(record('1', 'Ana', at('2026-09-28T08:10'), null), shifts), 10);
    assert.equal(minutesLate(record('1', 'Ana', at('2026-09-28T08:05'), null), shifts), null);
    assert.equal(minutesLate(record('1', 'Ana', at('2026-09-28T07:40'), null), shifts), null);
    const edu = record('7', 'Edu', at('2026-09-28T11:10'), at('2026-09-28T16:00'));
    assert.deepEqual(inferShift(edu, shifts), shifts[1]);
    assert.equal(minutesLate(edu, shifts), 10);
    assert.equal(minutesEarlyExit(edu, shifts), 120);
    assert.equal(minutesEarlyExit(record('8', 'Ana', at('2026-09-28T08:00'), at('2026-09-28T14:57')), shifts), null);
    assert.equal(minutesEarlyExit(record('9', 'Ana', at('2026-09-28T08:00'), null), shifts), null);
  });

  it('un turno que cruza la medianoche', () => {
    const night = [{ start: '22:00', end: '06:00' }, ...shifts];
    const r = record('10', 'Nico', at('2026-09-28T22:15'), at('2026-09-29T06:00'));
    assert.deepEqual(inferShift(r, night), night[0]);
    assert.equal(minutesLate(r, night), 15);
    assert.equal(minutesEarlyExit(r, night), null);
  });
});

describe('asistencia: reporte', () => {
  const records = [
    // Ana llega 7:58 (a tiempo) y sale 3:02 p. m.
    record('1', 'Ana', '2026-09-28T12:58:00Z', '2026-09-28T20:02:00Z'),
    // Ana llega 8:20 (20 min tarde) y olvida marcar la salida.
    record('2', 'Ana', '2026-09-29T13:20:00Z', null),
    // Beto llega 11:04 (dentro de la gracia) y sale 4:00 p. m. (2 h antes).
    record('3', 'Beto', '2026-09-28T16:04:00Z', '2026-09-28T21:00:00Z'),
    // Carla, turno de 2 a 9 p. m.
    record('4', 'Carla', '2026-09-28T19:00:00Z', '2026-09-29T02:00:00Z'),
  ];

  it('totales por empleado', () => {
    // Un mes después: la entrada sin salida de Ana ya es una salida olvidada.
    const totals = totalsByEmployee(records, shifts, Date.parse('2026-10-29T00:00:00Z'));
    assert.deepEqual(totals.map((t) => t.name), ['Ana', 'Beto', 'Carla']);
    assert.deepEqual(totals[0], {
      employeeId: 'Ana',
      name: 'Ana',
      days: 2,
      minutes: 424,
      lateCount: 1,
      lateMinutes: 20,
      earlyExitCount: 0,
      ongoingMinutes: 0,
      missingExit: 1,
    });
    assert.equal(totals[1].earlyExitCount, 1);
    assert.equal(totals[2].minutes, 420);
    assert.equal(workedMinutes(records[1]), null);
  });

  it('quien está trabajando suma su tiempo en curso; pasadas 16 h es salida olvidada', () => {
    // Ana entró 8:20 a. m. del 29; a las 11:50 a. m. lleva 3 h 30 min.
    const at1150 = Date.parse('2026-09-29T16:50:00Z');
    assert.equal(ongoingMinutes(records[1], at1150), 210);
    assert.equal(ongoingMinutes(records[0], at1150), null, 'ya salió');
    const ana = totalsByEmployee(records, shifts, at1150)[0];
    assert.equal(ana.ongoingMinutes, 210);
    assert.equal(ana.missingExit, 0);
    assert.equal(ana.minutes, 424, 'las horas cerradas no cambian');
    // 17 horas después de entrar ya no está trabajando: olvidó marcar.
    const next = Date.parse('2026-09-30T06:30:00Z');
    assert.equal(ongoingMinutes(records[1], next), null);
    assert.equal(totalsByEmployee(records, shifts, next)[0].missingExit, 1);
  });

  it('agrupa por día de entrada en Colombia', () => {
    const groups = groupByDay(records);
    assert.deepEqual(groups.map((g) => [g.day, g.records.length]), [['2026-09-28', 3], ['2026-09-29', 1]]);
  });

  it('el archivo para Excel usa punto y coma, coma decimal y no deja pasar fórmulas', () => {
    const csv = recordsCsv([...records, record('5', '=HYPERLINK("x")', '2026-09-28T13:00:00Z', null)], shifts, 'es', Date.parse('2026-10-29T00:00:00Z'));
    assert.ok(csv.startsWith('\uFEFFFecha;Empleado;Turno (por la hora de llegada);'));
    const lines = csv.trim().split('\r\n');
    assert.equal(lines[1], '2026-09-28;Ana;08:00–15:00;07:58;15:02;7,07;0;0;');
    assert.equal(lines[2], '2026-09-29;Ana;08:00–15:00;08:20;Sin salida;;20;0;');
    const live = recordsCsv(records, shifts, 'es', Date.parse('2026-09-29T16:50:00Z')).split('\r\n');
    assert.equal(live[2], '2026-09-29;Ana;08:00–15:00;08:20;En turno;;20;0;');
    assert.equal(lines[3], '2026-09-28;Beto;11:00–18:00;11:04;16:00;4,93;0;120;');
    assert.ok(lines[5].includes(`"'=HYPERLINK(""x"")"`));
  });
});
