// Cuadre del día (30 oct 2026, pedido de Rigoberto: «como las cajeras tienen dos horarios, quiero dos cuadres de caja en
// el día»). Cada cajera cierra su turno con su propio cuadre; esto suma los turnos del día. La base y el efectivo esperado
// no se suman: la base del turno 2 es lo que dejó el turno 1 en la caja. Se suman ventas, medios, propinas, salidas y
// las diferencias de cada turno.
import { METHODS, type Method, type ShiftSummary } from './cash';

export type DayTotals = {
  turns: number;
  /** Turnos que siguen abiertos (su diferencia todavía no cuenta). */
  open: number;
  sales: number;
  tips: number;
  discounts: number;
  movementsIn: number;
  movementsOut: number;
  tablesClosed: number;
  byMethod: Record<Method, { amount: number; tip: number; count: number }>;
  /** Suma de (contado − esperado) de los turnos cerrados: positivo sobra, negativo falta. */
  difference: number;
  envelopeKitchen: number;
  envelopeBar: number;
  safeAmount: number;
};

/** Lo que cuadró cada turno: contado − esperado (null si sigue abierto). */
export const shiftDifference = (s: ShiftSummary) => (s.shift.countedCash === null ? null : s.shift.countedCash - (s.shift.expectedCash ?? s.expectedCash));

export function dayTotals(shifts: ShiftSummary[]): DayTotals {
  const sum = (f: (s: ShiftSummary) => number) => shifts.reduce((t, s) => t + f(s), 0);
  const byMethod = Object.fromEntries(
    METHODS.map((m) => [m, { amount: sum((s) => s.byMethod[m].amount), tip: sum((s) => s.byMethod[m].tip), count: sum((s) => s.byMethod[m].count) }]),
  ) as DayTotals['byMethod'];
  return {
    turns: shifts.length,
    open: shifts.filter((s) => !s.shift.closedAt).length,
    sales: sum((s) => s.sales),
    tips: sum((s) => s.tips),
    discounts: sum((s) => s.discounts),
    movementsIn: sum((s) => s.movementsIn),
    movementsOut: sum((s) => s.movementsOut),
    tablesClosed: sum((s) => s.tablesClosed),
    byMethod,
    difference: sum((s) => shiftDifference(s) ?? 0),
    envelopeKitchen: sum((s) => s.shift.envelopeKitchen),
    envelopeBar: sum((s) => s.shift.envelopeBar),
    safeAmount: sum((s) => s.shift.safeAmount),
  };
}
