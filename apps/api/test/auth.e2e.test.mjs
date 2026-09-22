// Pruebas de integración de autenticación contra el Postgres de desarrollo.
// Requieren: npm run dev:db (Postgres local) y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');

const stamp = Date.now();
const email = `test.${stamp}@example.com`;
const password = 'una-clave-larga-123';

let app;
let prisma;
let base;

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
};

describe('auth', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `test.${stamp}` } } });
    await app.close();
  });

  let tokens;

  it('registra un usuario sin exponer el hash', async () => {
    const res = await call('POST', '/auth/register', { body: { email, password, firstName: 'Ana' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, email);
    assert.deepEqual(res.body.roles, ['USER']);
    assert.ok(!res.raw.includes('passwordHash') && !res.raw.includes('argon2'));
  });

  it('rechaza email duplicado (409, sin importar mayúsculas)', async () => {
    const res = await call('POST', '/auth/register', { body: { email: email.toUpperCase(), password } });
    assert.equal(res.status, 409);
  });

  it('valida el DTO (400)', async () => {
    const other = `x.${stamp}@example.com`;
    assert.equal((await call('POST', '/auth/register', { body: { email: 'malo', password } })).status, 400);
    assert.equal((await call('POST', '/auth/register', { body: { email: other, password: '123' } })).status, 400);
    assert.equal((await call('POST', '/auth/register', { body: { email: other, password, admin: true } })).status, 400);
  });

  it('login con clave incorrecta o email inexistente da 401', async () => {
    assert.equal((await call('POST', '/auth/login', { body: { email, password: 'incorrecta-123' } })).status, 401);
    assert.equal((await call('POST', '/auth/login', { body: { email: `no.${stamp}@example.com`, password } })).status, 401);
  });

  it('login correcto guarda solo el hash del refresh token', async () => {
    const res = await call('POST', '/auth/login', { body: { email, password } });
    assert.equal(res.status, 200);
    tokens = res.body;
    assert.ok(tokens.accessToken && tokens.refreshToken);
    const hash = createHash('sha256').update(tokens.refreshToken).digest('hex');
    const rows = await prisma.userSession.findMany({ where: { user: { email } } });
    assert.ok(rows.some((r) => r.refreshTokenHash === hash));
    assert.ok(!rows.some((r) => r.refreshTokenHash === tokens.refreshToken));
  });

  it('/auth/me exige token válido', async () => {
    assert.equal((await call('GET', '/auth/me')).status, 401);
    assert.equal((await call('GET', '/auth/me', { token: 'basura' })).status, 401);
    const res = await call('GET', '/auth/me', { token: tokens.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, email);
  });

  it('el rol USER no entra a /admin (403) y sin token da 401', async () => {
    assert.equal((await call('GET', '/admin/ping')).status, 401);
    assert.equal((await call('GET', '/admin/ping', { token: tokens.accessToken })).status, 403);
  });

  it('un ADMIN sí entra a /admin', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.userRole.create({ data: { userId: user.id, role: 'ADMIN' } });
    const login = await call('POST', '/auth/login', { body: { email, password } });
    assert.equal((await call('GET', '/admin/ping', { token: login.body.accessToken })).status, 200);
  });

  it('refresh rota el token y reusar el viejo revoca todas las sesiones', async () => {
    const first = await call('POST', '/auth/refresh', { body: { refreshToken: tokens.refreshToken } });
    assert.equal(first.status, 200);
    assert.notEqual(first.body.refreshToken, tokens.refreshToken);

    const reuse = await call('POST', '/auth/refresh', { body: { refreshToken: tokens.refreshToken } });
    assert.equal(reuse.status, 401);

    const afterReuse = await call('POST', '/auth/refresh', { body: { refreshToken: first.body.refreshToken } });
    assert.equal(afterReuse.status, 401, 'la sesión nueva también debe quedar revocada');

    const user = await prisma.user.findUnique({ where: { email } });
    const active = await prisma.userSession.count({ where: { userId: user.id, revokedAt: null } });
    assert.equal(active, 0);
  });

  it('logout revoca la sesión', async () => {
    const login = await call('POST', '/auth/login', { body: { email, password } });
    const out = await call('POST', '/auth/logout', { body: { refreshToken: login.body.refreshToken } });
    assert.equal(out.status, 204);
    const again = await call('POST', '/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
    assert.equal(again.status, 401);
  });

  it('deja registro de auditoría', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    const actions = (await prisma.auditLog.findMany({ where: { userId: user.id } })).map((a) => a.action);
    for (const expected of ['USER_REGISTERED', 'USER_LOGIN', 'REFRESH_TOKEN_REUSE_DETECTED']) {
      assert.ok(actions.includes(expected), `falta ${expected}`);
    }
  });
});
