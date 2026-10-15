// Ayudas para cuando se cae el internet. Sin base de datos: lo usan las pantallas.

/**
 * Si el error es de conexión (no llegó al servidor o no volvió la respuesta) y no un error de la app.
 * Las acciones del servidor de Next fallan con TypeError ("Failed to fetch", "Load failed", "NetworkError…").
 */
export function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!(error instanceof Error)) return false;
  return error instanceof TypeError || /fetch|network|load failed|conexi/i.test(error.message);
}

/** Espera creciente entre reintentos: 3 s, 6 s, 12 s… hasta 30 s. */
export const retryDelay = (attempt: number) => Math.min(30_000, 3_000 * 2 ** Math.max(0, attempt));

export const OFFLINE_MESSAGE = 'Sin conexión: no se guardó. Intenta de nuevo cuando vuelva el internet.';

/** Para botones que llaman al servidor y devuelven un error o nada: sin conexión devuelve el aviso en vez de romper la pantalla. */
export const orOffline = (promise: Promise<string | null>) => promise.catch(() => OFFLINE_MESSAGE);
