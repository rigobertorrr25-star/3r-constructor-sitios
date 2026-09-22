import type { CSSProperties } from 'react';
import { resolve } from './responsive';
import type { Breakpoint, Styles } from './types';

const px = (value: number | undefined) => (value === undefined ? undefined : `${value}px`);

/** Convierte los estilos del documento en CSS para el tamaño de pantalla actual. */
export function toCss(styles: Styles | undefined, bp: Breakpoint): CSSProperties {
  if (!styles) return {};
  const paddingX = px(resolve(styles.paddingX, bp));
  const css: CSSProperties = {
    fontSize: px(resolve(styles.fontSize, bp)),
    fontWeight: styles.fontWeight,
    textAlign: styles.textAlign,
    color: styles.color,
    background: styles.background,
    paddingTop: px(resolve(styles.paddingTop, bp)),
    paddingBottom: px(resolve(styles.paddingBottom, bp)),
    paddingLeft: paddingX,
    paddingRight: paddingX,
    marginTop: px(resolve(styles.marginTop, bp)),
    marginBottom: px(resolve(styles.marginBottom, bp)),
    borderRadius: px(styles.borderRadius),
  };
  for (const key of Object.keys(css) as (keyof CSSProperties)[]) {
    if (css[key] === undefined) delete css[key];
  }
  return css;
}

/**
 * Acepta solo enlaces seguros. Bloquea `javascript:`, `data:` y similares: el contenido lo
 * escribe el usuario y luego se publica, así que nunca se debe confiar en él.
 */
export function safeUrl(value: string | undefined): string {
  const url = (value ?? '').trim();
  if (!url) return '';
  if (url.startsWith('#') || url.startsWith('/')) return url.startsWith('//') ? '' : url;
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : '';
}

/** Las imágenes solo admiten http(s) o rutas propias (la subida de archivos llega con el gestor de medios). */
export function safeImageUrl(value: string | undefined): string {
  const url = (value ?? '').trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return /^https?:\/\//i.test(url) ? url : '';
}
