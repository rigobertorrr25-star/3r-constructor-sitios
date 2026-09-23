import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaStorage, PresignedUpload } from './media-storage.js';

/**
 * El navegador sube el archivo directo a Cloudflare R2 (el servidor solo firma el permiso) — así un
 * video no tiene que pasar por el servidor de Next, que tiene un límite de tamaño mucho más chico.
 * El bucket necesita acceso público (R2.dev o un dominio propio) y su propio permiso CORS para
 * aceptar la subida desde el navegador (ver README).
 */
export class R2MediaStorage implements MediaStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly publicBase: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async presignUpload(key: string, contentType: string): Promise<PresignedUpload> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: `media/${key}`, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    return {
      uploadUrl,
      method: 'PUT',
      headers: { 'content-type': contentType },
      publicUrl: `${this.publicBase.replace(/\/$/, '')}/media/${key}`,
    };
  }
}
