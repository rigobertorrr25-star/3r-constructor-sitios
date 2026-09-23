export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface PresignedUpload {
  /** A dónde el navegador manda el archivo directamente (nunca pasa por el servidor de Next). */
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  /** Dirección pública ya lista para usar como `src` en el editor. */
  publicUrl: string;
}

/**
 * Genera un enlace de subida directa: el navegador sube el archivo él mismo a `uploadUrl` (a R2 o,
 * en desarrollo, a esta misma API), sin que el archivo pase por el servidor de Next — necesario para
 * videos, que fácilmente superan el límite de tamaño de las funciones de Vercel.
 */
export interface MediaStorage {
  presignUpload(key: string, contentType: string, origin: string): Promise<PresignedUpload>;
}

export const MEDIA_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const MEDIA_MAX_BYTES = 100 * 1024 * 1024; // 100 MB, generoso para video corto
