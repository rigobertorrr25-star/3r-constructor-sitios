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
