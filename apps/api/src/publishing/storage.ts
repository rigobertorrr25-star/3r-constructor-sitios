import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export const PUBLISH_STORAGE = Symbol('PUBLISH_STORAGE');

/**
 * Dónde viven los archivos publicados. Hoy es una carpeta local; para producción se cambia por
 * S3 / Cloudflare R2 implementando esta misma interfaz, sin tocar el resto del código.
 */
export interface PublishStorage {
  put(dir: string, files: Record<string, string>): Promise<void>;
  get(dir: string, file: string): Promise<string | null>;
  remove(dir: string): Promise<void>;
}

// Las claves las genera el servidor (etiqueta + uuid + nombre validado), pero se comprueban igual.
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]{0,120}$/i;

export class LocalPublishStorage implements PublishStorage {
  private readonly root: string;

  constructor(root?: string) {
    // Por defecto fuera de OneDrive, que sincroniza y bloquea muchos archivos pequeños.
    this.root = resolve(root || join(process.env.LOCALAPPDATA ?? homedir(), '3r-published'));
  }

  private path(dir: string, file?: string) {
    const parts = [...dir.split('/'), ...(file ? [file] : [])];
    if (parts.some((part) => !SAFE_SEGMENT.test(part) || part.includes('..'))) throw new Error('Ruta de publicación no válida');
    const full = resolve(this.root, ...parts);
    if (!full.startsWith(this.root + sep)) throw new Error('Ruta de publicación fuera de la carpeta');
    return full;
  }

  async put(dir: string, files: Record<string, string>) {
    const base = this.path(dir);
    await mkdir(base, { recursive: true });
    await Promise.all(Object.entries(files).map(([name, content]) => writeFile(this.path(dir, name), content, 'utf8')));
  }

  async get(dir: string, file: string) {
    try {
      return await readFile(this.path(dir, file), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(dir: string) {
    await rm(this.path(dir), { recursive: true, force: true });
  }
}
