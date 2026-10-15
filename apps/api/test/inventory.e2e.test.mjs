// Pruebas de integración del inventario y activos de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `inv.owner.${stamp}@example.com`,
  emp: `inv.emp.${stamp}@example.com`,
  emp2: `inv.emp2.${stamp}@example.com`,
  sup: `inv.sup.${stamp}@example.com`,
  hr: `inv.hr.${stamp}@example.com`,
  staff: `inv.staff.${stamp}@example.com`,
};
let app, prisma, base, company;
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
const as = (who) => (method, path, body) => call(method, path, { token: tokens[who], body });
const mailToken = (to, subject) => {
  const m = [...sentEmails].reverse().find((x) => x.to === to && x.subject.includes(subject));
  const r = m && /token=([^\s&"]+)/.exec(m.text);
  return r ? decodeURIComponent(r[1]) : null;
};
const signup = async (email) => {
  await call('POST', '/auth/register', { body: { email, password, firstName: 'Prueba', acceptPrivacy: true } });
  await call('POST', '/auth/verify-email', { body: { token: mailToken(email, 'confirma tu correo') } });
  return (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
};

describe('inventario y activos', () => {
  let inv;
  let cafe;
  let tablet;
  const member = async (k) => prisma.companyMember.findFirst({ where: { companyId: company.id, user: { email: emails[k] } } });

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const [k, e] of Object.entries(emails)) tokens[k] = await signup(e);
    const staff = await prisma.user.findUnique({ where: { email: emails.staff } });
    await prisma.userRole.create({ data: { userId: staff.id, role: 'ADMIN' } });
    tokens.staff = (await call('POST', '/auth/login', { body: { email: emails.staff, password } })).body.accessToken;
    company = (await as('owner')('POST', '/companies', { name: `Inventario ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['emp2', 'employee'],
      ['sup', 'supervisor'],
      ['hr', 'hr'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    inv = `/companies/${company.id}/inventory`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'inv.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el inventario es de supervisor en adelante', async () => {
    assert.equal((await as('sup')('GET', `${inv}/items`)).status, 403);
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['inventory', 'alerts'] });
    assert.equal((await as('emp')('GET', `${inv}/items`)).status, 403);
    assert.equal((await as('sup')('GET', `${inv}/items`)).status, 200);
    assert.equal((await as('sup')('POST', `${inv}/items`, { name: 'Raro', unit: 'barril' })).status, 400);
    assert.equal((await as('sup')('POST', `${inv}/items`, { name: 'Leche', unit: 'litro', initialStock: 1.23456 })).status, 400, 'hasta 3 decimales');
  });

  it('entradas, salidas sin quedar en negativo, conteo y aviso de poco inventario', async () => {
    cafe = (
      await as('sup')('POST', `${inv}/items`, { name: 'Café en grano', unit: 'kg', category: 'Insumos', minStock: 2, cost: 48000, initialStock: 5.5 })
    ).body;
    let item = (await as('sup')('GET', `${inv}/items/${cafe.id}`)).body;
    assert.equal(item.stock, 5.5);
    assert.equal(item.cost, 48000);
    assert.equal(item.movements[0].note, 'Inventario inicial');
    assert.equal((await as('sup')('POST', `${inv}/items/${cafe.id}/movements`, { type: 'out', quantity: 6 })).body.message, 'No alcanza: hay 5,5 kg');
    assert.equal((await as('sup')('POST', `${inv}/items/${cafe.id}/movements`, { type: 'out', quantity: 0 })).status, 400);
    let r = (await as('sup')('POST', `${inv}/items/${cafe.id}/movements`, { type: 'out', quantity: 1.25, note: 'Turno mañana' })).body;
    assert.deepEqual(r, { stock: 4.25, low: false });
    r = (await as('sup')('POST', `${inv}/items/${cafe.id}/movements`, { type: 'out', quantity: 2.5 })).body;
    assert.deepEqual(r, { stock: 1.75, low: true });
    const owner = await member('owner');
    const emp = await member('emp');
    assert.ok(await prisma.notification.findFirst({ where: { memberId: owner.id, title: 'Queda poco: Café en grano' } }));
    assert.equal(await prisma.notification.count({ where: { memberId: emp.id, kind: 'inventory' } }), 0, 'al empleado no le llega');
    await as('sup')('POST', `${inv}/items/${cafe.id}/movements`, { type: 'out', quantity: 0.5 });
    assert.equal(await prisma.notification.count({ where: { memberId: owner.id, kind: 'inventory' } }), 1, 'un aviso, no uno por salida');
    assert.equal((await as('sup')('GET', `${inv}/summary`)).body.lowStock, 1);
    const list = (await as('sup')('GET', `${inv}/items?filter=low`)).body;
    assert.equal(list.items.length, 1);
    assert.equal(list.totals.value, 60000, '1,25 kg × $48.000');
    r = (await as('sup')('POST', `${inv}/items/${cafe.id}/movements`, { type: 'count', quantity: 10 })).body;
    assert.deepEqual(r, { stock: 10, low: false });
    item = (await as('sup')('GET', `${inv}/items/${cafe.id}`)).body;
    assert.deepEqual(
      item.movements.map((m) => [m.type, m.quantity, m.stockAfter]),
      [
        ['count', 10, 10],
        ['out', 0.5, 1.25],
        ['out', 2.5, 1.75],
        ['out', 1.25, 4.25],
        ['in', 5.5, 5.5],
      ],
    );
    assert.equal(item.movements[0].by, 'Prueba');
  });

  it('salidas al tiempo no dejan el inventario en negativo', async () => {
    const vasos = (await as('sup')('POST', `${inv}/items`, { name: 'Vasos 12 oz', unit: 'unidad', initialStock: 10 })).body;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => as('sup')('POST', `${inv}/items/${vasos.id}/movements`, { type: 'out', quantity: 3 })),
    );
    assert.equal(results.filter((x) => x.status === 201).length, 3);
    assert.equal((await as('sup')('GET', `${inv}/items/${vasos.id}`)).body.stock, 1);
  });

  it('equipos: entregar, cambiar de persona, devolver y dar de baja, con historial', async () => {
    tablet = (
      await as('sup')('POST', `${inv}/assets`, {
        name: 'Tablet de caja',
        code: 'EQ-001',
        category: 'Tecnología',
        value: 900000,
        purchasedAt: '2026-01-15',
      })
    ).body;
    assert.equal((await as('sup')('POST', `${inv}/assets`, { name: 'Otra', code: 'EQ-001' })).status, 400, 'código repetido');
    assert.equal((await as('emp')('POST', `${inv}/assets`, { name: 'Mía' })).status, 403);
    const emp = await member('emp');
    const emp2 = await member('emp2');
    assert.equal((await as('sup')('POST', `${inv}/assets/${tablet.id}/assign`, { memberId: emp.id, note: 'Con cargador' })).status, 200);
    assert.ok(await prisma.notification.findFirst({ where: { memberId: emp.id, title: 'Quedó a tu cargo: Tablet de caja (EQ-001)' } }));
    assert.equal((await as('emp')('GET', `${inv}/summary`)).body.myAssets, 1);
    const mine = (await as('emp')('GET', `${inv}/assets`)).body;
    assert.equal(mine.manage, false);
    assert.deepEqual(
      mine.assets.map((a) => a.id),
      [tablet.id],
    );
    assert.equal((await as('emp2')('GET', `${inv}/assets/${tablet.id}`)).status, 404, 'otro empleado no lo ve');
    assert.equal((await as('emp')('GET', `${inv}/members/${emp2.id}/assets`)).status, 404);
    await as('sup')('POST', `${inv}/assets/${tablet.id}/assign`, { memberId: emp2.id });
    assert.equal((await as('emp')('GET', `${inv}/assets`)).body.assets.length, 0);
    await as('sup')('POST', `${inv}/assets/${tablet.id}/status`, { status: 'repair', note: 'Pantalla rota' });
    let a = (await as('sup')('GET', `${inv}/assets/${tablet.id}`)).body;
    assert.equal(a.status, 'repair');
    assert.equal(a.assignedTo, null);
    assert.equal(a.value, 900000);
    assert.deepEqual(
      a.events.map((e) => [e.kind, e.person]),
      [
        ['repair', null],
        ['returned', 'Prueba'],
        ['assigned', 'Prueba'],
        ['returned', 'Prueba'],
        ['assigned', 'Prueba'],
        ['created', null],
      ],
    );
    await as('sup')('POST', `${inv}/assets/${tablet.id}/status`, { status: 'retired' });
    assert.equal((await as('sup')('POST', `${inv}/assets/${tablet.id}/assign`, { memberId: emp.id })).status, 400, 'de baja no se entrega');
    assert.equal((await as('sup')('GET', `${inv}/assets`)).body.assets.length, 0, 'los dados de baja no salen en la lista normal');
    assert.equal((await as('sup')('GET', `${inv}/assets?status=retired`)).body.assets.length, 1);
    assert.equal((await as('sup')('GET', `${inv}/assets`)).body.counts.retired, 1);
  });
});
