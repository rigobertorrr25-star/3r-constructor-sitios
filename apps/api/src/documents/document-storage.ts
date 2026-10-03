export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface SignedUrl {
  url: string;
  method: 'PUT' | 'GET';
  headers: Record<string, string>;
}

/**
 * Archivos privados de las empresas (contratos, cédulas, soportes). A diferencia de las imágenes del editor, nunca
 * tienen dirección pública: se suben y se descargan con enlaces firmados que vencen en pocos minutos, y la API decide
 * antes quién puede pedirlos.
 */
export interface DocumentStorage {
  presignUpload(key: string, contentType: string, origin: string): Promise<SignedUrl>;
  presignDownload(key: string, fileName: string, contentType: string, origin: string): Promise<string>;
  /** Tamaño del archivo ya subido, o null si no está. */
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
  /** Guardar desde el propio servidor (p. ej. un PDF generado). */
  save(key: string, buffer: Buffer, contentType: string): Promise<void>;
}

export const DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
