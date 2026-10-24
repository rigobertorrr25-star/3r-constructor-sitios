// Inventario → «Llenar con una foto»: cómo se entiende lo que responde la IA.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stockReading } from '../lib/ai-read';

describe('leer el inventario de una foto', () => {
  const items = [
    { id: 'a', name: 'Club Colombia' },
    { id: 'b', name: 'Aguardiente Antioqueño' },
  ];

  it('pasa los números de la lista a insumos y deja aparte lo que no existe', () => {
    const r = stockReading(
      'Aquí va: {"hay": [{"insumo": 1, "cantidad": 24}, {"insumo": 2, "cantidad": "2,5"}, {"insumo": 1, "cantidad": 3}, {"insumo": 9, "cantidad": 1}], "otros": [{"nombre": " Limón ", "cantidad": 3, "unidad": "kg"}, {"nombre": "club colombia", "cantidad": 2}, {"nombre": "Hielo", "cantidad": 4, "unidad": "bultos"}]}',
      items,
    );
    assert.deepEqual(r.found, [
      { itemId: 'a', count: 24 },
      { itemId: 'b', count: 2.5 },
    ]);
    assert.deepEqual(r.others, [
      { name: 'Limón', count: 3, unit: 'kg' },
      { name: 'Hielo', count: 4, unit: 'und' },
    ]);
  });

  it('si la respuesta no se entiende, no llena nada', () => {
    assert.deepEqual(stockReading('No veo nada', items), { found: [], others: [] });
    assert.deepEqual(stockReading('{"hay": [{"insumo": 1, "cantidad": -2}]}', items), { found: [], others: [] });
  });
});
