// Formatos para mostrar: hora local del negocio, minutos de una mesa y pesos colombianos.

export function elapsedMinutes(from: string | Date, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
}

/** "8 min", "1 h 05", "3 h 20". */
export function formatElapsed(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function formatTime(date: string | Date, timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('es-CO', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

export function formatDateTime(date: string | Date, timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('es-CO', { timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

/** Pesos enteros: 12500 → "$12.500". */
export function formatCop(pesos: number) {
  const n = Math.round(pesos);
  return n < 0 ? `−$${(-n).toLocaleString('es-CO')}` : `$${n.toLocaleString('es-CO')}`;
}

/** Una mesa lleva demasiado tiempo (lo mismo que mira el radar de fugas). */
export const LONG_TABLE_MINUTES = 90;
