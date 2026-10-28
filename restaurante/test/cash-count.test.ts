// Arqueo de la caja: billetes y monedas de Colombia (sin base de datos).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cashCountLines, cashCountTotal, cleanCashCount } from '../lib/cash-count';

describe('arqueo de billetes y monedas', () => {
  it('suma lo contado y descarta lo raro', () => {
    const count = cleanCashCount({ b50000: '3', b100000: 2, c100: 15, c500: 0, b7000: 4, c50: -2, c200: 1.5 });
    assert.deepEqual(count, { b100000: 2, b50000: 3, c100: 15 });
    assert.equal(cashCountTotal(count), 200000 + 150000 + 1500);
    assert.deepEqual(cashCountLines(count).map((l) => [l.kind, l.value, l.quantity, l.total]), [
      ['bill', 100000, 2, 200000],
      ['bill', 50000, 3, 150000],
      ['coin', 100, 15, 1500],
    ]);
    assert.equal(cleanCashCount({}), null);
    assert.equal(cleanCashCount(null), null);
    // El billete y la moneda de $1.000 son distintos.
    assert.equal(cashCountTotal(cleanCashCount({ b1000: 2, c1000: 3 })), 5000);
  });
});
