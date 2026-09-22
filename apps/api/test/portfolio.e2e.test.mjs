// Pruebas del portafolio (trabajos realizados) que se muestra en la portada.
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
const emails = { user: `portfolio.u.${stamp}@example.com`, admin: `portfolio.a.${stamp}@example.com` };
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

describe('portafolio', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const email of Object.values(emails)) await call('POST', '/auth/register', { body: { email, password } });
    const admin = await prisma.user.findUnique({ where: { email: emails.admin } });
    await prisma.userRole.create({ data: { userId: admin.id, role: 'ADMIN' } });
    for (const [k, email] of Object.entries(emails)) tokens[k] = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
  });

  after(async () => {
    try {
      await prisma.portfolioItem.deleteMany({ where: { title: { startsWith: `Prueba ${stamp}` } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'portfolio.' } } });
    } finally {
      await app.close();
    }
  });

  let item;

  it('el portafolio es público', async () => {
    const res = await call('GET', '/portfolio');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('solo el equipo administra ejemplos', async () => {
    assert.equal((await call('GET', '/admin/portfolio')).status, 401);
    assert.equal((await call('GET', '/admin/portfolio', { token: tokens.user })).status, 403);
    assert.equal((await call('POST', '/admin/portfolio', { token: tokens.user, body: { title: 'x', url: 'https://a.com' } })).status, 403);
  });

  it('crea, muestra, oculta y borra un ejemplo', async () => {
    const created = await call('POST', '/admin/portfolio', {
      token: tokens.admin,
      body: { title: `Prueba ${stamp}`, url: 'https://ejemplo.com', category: 'Restaurante', thumbnailUrl: '/portfolio/ejemplo.png' },
    });
    assert.equal(created.status, 201);
    item = created.body;
    assert.ok((await call('GET', '/portfolio')).body.some((p) => p.id === item.id));

    await call('PATCH', `/admin/portfolio/${item.id}`, { token: tokens.admin, body: { isActive: false } });
    assert.ok(!(await call('GET', '/portfolio')).body.some((p) => p.id === item.id), 'oculto no se ve');
    assert.ok((await call('GET', '/admin/portfolio', { token: tokens.admin })).body.some((p) => p.id === item.id), 'el equipo sí lo ve');

    const cleared = await call('PATCH', `/admin/portfolio/${item.id}`, { token: tokens.admin, body: { thumbnailUrl: '' } });
    assert.equal(cleared.body.thumbnailUrl, null);

    assert.equal((await call('DELETE', `/admin/portfolio/${item.id}`, { token: tokens.admin })).status, 204);
    assert.equal((await call('DELETE', `/admin/portfolio/${item.id}`, { token: tokens.admin })).status, 404);
  });

  it('rechaza enlaces peligrosos o inválidos (400)', async () => {
    const send = (body) => call('POST', '/admin/portfolio', { token: tokens.admin, body: { title: `Prueba ${stamp}`, ...body } });
    assert.equal((await send({ url: 'javascript:alert(1)' })).status, 400);
    assert.equal((await send({ url: 'data:text/html,x' })).status, 400);
    assert.equal((await send({ url: 'ftp://x.com' })).status, 400);
    assert.equal((await send({ url: 'https://ok.com', thumbnailUrl: 'javascript:x' })).status, 400);
    assert.equal((await send({ url: 'https://ok.com', thumbnailUrl: '//evil.com/x.png' })).status, 400);
    assert.equal((await send({})).status, 400);
  });
});
