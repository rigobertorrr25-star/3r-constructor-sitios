// Cierre de caja completo: las listas de inventario que salen al cerrar (sin base de datos).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildClosingInventory, shortQuantity, tipOfSales, type StockLine } from '../lib/closing-report';

const item = (name: string, area: 'bar' | 'kitchen', stock: number, minStock: number, unit: 'g' | 'ml' | 'und' = 'und', bottleSize: number | null = null): StockLine => ({
  name,
  area,
  unit,
  bottleSize,
  stock,
  minStock,
});

describe('cierre de caja: inventario y propina', () => {
  it('lo que queda, lo que se acabó y cuánto comprar para llegar al mínimo', () => {
    const r = buildClosingInventory([
      item('Papa', 'kitchen', 10000, 5000, 'g'),
      item('Ron', 'bar', 1050, 1500, 'ml', 750),
      item('Hielo', 'bar', 0, 3),
      item('Club Colombia', 'bar', -2, 24),
      item('Servilletas', 'kitchen', 0, 0),
    ]);
    assert.deepEqual(r.remaining.map((i) => i.name), ['Ron', 'Papa'], 'barra primero y luego cocina');
    assert.deepEqual(r.out.map((i) => i.name), ['Club Colombia', 'Hielo', 'Servilletas']);
    assert.deepEqual(r.toBuy.map((i) => [i.name, i.buy]), [['Club Colombia', 24], ['Hielo', 3], ['Ron', 450]], 'lo vendido de más no se suma a la compra');
    assert.equal(r.hasMinimums, true);
    assert.equal(buildClosingInventory([item('Hielo', 'bar', 2, 0)]).hasMinimums, false);
  });

  it('cantidades cortas para el papel y la propina del día', () => {
    assert.equal(shortQuantity(1050, 'ml', 750), '1,4 bot.');
    assert.equal(shortQuantity(2500, 'g', null), '2,5 kg');
    assert.equal(shortQuantity(500, 'g', null), '500 g');
    assert.equal(shortQuantity(3, 'und', null), '3 und');
    assert.equal(tipOfSales(345000, 10), 34500);
    assert.equal(tipOfSales(345000, 0), 0);
  });
});
