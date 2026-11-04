import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { punchMood } from '../lib/report';

const shifts = [
  { start: '08:00', end: '15:00' },
  { start: '14:00', end: '21:00' },
];
// Horas de Colombia (UTC-5) escritas en UTC.
const at = (hhmm: string) => new Date(`2026-11-04T${hhmm}:00-05:00`).toISOString();

describe('asistencia: mensaje del celular según la hora', () => {
  it('llegada: tarde, temprano o a tiempo (con 5 min de gracia)', () => {
    assert.deepEqual(punchMood({ clockIn: at('08:20'), clockOut: null }, shifts), { mood: 'late', minutes: 20 });
    assert.deepEqual(punchMood({ clockIn: at('07:40'), clockOut: null }, shifts), { mood: 'early', minutes: 20 });
    assert.deepEqual(punchMood({ clockIn: at('08:04'), clockOut: null }, shifts), { mood: 'onTime', minutes: 0 });
    assert.deepEqual(punchMood({ clockIn: at('13:57'), clockOut: null }, shifts), { mood: 'onTime', minutes: 0 });
  });

  it('salida: antes, con tiempo extra o a tiempo', () => {
    assert.deepEqual(punchMood({ clockIn: at('08:00'), clockOut: at('14:30') }, shifts), { mood: 'leftEarly', minutes: 30 });
    assert.deepEqual(punchMood({ clockIn: at('08:00'), clockOut: at('15:45') }, shifts), { mood: 'overtime', minutes: 45 });
    assert.deepEqual(punchMood({ clockIn: at('14:00'), clockOut: at('21:10') }, shifts), { mood: 'onTimeOut', minutes: 0 });
  });

  it('sin turnos no hay mensaje', () => {
    assert.equal(punchMood({ clockIn: at('08:20'), clockOut: null }, []), null);
  });
});
