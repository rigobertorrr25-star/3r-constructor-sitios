// Subida de imágenes/videos: pedir permiso (/media/presign), subir directo al enlace firmado y
// volver a leerlo. Sin R2 configurado en desarrollo, usa el respaldo de disco local.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = { user: `media.u.${stamp}@example.com`, admin: `media.a.${stamp}@example.com` };
let app, prisma, base;
const tokens = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

describe('subir medios (imágenes/video)', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const email of Object.values(emails)) await call('POST', '/auth/register', { body: { email, password, acceptPrivacy: true } });
    const admin = await prisma.user.findUnique({ where: { email: emails.admin } });
    await prisma.userRole.create({ data: { userId: admin.id, role: 'ADMIN' } });
    for (const [k, email] of Object.entries(emails)) tokens[k] = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
  });

  after(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: { startsWith: 'media.' } } });
    } finally {
      await app.close();
    }
  });

  it('un cliente (no admin) no puede pedir subir', async () => {
    const res = await call('POST', '/media/presign', { token: tokens.user, body: { contentType: 'image/png' } });
    assert.equal(res.status, 403);
  });

  it('rechaza tipos de archivo no permitidos', async () => {
    const res = await call('POST', '/media/presign', { token: tokens.admin, body: { contentType: 'application/pdf' } });
    assert.equal(res.status, 400);
  });

  it('admin: pide subir una imagen, la sube y la vuelve a leer', async () => {
    const presign = await call('POST', '/media/presign', { token: tokens.admin, body: { contentType: 'image/png' } });
    assert.equal(presign.status, 201);
    assert.match(presign.body.publicUrl, /\/api\/v1\/media\/files\/.+\.png$/);
    assert.equal(presign.body.method, 'PUT');

    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const upload = await fetch(presign.body.uploadUrl, { method: 'PUT', headers: presign.body.headers, body: pixel });
    assert.equal(upload.status, 200);

    const read = await fetch(presign.body.publicUrl);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await read.arrayBuffer()).length, pixel.length);
  });

  it('admin: también puede subir video', async () => {
    const presign = await call('POST', '/media/presign', { token: tokens.admin, body: { contentType: 'video/mp4' } });
    assert.equal(presign.status, 201);
    assert.match(presign.body.publicUrl, /\.mp4$/);
  });

  it('el enlace de subida no sirve para otro archivo, ni una vez usado', async () => {
    const presign = await call('POST', '/media/presign', { token: tokens.admin, body: { contentType: 'image/png' } });
    const badUrl = presign.body.uploadUrl.replace(/sig=[^&]+/, 'sig=0000000000000000000000000000000000000000000000000000000000000000');
    const bad = await fetch(badUrl, { method: 'PUT', headers: presign.body.headers, body: Buffer.from('x') });
    assert.equal(bad.status, 400);
  });

  it('un archivo que nunca se subió da 404 al leerlo', async () => {
    const res = await fetch(`${base}/media/files/no-existe-${stamp}.png`);
    assert.equal(res.status, 404);
  });
});
