// Prueba que /auth/login y /auth/register cortan tras demasiados intentos seguidos (429),
// para que un ataque de fuerza bruta no pueda probar contraseñas o crear cuentas sin límite.
// Requieren: npm run dev:db (Postgres local) y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
process.env.CRON_SECRET = 'clave-de-prueba-limites';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');

const stamp = Date.now();

let app;
let prisma;
let base;

const call = async (method, path, { body, headers = {} } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

describe('límite de intentos en /auth', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `ratelimit.${stamp}` } } });
    await app.close();
  });

  it('login: corta con 429 tras demasiados intentos seguidos desde la misma IP', async () => {
    const attempts = [];
    for (let i = 0; i < 20; i++) {
      attempts.push(await call('POST', '/auth/login', { body: { email: `nadie.${stamp}@example.com`, password: 'lo-que-sea' } }));
    }
    const statuses = attempts.map((a) => a.status);
    assert.ok(statuses.slice(0, 15).every((s) => s === 401), `los primeros 15 deberían ser 401, salió: ${statuses.join(',')}`);
    assert.ok(statuses.slice(15).some((s) => s === 429), `debería aparecer un 429 después del límite, salió: ${statuses.join(',')}`);
  });

  it('register: corta con 429 tras demasiadas cuentas seguidas desde la misma IP', async () => {
    const attempts = [];
    for (let i = 0; i < 12; i++) {
      attempts.push(
        await call('POST', '/auth/register', {
          body: { email: `ratelimit.${stamp}.${i}@example.com`, password: 'una-clave-larga-123', firstName: 'Ana', acceptPrivacy: true },
        }),
      );
    }
    const statuses = attempts.map((a) => a.status);
    assert.ok(statuses.slice(0, 8).every((s) => s === 201), `los primeros 8 deberían crearse, salió: ${statuses.join(',')}`);
    assert.ok(statuses.slice(8).some((s) => s === 429), `debería aparecer un 429 después del límite, salió: ${statuses.join(',')}`);
  });

  it('desde la web, cada visitante tiene su propio límite; sin la clave no se puede inventar la IP', async () => {
    const login = (headers) => call('POST', '/auth/login', { body: { email: `nadie.${stamp}@example.com`, password: 'lo-que-sea' }, headers });
    // La IP de la conexión ya se gastó su límite en la primera prueba.
    assert.equal((await login({})).status, 429);
    assert.equal((await login({ 'x-3r-client-ip': '203.0.113.7', 'x-3r-relay': 'otra-clave' })).status, 429, 'clave equivocada: cuenta como la conexión');
    const a = [];
    for (let i = 0; i < 3; i++) a.push((await login({ 'x-3r-client-ip': '203.0.113.7', 'x-3r-relay': 'clave-de-prueba-limites' })).status);
    assert.deepEqual(a, [401, 401, 401], 'un visitante nuevo no queda bloqueado por los demás');
    const statuses = [];
    for (let i = 0; i < 20; i++) statuses.push((await login({ 'x-3r-client-ip': '203.0.113.8', 'x-3r-relay': 'clave-de-prueba-limites' })).status);
    assert.ok(statuses.slice(15).some((s) => s === 429), `ese visitante también tiene su límite, salió: ${statuses.join(',')}`);
  });
});
