import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { DocumentStorage, SignedUrl } from './document-storage.js';

const SAFE_KEY = /^[a-z0-9-]{1,80}\.[a-z0-9]{1,10}$/i;
const TTL_MS = 5 * 60 * 1000;

/** Respaldo sin R2: guarda en el disco del servidor y sube/descarga por esta misma API con enlaces firmados. */
export class LocalDocumentStorage implements DocumentStorage {
  private readonly root: string;

  constructor(
    private readonly secret: string,
    root?: string,
  ) {
    this.root = resolve(root || join(process.env.LOCALAPPDATA ?? homedir(), '3r-company-docs'));
  }

  private sign(method: string, key: string, exp: number, extra = '') {
    return createHmac('sha256', this.secret).update(`docs:${method}:${key}:${exp}:${extra}`).digest('hex');
  }

  verify(method: 'PUT' | 'GET', key: string, exp: number, sig: string, extra = ''): boolean {
    if (!SAFE_KEY.test(key) || !Number.isFinite(exp) || Date.now() > exp || !/^[0-9a-f]{64}$/.test(sig ?? '')) return false;
    const expected = Buffer.from(this.sign(method, key, exp, extra), 'hex');
    const given = Buffer.from(sig, 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async presignUpload(key: string, contentType: string, origin: string): Promise<SignedUrl> {
    const exp = Date.now() + TTL_MS;
    return {
      url: `${origin}/api/v1/company-files/${encodeURIComponent(key)}?exp=${exp}&sig=${this.sign('PUT', key, exp)}`,
      method: 'PUT',
      headers: { 'content-type': contentType },
    };
  }

  async presignDownload(key: string, fileName: string, contentType: string, origin: string) {
    const exp = Date.now() + TTL_MS;
    const extra = `${fileName}|${contentType}`;
    const q = new URLSearchParams({ exp: String(exp), name: fileName, type: contentType, sig: this.sign('GET', key, exp, extra) });
    return `${origin}/api/v1/company-files/${encodeURIComponent(key)}?${q}`;
  }

  path(key: string) {
    if (!SAFE_KEY.test(key)) throw new Error('Clave de archivo no válida');
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error('Ruta fuera de la carpeta');
    return full;
  }

  async save(key: string, buffer: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(key), buffer);
  }

  read(key: string) {
    return readFile(this.path(key));
  }

  async size(key: string) {
    try {
      return (await stat(this.path(key))).size;
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }
}
