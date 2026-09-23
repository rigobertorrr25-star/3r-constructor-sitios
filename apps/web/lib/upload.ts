// Sube un archivo desde el navegador: pide permiso a la API (a través del BFF, con la sesión) y
// luego lo manda DIRECTO al enlace firmado que responde — nunca pasa por el servidor de Next, así
// un video no choca con su límite de tamaño por petición.
'use client';

const ACCEPTED: Record<string, string> = {
  'image/png': 'imagen PNG',
  'image/jpeg': 'imagen JPEG',
  'image/webp': 'imagen WEBP',
  'image/gif': 'imagen GIF',
  'video/mp4': 'video MP4',
  'video/webm': 'video WEBM',
};

const MAX_BYTES = 100 * 1024 * 1024;

export const ACCEPT_IMAGE = 'image/png,image/jpeg,image/webp,image/gif';
export const ACCEPT_VIDEO = 'video/mp4,video/webm';

export class UploadError extends Error {}

export async function uploadMedia(file: File): Promise<string> {
  if (!ACCEPTED[file.type]) {
    throw new UploadError(`Ese tipo de archivo no se admite (${file.type || 'desconocido'}). Usa PNG, JPEG, WEBP, GIF, MP4 o WEBM.`);
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError('El archivo pesa más de 100 MB.');
  }

  const presignRes = await fetch('/api/bff/media/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: file.type }),
  });
  if (!presignRes.ok) throw new UploadError('No se pudo pedir permiso para subir el archivo.');
  const presign = (await presignRes.json()) as { uploadUrl: string; method: 'PUT'; headers: Record<string, string>; publicUrl: string };

  const uploadRes = await fetch(presign.uploadUrl, { method: presign.method, headers: presign.headers, body: file });
  if (!uploadRes.ok) throw new UploadError('La subida falló a mitad de camino. Inténtalo otra vez.');

  return presign.publicUrl;
}
