// Pruebas de integración del automatizaciones de la plataforma empresarial.
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
  owner: `aut.owner.${stamp}@example.com`,
  emp: `aut.emp.${stamp}@example.com`,
  emp2: `aut.emp2.${stamp}@example.com`,
  sup: `aut.sup.${stamp}@example.com`,
  hr: `aut.hr.${stamp}@example.com`,
  staff: `aut.staff.${stamp}@example.com`,
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

const pub = (method, path, body) => call(method, `/public/store/${path}`, { body });

describe('automatizaciones', () => {
  let a;
  let slug;
  let torta;
  let big;
  const member = async (k) => prisma.companyMember.findFirst({ where: { companyId: company.id, user: { email: emails[k] } } });
  const order = (qty, phone = '300 123 4567') =>
    pub('POST', `${slug}/orders`, {
      name: 'Ana Cliente',
      phone,
      email: 'ana@example.com',
      items: [{ productId: torta.id, qty }],
      delivery: 'pickup',
    });
  const settle = () => new Promise((r) => setTimeout(r, 300));

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
    company = (await as('owner')('POST', '/companies', { name: `Automatizaciones ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['sup', 'supervisor'],
      ['hr', 'hr'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['store', 'alerts', 'crm', 'tickets', 'inventory', 'automations'] });
    slug = `aut-${stamp}`;
    await as('owner')('PUT', `/companies/${company.id}/store/settings`, {
      slug,
      name: 'Café de prueba',
      pickupEnabled: true,
      deliveryEnabled: false,
    });
    torta = (await as('owner')('POST', `/companies/${company.id}/store/products`, { name: 'Torta', price: 12000 })).body;
    a = `/companies/${company.id}/automations`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'aut.' } } });
    } finally {
      await app.close();
    }
  });

  it('solo administradores; valida acciones según el disparador', async () => {
    assert.equal((await as('hr')('GET', a)).status, 403);
    const cat = (await as('owner')('GET', a)).body;
    assert.ok(cat.triggers.some((t) => t.key === 'store_order' && t.vars.includes('total')));
    assert.equal(
      (await as('owner')('POST', a, { name: 'Raro', trigger: 'ticket_created', actions: [{ type: 'crm_contact' }] })).status,
      400,
      'un ticket no trae a un cliente',
    );
    assert.equal(
      (await as('owner')('POST', a, { name: 'Correo malo', trigger: 'store_order', actions: [{ type: 'email', to: 'no-es-correo', title: 'Hola' }] }))
        .status,
      400,
    );
    assert.equal((await as('owner')('POST', a, { name: 'Sin acciones', trigger: 'store_order', actions: [] })).status, 400);
  });

  it('pedido grande: avisa a supervisores, manda correo y guarda al cliente en el CRM (sin repetirlo)', async () => {
    big = (
      await as('owner')('POST', a, {
        name: 'Pedidos grandes',
        trigger: 'store_order',
        minAmount: 30000,
        actions: [
          { type: 'notify', to: 'supervisors', title: 'Pedido grande #{numero}: {total}' },
          { type: 'email', to: 'Jefe@Example.com', title: 'Pedido #{numero} de {cliente}', body: 'Lleva {productos}. Total {total}.' },
          { type: 'crm_contact' },
        ],
      })
    ).body;
    assert.equal(big.minAmount, 30000);
    assert.equal((await order(1)).status, 201, 'pedido pequeño');
    await settle();
    assert.equal(await prisma.automationRun.count({ where: { automationId: big.id } }), 0, 'por debajo del mínimo no corre');
    const o = (await order(3)).body;
    await settle();
    const sup = await member('sup');
    const emp = await member('emp');
    assert.ok(await prisma.notification.findFirst({ where: { memberId: sup.id, title: `Pedido grande #${o.number}: $36.000` } }));
    assert.equal(await prisma.notification.count({ where: { memberId: emp.id, kind: 'automation' } }), 0);
    const mail = [...sentEmails].reverse().find((m) => m.to === 'jefe@example.com');
    assert.ok(mail && mail.subject.startsWith(`Pedido #${o.number} de Ana Cliente`) && mail.text.includes('Lleva 3 × Torta. Total $36.000.'));
    let contacts = await prisma.crmContact.findMany({ where: { companyId: company.id } });
    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].source, 'web');
    await order(4);
    await settle();
    contacts = await prisma.crmContact.findMany({ where: { companyId: company.id }, include: { activities: true } });
    assert.equal(contacts.length, 1, 'el mismo cliente no se duplica');
    assert.equal(contacts[0].activities.length, 2);
    const runs = (await as('owner')('GET', a)).body.runs;
    assert.equal(runs.length, 2);
    assert.equal(runs[0].status, 'ok');
    assert.deepEqual(
      runs[0].results.map((r) => r.type),
      ['notify', 'email', 'crm_contact'],
    );
  });

  it('pausada no corre; poco inventario crea un ticket a cargo de alguien', async () => {
    await as('owner')('PATCH', `${a}/${big.id}?active=false`);
    await order(5);
    await settle();
    assert.equal(await prisma.automationRun.count({ where: { automationId: big.id } }), 2);
    const sup = await member('sup');
    await as('owner')('POST', a, {
      name: 'Reponer',
      trigger: 'low_stock',
      actions: [
        { type: 'ticket', title: 'Comprar {producto}', body: 'Quedan {cantidad}; mínimo {minimo}.', priority: 'high', assigneeMemberId: sup.id },
      ],
    });
    const item = (
      await as('sup')('POST', `/companies/${company.id}/inventory/items`, { name: 'Café en grano', unit: 'kg', minStock: 2, initialStock: 3 })
    ).body;
    await as('sup')('POST', `/companies/${company.id}/inventory/items/${item.id}/movements`, { type: 'out', quantity: 1.5 });
    await settle();
    const t = await prisma.ticket.findFirst({ where: { companyId: company.id, title: 'Comprar Café en grano' } });
    assert.ok(t);
    assert.equal(t.description, 'Quedan 1,5; mínimo 2.');
    assert.equal(t.assigneeMemberId, sup.id);
    assert.equal(t.priority, 'high');
  });
});
