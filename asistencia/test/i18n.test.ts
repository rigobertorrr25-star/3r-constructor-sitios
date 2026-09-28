import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { langFromAcceptLanguage, t } from '../lib/i18n';
import { formatClock, formatDay, recordsCsv } from '../lib/report';
import type { AttendanceRecord } from '../lib/store';

describe('idiomas', () => {
  it('sin elección, inglés solo si el navegador lo pide primero', () => {
    assert.equal(langFromAcceptLanguage('en-US,en;q=0.9,es;q=0.8'), 'en');
    assert.equal(langFromAcceptLanguage('es-CO,es;q=0.9,en;q=0.8'), 'es');
    assert.equal(langFromAcceptLanguage(''), 'es');
    assert.equal(langFromAcceptLanguage(null), 'es');
  });

  it('textos con variables en los dos idiomas', () => {
    assert.equal(t('es', 'helloShift', { name: 'Ana' }), '¡Hola, Ana! Buen turno.');
    assert.equal(t('en', 'helloShift', { name: 'Ana' }), 'Hi, Ana! Have a good shift.');
    assert.equal(t('en', 'errLocked', { minutes: 15 }), 'Too many wrong PINs. Try again in 15 min or ask the administrator to reset your PIN.');
  });

  it('horas y fechas en el formato de cada idioma, siempre en hora de Colombia', () => {
    const date = new Date('2026-09-28T12:58:00Z');
    assert.match(formatClock(date, 'en'), /^7:58\sAM$/);
    assert.match(formatClock(date, 'es'), /^7:58\sa\.\s?m\.$/);
    assert.equal(formatDay('2026-09-28', 'en'), 'Monday, September 28');
    assert.equal(formatDay('2026-09-28', 'es'), 'lunes, 28 de septiembre');
  });

  it('Excel en inglés: coma como separador y punto decimal', () => {
    const records: AttendanceRecord[] = [
      { id: '1', employeeId: 'a', clockIn: '2026-09-28T12:58:00Z', clockOut: '2026-09-28T20:02:00Z', editedAt: '2026-09-29T00:00:00Z', employee: { name: 'Pérez, Ana' } },
      { id: '2', employeeId: 'a', clockIn: '2026-09-29T13:20:00Z', clockOut: null, editedAt: null, employee: { name: 'Ana' } },
    ];
    const lines = recordsCsv(records, [{ start: '08:00', end: '15:00' }], 'en').replace('﻿', '').trim().split('\r\n');
    assert.equal(lines[0], 'Date,Employee,Shift (by clock-in time),Clock-in,Clock-out,Hours worked,Minutes late,Minutes left early,Edited manually');
    assert.equal(lines[1], '2026-09-28,"Pérez, Ana",08:00–15:00,07:58,15:02,7.07,0,0,Yes');
    assert.equal(lines[2], '2026-09-29,Ana,08:00–15:00,08:20,No clock-out,,20,0,');
  });
});
