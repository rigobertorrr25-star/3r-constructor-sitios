import type { Breakpoint, Responsive } from './types';

const isMap = <T>(value: Responsive<T>): value is Partial<Record<Breakpoint, T>> =>
  typeof value === 'object' && value !== null;

/** Valor efectivo en un tamaño: móvil hereda de tablet y esta de escritorio. */
export function resolve<T>(value: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (value === undefined) return undefined;
  if (!isMap(value)) return value;
  if (bp === 'mobile') return value.mobile ?? value.tablet ?? value.desktop;
  if (bp === 'tablet') return value.tablet ?? value.desktop;
  return value.desktop;
}

/**
 * Cambia el valor de un tamaño sin tocar los demás. Un valor simple pasa a mapa por tamaño;
 * en escritorio el resultado sigue siendo un simple número si nadie más lo personalizó.
 */
export function setAt<T>(current: Responsive<T> | undefined, bp: Breakpoint, next: T | undefined): Responsive<T> | undefined {
  const map: Partial<Record<Breakpoint, T>> =
    current === undefined ? {} : isMap(current) ? { ...current } : { desktop: current };

  if (next === undefined) delete map[bp];
  else map[bp] = next;

  const keys = Object.keys(map) as Breakpoint[];
  if (keys.length === 0) return undefined;
  if (keys.length === 1 && keys[0] === 'desktop') return map.desktop;
  return map;
}
