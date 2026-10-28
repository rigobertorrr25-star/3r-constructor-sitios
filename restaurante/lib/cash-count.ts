// Arqueo de la caja (28 oct 2026, pedido de Rigoberto: «cuántos billetes de 50 tengo, cuántos de 100, cuántas monedas de
// 100…»). Billetes y monedas de Colombia que circulan; el de $1.000 todavía se ve en billete y en moneda.
// Sin imports del servidor: lo usa también el formulario de cierre.

export const DENOMINATIONS = [
  { value: 100_000, kind: 'bill' },
  { value: 50_000, kind: 'bill' },
  { value: 20_000, kind: 'bill' },
  { value: 10_000, kind: 'bill' },
  { value: 5_000, kind: 'bill' },
  { value: 2_000, kind: 'bill' },
  { value: 1_000, kind: 'bill' },
  { value: 1_000, kind: 'coin' },
  { value: 500, kind: 'coin' },
  { value: 200, kind: 'coin' },
  { value: 100, kind: 'coin' },
  { value: 50, kind: 'coin' },
] as const;

export type Denomination = (typeof DENOMINATIONS)[number];
/** Llave de cada denominación: «b100000», «c500»… (billete o moneda + valor). */
export const denominationKey = (d: Denomination) => `${d.kind === 'bill' ? 'b' : 'c'}${d.value}`;

/** Cuántos hay de cada billete y moneda. */
export type CashCount = Record<string, number>;

/** Solo las llaves que existen y cantidades enteras de 0 a 100.000; lo demás se descarta. Null si no se contó nada. */
export function cleanCashCount(raw: unknown): CashCount | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: CashCount = {};
  for (const d of DENOMINATIONS) {
    const v = (raw as Record<string, unknown>)[denominationKey(d)];
    const n = typeof v === 'number' ? v : Number(String(v ?? '').trim() || 0);
    if (Number.isInteger(n) && n > 0 && n <= 100_000) out[denominationKey(d)] = n;
  }
  return Object.keys(out).length ? out : null;
}

export const cashCountTotal = (count: CashCount | null) =>
  DENOMINATIONS.reduce((sum, d) => sum + (count?.[denominationKey(d)] ?? 0) * d.value, 0);

/** Los renglones del arqueo que tienen algo, para el papel y la pantalla. */
export const cashCountLines = (count: CashCount | null) =>
  DENOMINATIONS.filter((d) => count?.[denominationKey(d)]).map((d) => ({
    kind: d.kind,
    value: d.value,
    quantity: count![denominationKey(d)],
    total: count![denominationKey(d)] * d.value,
  }));
