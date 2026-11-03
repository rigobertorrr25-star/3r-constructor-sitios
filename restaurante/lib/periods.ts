// Periodos rápidos para los reportes. Sin base de datos: lo usan también las pantallas.

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const PERIODS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
] as const;

export function periodRange(key: string, today: string): { from: string; to: string } {
  switch (key) {
    case 'ayer':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case 'mes':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'mes-pasado': {
      const first = `${today.slice(0, 7)}-01`;
      const last = addDays(first, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    }
    default:
      return { from: today, to: today };
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rango escogido a mano («Desde / Hasta», pedido de Rigoberto el 3 nov 2026: «las ventas de una fecha a otra, igual que
 * los gastos»). Null si falta una fecha o no es válida; si vienen al revés, se ordenan.
 */
export function customRange(desde?: string, hasta?: string): { from: string; to: string } | null {
  if (!desde || !hasta || !DATE.test(desde) || !DATE.test(hasta) || Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) return null;
  return desde <= hasta ? { from: desde, to: hasta } : { from: hasta, to: desde };
}

/** «27 oct 2026» para mostrar una fecha AAAA-MM-DD. */
export const shortDate = (date: string, lang: 'es' | 'en' = 'es') =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
