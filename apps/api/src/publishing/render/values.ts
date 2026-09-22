// Todo lo que viene del documento del editor es texto escrito por una persona: nunca se confía en él.
// Estas funciones convierten cada valor en algo seguro para poner en HTML o CSS, o lo descartan.

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

/** Un valor único o uno por tamaño de pantalla. Móvil hereda de tablet y esta de escritorio. */
export function resolve<T>(value: T | Partial<Record<Breakpoint, T>> | undefined, bp: Breakpoint): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') return value;
  const map = value as Partial<Record<Breakpoint, T>>;
  if (bp === 'mobile') return map.mobile ?? map.tablet ?? map.desktop;
  if (bp === 'tablet') return map.tablet ?? map.desktop;
  return map.desktop;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

export const num = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;

// #rgb / #rrggbb / #rrggbbaa, rgb()/rgba() con números, o una palabra de color (red, transparent…).
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*(,\s*\d{1,3}\s*){2}(,\s*(0|1|0?\.\d{1,3})\s*)?\)|[a-z]{3,20})$/i;

export const color = (value: unknown): string | undefined =>
  typeof value === 'string' && COLOR.test(value.trim()) ? value.trim() : undefined;

/** Enlaces: http(s), mailto, tel, anclas y rutas propias. Bloquea javascript:, data: y similares. */
export function safeUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url || url.length > 2000) return '';
  if (url.startsWith('#') || url.startsWith('/')) return url.startsWith('//') ? '' : url;
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : '';
}

/** Imágenes: solo http(s) o rutas propias. */
export function safeImageUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url || url.length > 2000) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return /^https?:\/\//i.test(url) ? url : '';
}

export const isExternal = (url: string) => /^https?:\/\//i.test(url);
