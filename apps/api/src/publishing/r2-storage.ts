import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PublishStorage } from './storage.js';

const contentTypeOf = (name: string) => {
  if (name.endsWith('.html')) return 'text/html; charset=utf-8';
  if (name.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (name.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
};

/**
 * Guarda los sitios publicados en Cloudflare R2 (compatible con S3). A diferencia del disco local,
 * sobrevive a que el servidor se reinicie o se vuelva a desplegar — necesario en Render y hostings
 * parecidos, donde el disco no es permanente.
 */
export class R2PublishStorage implements PublishStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(dir: string, files: Record<string, string>) {
    await Promise.all(
      Object.entries(files).map(([name, content]) =>
        this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: `${dir}/${name}`,
            Body: content,
            ContentType: contentTypeOf(name),
          }),
        ),
      ),
    );
  }

  async get(dir: string, file: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: `${dir}/${file}` }));
      return (await res.Body?.transformToString('utf-8')) ?? null;
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async remove(dir: string) {
    const list = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `${dir}/` }));
    const keys = (list.Contents ?? []).map((obj) => ({ Key: obj.Key! })).filter((k) => k.Key);
    if (keys.length === 0) return;
    await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }));
  }
}
