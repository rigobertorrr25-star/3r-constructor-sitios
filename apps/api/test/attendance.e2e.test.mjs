// Pruebas del control de asistencia: tablet con código que cambia, marcación con PIN y panel del equipo.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { AttendanceService } = await import('../dist/attendance/attendance.service.js');
const { currentCode, kioskCode, CODE_WINDOW_MS } = await import('../dist/attendance/codes.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = { user: `attendance.u.${stamp}@example.com`, admin: `attendance.a.${stamp}@example.com` };
let app, prisma, base, service;
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

describe('asistencia', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    service = app.get(AttendanceService);
    for (const email of Object.values(emails)) await call('POST', '/auth/register', { body: { email, password, acceptPrivacy: true } });
    const admin = await prisma.user.findUnique({ where: { email: emails.admin } });
    await prisma.userRole.create({ data: { userId: admin.id, role: 'ADMIN' } });
    for (const [k, email] of Object.entries(emails)) tokens[k] = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
  });

  after(async () => {
    try {
      await prisma.attendanceBusiness.deleteMany({ where: { name: { startsWith: `Prueba ${stamp}` } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'attendance.' } } });
    } finally {
      await app.close();
    }
  });

  let business, secret, ana;

  it('solo el equipo administra negocios', async () => {
    assert.equal((await call('GET', '/admin/attendance')).status, 401);
    assert.equal((await call('GET', '/admin/attendance', { token: tokens.user })).status, 403);
    assert.equal((await call('POST', '/admin/attendance', { token: tokens.user, body: { name: 'x' } })).status, 403);
  });

  it('crea el negocio y sus empleados; el PIN no se repite', async () => {
    const created = await call('POST', '/admin/attendance', { token: tokens.admin, body: { name: `Prueba ${stamp} Azul Caribe` } });
    assert.equal(created.status, 201);
    business = created.body;
    assert.match(business.slug, /^prueba-\d+-azul-caribe$/);
    assert.equal(business.kioskSecret, undefined, 'la lista no muestra el secreto');

    const res = await call('POST', `/admin/attendance/${business.id}/employees`, {
      token: tokens.admin,
      body: { name: 'Ana', pin: '1234', shiftStart: '08:00', shiftEnd: '15:00' },
    });
    assert.equal(res.status, 201);
    ana = res.body;
    assert.equal(ana.pinHash, undefined, 'nunca se devuelve la huella del PIN');

    const dup = await call('POST', `/admin/attendance/${business.id}/employees`, { token: tokens.admin, body: { name: 'Beto', pin: '1234' } });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, 'PIN_TAKEN');
    assert.equal((await call('POST', `/admin/attendance/${business.id}/employees`, { token: tokens.admin, body: { name: 'Beto', pin: '12a4' } })).status, 400);
    assert.equal((await call('POST', `/admin/attendance/${business.id}/employees`, { token: tokens.admin, body: { name: 'Beto', pin: '5678', shiftStart: '25:00' } })).status, 400);

    const detail = await call('GET', `/admin/attendance/${business.id}`, { token: tokens.admin });
    secret = detail.body.kioskSecret;
    assert.ok(secret.length >= 30);
    assert.equal(detail.body.employees.length, 1);
  });

  it('la tablet da un código vigente; un código viejo o inventado no sirve', async () => {
    assert.equal((await call('GET', '/attendance/kiosk/no-existe')).status, 404);
    const kiosk = await call('GET', `/attendance/kiosk/${secret}`);
    assert.equal(kiosk.status, 200);
    assert.equal(kiosk.body.slug, business.slug);
    assert.ok(kiosk.body.expiresInMs > 0 && kiosk.body.expiresInMs <= CODE_WINDOW_MS);

    const old = kioskCode(secret, business.slug, Math.floor(Date.now() / CODE_WINDOW_MS) - 10);
    const expired = await call('POST', `/attendance/${business.slug}/punch`, { body: { code: old, pin: '1234' } });
    assert.equal(expired.status, 400);
    assert.equal(expired.body.code, 'CODE_EXPIRED');
    assert.equal((await call('POST', `/attendance/${business.slug}/punch`, { body: { code: 'inventado', pin: '1234' } })).body.code, 'CODE_EXPIRED');

    const wrongPin = await call('POST', `/attendance/${business.slug}/punch`, { body: { code: kiosk.body.code, pin: '9999' } });
    assert.equal(wrongPin.status, 400);
    assert.equal(wrongPin.body.code, 'PIN_INVALID');
  });

  it('marca entrada, rechaza el doble escaneo y luego marca salida', async () => {
    const t0 = new Date();
    const code = (at) => currentCode(secret, business.slug, at.getTime()).code;

    const entry = await call('POST', `/attendance/${business.slug}/punch`, { body: { code: code(t0), pin: '1234' } });
    assert.equal(entry.status, 200);
    assert.equal(entry.body.type, 'in');
    assert.equal(entry.body.employeeName, 'Ana');

    const again = await call('POST', `/attendance/${business.slug}/punch`, { body: { code: code(new Date()), pin: '1234' } });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'DOUBLE_SCAN');

    // Siete horas después (se llama al servicio con otra hora: la API siempre usa la hora del servidor).
    const t1 = new Date(t0.getTime() + 7 * 3_600_000);
    const exit = await service.punch(business.slug, code(t1), '1234', t1);
    assert.equal(exit.type, 'out');
    assert.equal(exit.workedMinutes, 420);

    // Una entrada sin salida de hace más de 16 horas se da por olvidada: la siguiente marcación abre otra jornada.
    const t2 = new Date(t0.getTime() + 24 * 3_600_000);
    assert.equal((await service.punch(business.slug, code(t2), '1234', t2)).type, 'in');
    const t3 = new Date(t0.getTime() + 42 * 3_600_000);
    assert.equal((await service.punch(business.slug, code(t3), '1234', t3)).type, 'in');
  });

  it('el reporte lista jornadas por fechas y el equipo corrige o borra', async () => {
    const day = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
    const from = day(new Date());
    const to = day(new Date(Date.now() + 3 * 86_400_000));
    const list = await call('GET', `/admin/attendance/${business.id}/records?from=${from}&to=${to}`, { token: tokens.admin });
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 3);
    assert.equal(list.body[0].employee.name, 'Ana');
    assert.ok(list.body[0].clockOut);
    const forgotten = list.body[1];
    assert.equal(forgotten.clockOut, null);

    assert.equal((await call('GET', `/admin/attendance/${business.id}/records?from=2026-01-01&to=2026-12-31`, { token: tokens.admin })).status, 400);
    assert.equal((await call('GET', `/admin/attendance/${business.id}/records?from=x&to=${to}`, { token: tokens.admin })).status, 400);

    const bad = await call('PATCH', `/admin/attendance/${business.id}/records/${forgotten.id}`, {
      token: tokens.admin,
      body: { clockOut: new Date(new Date(forgotten.clockIn).getTime() - 60_000).toISOString() },
    });
    assert.equal(bad.status, 400);
    const fixed = await call('PATCH', `/admin/attendance/${business.id}/records/${forgotten.id}`, {
      token: tokens.admin,
      body: { clockOut: new Date(new Date(forgotten.clockIn).getTime() + 7 * 3_600_000).toISOString() },
    });
    assert.equal(fixed.status, 200);
    assert.ok(fixed.body.editedAt);

    assert.equal((await call('DELETE', `/admin/attendance/${business.id}/records/${list.body[2].id}`, { token: tokens.admin })).status, 204);
    assert.equal((await call('GET', `/admin/attendance/${business.id}/records?from=${from}&to=${to}`, { token: tokens.admin })).body.length, 2);
  });

  it('un empleado desactivado o un enlace de tablet cambiado ya no sirven', async () => {
    await call('PATCH', `/admin/attendance/${business.id}/employees/${ana.id}`, { token: tokens.admin, body: { isActive: false } });
    const code = currentCode(secret, business.slug).code;
    assert.equal((await call('POST', `/attendance/${business.slug}/punch`, { body: { code, pin: '1234' } })).body.code, 'PIN_INVALID');

    const rotated = await call('PATCH', `/admin/attendance/${business.id}`, { token: tokens.admin, body: { rotateKiosk: true } });
    assert.notEqual(rotated.body.kioskSecret, secret);
    assert.equal((await call('GET', `/attendance/kiosk/${secret}`)).status, 404);
    assert.equal((await call('GET', `/attendance/kiosk/${rotated.body.kioskSecret}`)).status, 200);
  });
});
