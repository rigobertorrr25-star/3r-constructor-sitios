// Formato de cantidades de inventario. Sin base de datos: lo usan también las pantallas.
export type Unit = 'g' | 'ml' | 'und';

export const UNIT_SHORT: Record<Unit, string> = { g: 'g', ml: 'ml', und: 'und' };

const n = (v: number, digits = 3) => Number(v.toFixed(digits)).toLocaleString('es-CO');

/** 1500 g → "1,5 kg"; 2250 ml → "2,25 L"; 3 und → "3 und". Las botellas, en botellas. */
export function formatQuantity(value: number, unit: Unit, bottleSize?: number | null) {
  if (bottleSize) return `${n(value / bottleSize, 2)} bot. (${n(value, 0)} ml)`;
  if (unit === 'g' && Math.abs(value) >= 1000) return `${n(value / 1000)} kg`;
  if (unit === 'ml' && Math.abs(value) >= 1000) return `${n(value / 1000)} L`;
  return `${n(value)} ${UNIT_SHORT[unit]}`;
}
