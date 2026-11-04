// Rango «Desde / Hasta» de Finanzas y el Tablero (sin base de datos).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customRange } from '../lib/periods';

describe('rango de fechas escogido a mano', () => {
  it('las dos fechas válidas; al revés se ordenan; si falta una o no es fecha, no hay rango', () => {
    assert.deepEqual(customRange('2026-10-01', '2026-10-15'), { from: '2026-10-01', to: '2026-10-15' });
    assert.deepEqual(customRange('2026-10-15', '2026-10-01'), { from: '2026-10-01', to: '2026-10-15' });
    assert.deepEqual(customRange('2026-11-03', '2026-11-03'), { from: '2026-11-03', to: '2026-11-03' });
    assert.equal(customRange('2026-10-01', undefined), null);
    assert.equal(customRange('', '2026-10-01'), null);
    assert.equal(customRange('01/10/2026', '2026-10-15'), null);
    assert.equal(customRange('2026-13-40', '2026-10-15'), null);
  });
});

describe('texto del PDF del cierre', () => {
  it('cambia lo que las letras del PDF no traen y deja las tildes', async () => {
    const { pdfSafe } = await import('../lib/day-report');
    assert.equal(pdfSafe('−$5.000 → «Ñandú» · café'), '-$5.000 -> «Ñandú» · café');
    assert.equal(pdfSafe('Mojito 🍹 x2'), 'Mojito  x2');
  });
});
