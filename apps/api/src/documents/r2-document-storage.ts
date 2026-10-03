import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { DocumentStorage, SignedUrl } from './document-storage.js';

const PREFIX = 'company-docs/';

/**
 * Documentos en Cloudflare R2, en un bucket privado (`R2_DOCS_BUCKET`) o, si no hay, en la carpeta `company-docs/`
 * del bucket de siempre. Las claves son aleatorias y la descarga es con enlace firmado de 5 minutos (ver README).
 */
export class R2DocumentStorage implements DocumentStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  }

  async presignUpload(key: string, contentType: string): Promise<SignedUrl> {
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: PREFIX + key, ContentType: contentType }), { expiresIn: 300 });
    return { url, method: 'PUT', headers: { 'content-type': contentType } };
  }

  presignDownload(key: string, fileName: string, contentType: string): Promise<string> {
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: PREFIX + key, ResponseContentDisposition: disposition, ResponseContentType: contentType }),
      { expiresIn: 300 },
    );
  }

  async size(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: PREFIX + key }));
      return head.ContentLength ?? 0;
    } catch {
      return null;
    }
  }

  async save(key: string, buffer: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: PREFIX + key, Body: buffer, ContentType: contentType }));
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: PREFIX + key }));
  }
}
