import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { MediaStorage, PresignedUpload } from './media-storage.js';

const SAFE_KEY = /^[a-z0-9-]{1,80}\.[a-z0-9]{1,10}$/i;
const UPLOAD_TTL_MS = 5 * 60 * 1000;

/**
 * Respaldo sin cuenta de nube: guarda en el disco del servidor y sirve los archivos él mismo.
 * Funciona igual en desarrollo y en producción (si no se configuró R2), con la misma salvedad que
 * los sitios publicados: el disco de hostings como Render no es permanente entre despliegues.
 */
export class LocalMediaStorage implements MediaStorage {
  private readonly root: string;

  constructor(
    private readonly secret: string,
    root?: string,
  ) {
    this.root = resolve(root || join(process.env.LOCALAPPDATA ?? homedir(), '3r-media'));
  }

  private sign(key: string, exp: number) {
    return createHmac('sha256', this.secret).update(`${key}:${exp}`).digest('hex');
  }

  /** Firma corta y con vencimiento: cualquiera con el enlace puede subir ESE archivo, nada más. */
  verify(key: string, exp: number, sig: string): boolean {
    if (!SAFE_KEY.test(key) || !Number.isFinite(exp) || Date.now() > exp || !sig) return false;
    const expected = Buffer.from(this.sign(key, exp), 'hex');
    const given = Buffer.from(sig, 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async presignUpload(key: string, contentType: string, origin: string): Promise<PresignedUpload> {
    const exp = Date.now() + UPLOAD_TTL_MS;
    const sig = this.sign(key, exp);
    return {
      uploadUrl: `${origin}/api/v1/media/local/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`,
      method: 'PUT',
      headers: { 'content-type': contentType },
      publicUrl: `${origin}/api/v1/media/files/${encodeURIComponent(key)}`,
    };
  }

  path(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error('Clave de archivo no válida');
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error('Ruta fuera de la carpeta');
    return full;
  }

  async save(key: string, buffer: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(key), buffer);
  }
}
