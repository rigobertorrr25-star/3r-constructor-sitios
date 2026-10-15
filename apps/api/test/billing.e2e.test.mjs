// Pruebas de integración del suscripciones y facturas de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

process.loadEnvFile('.env');

// API de transacciones de Wompi falsa, como en payments.e2e.
const transactions = new Map();
const wompiApi = createServer((req, res) => {
  const id = decodeURIComponent((req.url ?? '').replace(/^\/v1\/transactions\//, ''));
  const tx = transactions.get(id);
  res.writeHead(tx ? 200 : 404, { 'content-type': 'application/json' });
  res.end(JSON.stringify(tx ? { data: tx } : { error: { type: 'NOT_FOUND_ERROR' } }));
});
await new Promise((resolve) => wompiApi.listen(0, '127.0.0.1', resolve));
const INTEGRITY = 'test_integrity_secreto';
const EVENTS = 'test_events_secreto';
process.env.WOMPI_PUBLIC_KEY = 'pub_test_llave';
process.env.WOMPI_INTEGRITY_SECRET = INTEGRITY;
process.env.WOMPI_EVENTS_SECRET = EVENTS;
process.env.WOMPI_API_URL = `http://127.0.0.1:${wompiApi.address().port}/v1`;
process.env.CRON_SECRET = 'clave-del-cron-de-prueba';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { BillingService, currentPeriod } = await import('../dist/billing/billing.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `bil.owner.${stamp}@example.com`,
  emp: `bil.emp.${stamp}@example.com`,
  emp2: `bil.emp2.${stamp}@example.com`,
  sup: `bil.sup.${stamp}@example.com`,
  out: `bil.out.${stamp}@example.com`,
  staff: `bil.staff.${stamp}@example.com`,
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

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const event = (transaction) => {
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const timestamp = Math.floor(Date.now() / 1000);
  const checksum = sha256(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${EVENTS}`);
  return { event: 'transaction.updated', data: { transaction }, signature: { properties, checksum }, timestamp };
};

describe('periodo de cobro', () => {
  it('va del día de cobro al día anterior del mes siguiente', () => {
    const d = (s) => new Date(`${s}T00:00:00Z`);
    const iso = (x) => x.toISOString().slice(0, 10);
    let p = currentPeriod(5, d('2026-10-03'));
    assert.deepEqual([iso(p.start), iso(p.end)], ['2026-09-05', '2026-10-04']);
    p = currentPeriod(5, d('2026-10-05'));
    assert.deepEqual([iso(p.start), iso(p.end)], ['2026-10-05', '2026-11-04']);
    p = currentPeriod(1, d('2027-01-01'));
    assert.deepEqual([iso(p.start), iso(p.end)], ['2027-01-01', '2027-01-31']);
  });
});

describe('suscripciones y facturas', () => {
  let saved;
  let invoice;

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    saved = await prisma.modulePrice.findMany();
    for (const [k, e] of Object.entries(emails)) tokens[k] = await signup(e);
    const staff = await prisma.user.findUnique({ where: { email: emails.staff } });
    await prisma.userRole.create({ data: { userId: staff.id, role: 'ADMIN' } });
    tokens.staff = (await call('POST', '/auth/login', { body: { email: emails.staff, password } })).body.accessToken;
    company = (await as('owner')('POST', '/companies', { name: `Plan ${stamp}` })).body;
    await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails.sup, role: 'supervisor' });
    await as('sup')('POST', '/company-invites/accept', { token: mailToken(emails.sup, 'Te invitaron a') });
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'bil.' } } });
      // Deja los precios como estaban.
      await prisma.modulePrice.deleteMany({});
      if (saved.length) await prisma.modulePrice.createMany({ data: saved.map(({ key, monthlyPrice }) => ({ key, monthlyPrice })) });
    } finally {
      await app.close();
      wompiApi.close();
    }
  });

  it('solo el equipo de 3R pone precios', async () => {
    assert.equal((await as('owner')('PUT', '/admin/billing/prices', { prices: { crm: 1 } })).status, 403);
    const res = await as('staff')('PUT', '/admin/billing/prices', { prices: { crm: 90000, tickets: 45000, alerts: 0, calendar: null } });
    assert.equal(res.status, 200);
    assert.equal(res.body.find((m) => m.key === 'crm').monthlyPrice, 90000);
    assert.equal(res.body.find((m) => m.key === 'calendar').monthlyPrice, null);
    assert.equal((await as('staff')('PUT', '/admin/billing/prices', { prices: { nada: 5 } })).status, 400);
    assert.equal((await as('staff')('PUT', '/admin/billing/prices', { prices: { crm: -1 } })).status, 400);
  });

  it('el plan suma los módulos activos con precio; los gratis no se cobran y los sin precio se avisan', async () => {
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['crm', 'tickets', 'alerts', 'calendar'] });
    const o = (await as('staff')('GET', `/admin/companies/${company.id}/billing`)).body;
    assert.equal(o.plan.total, 135000);
    assert.deepEqual(o.plan.items.map((i) => i.name).sort(), ['CRM', 'Tickets']);
    assert.deepEqual(o.plan.unpriced, ['Calendario']);
    assert.equal(o.subscription, null);
    assert.equal((await as('staff')('POST', `/admin/companies/${company.id}/invoices`)).status, 400, 'sin plan configurado');
  });

  it('el equipo configura el plan y genera la factura; le llega al dueño', async () => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()).slice(8);
    const res = await as('staff')('PUT', `/admin/companies/${company.id}/subscription`, { status: 'active', billingDay: Math.min(28, Number(day)), notes: 'Precio de lanzamiento' });
    assert.equal(res.status, 200);
    const gen = await as('staff')('POST', `/admin/companies/${company.id}/invoices`);
    assert.equal(gen.status, 201);
    invoice = gen.body;
    assert.match(invoice.code, /^FAC-\d+$/);
    assert.equal(invoice.total, 135000);
    assert.equal(invoice.status, 'pending');
    assert.equal((await as('staff')('POST', `/admin/companies/${company.id}/invoices`)).status, 400, 'una por periodo');
    const mail = sentEmails.find((m) => m.to === emails.owner && m.subject.startsWith(`Factura ${invoice.code}`));
    assert.ok(mail);
    assert.match(mail.text, /CRM: \$90\.000/);
    assert.ok(await prisma.notification.findFirst({ where: { companyId: company.id, title: { startsWith: `Factura ${invoice.code}` } } }));
  });

  it('la empresa ve su plan y facturas (solo dueño y administradores), sin las notas internas', async () => {
    const mine = await as('owner')('GET', `/companies/${company.id}/billing`);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.invoices[0].code, invoice.code);
    assert.equal(mine.body.subscription.notes, undefined);
    assert.equal(mine.body.onlinePayment, true);
    assert.equal((await as('sup')('GET', `/companies/${company.id}/billing`)).status, 403);
  });

  it('paga con Wompi: el aviso firmado deja la factura pagada una sola vez', async () => {
    const res = await as('owner')('POST', `/companies/${company.id}/billing/invoices/${invoice.id}/wompi`);
    assert.equal(res.status, 201);
    const q = new URL(res.body.url).searchParams;
    assert.equal(q.get('amount-in-cents'), String(135000 * 100));
    assert.equal(q.get('signature:integrity'), sha256(`${q.get('reference')}${135000 * 100}COP${INTEGRITY}`));
    assert.match(q.get('redirect-url'), new RegExp(`/empresa/${company.id}/facturacion`));
    const tx = { id: `tx-${stamp}`, status: 'APPROVED', reference: q.get('reference'), amount_in_cents: 135000 * 100, currency: 'COP' };
    transactions.set(tx.id, tx);
    assert.equal((await call('POST', '/payments/wompi/events', { body: event(tx) })).status, 200);
    assert.equal((await call('POST', '/payments/wompi/events', { body: event(tx) })).status, 200);
    const conf = await as('owner')('POST', `/companies/${company.id}/billing/invoices/${invoice.id}/wompi/confirm`, { transactionId: tx.id });
    assert.equal(conf.body.status, 'approved');
    const inv = await prisma.companyInvoice.findUnique({ where: { id: invoice.id } });
    assert.equal(inv.status, 'paid');
    assert.equal(inv.method, 'wompi');
    assert.equal((await as('owner')('POST', `/companies/${company.id}/billing/invoices/${invoice.id}/wompi`)).status, 404, 'ya pagada');
  });

  it('un pago por otro monto no deja pagada la factura', async () => {
    const other = await prisma.companyInvoice.create({
      data: { companyId: company.id, periodStart: new Date('2020-01-01'), periodEnd: new Date('2020-01-31'), items: [], total: 1000, dueDate: new Date('2020-01-10') },
    });
    const res = await as('owner')('POST', `/companies/${company.id}/billing/invoices/${other.id}/wompi`);
    const reference = new URL(res.body.url).searchParams.get('reference');
    await call('POST', '/payments/wompi/events', { body: event({ id: `tx2-${stamp}`, status: 'APPROVED', reference, amount_in_cents: 500, currency: 'COP' }) });
    assert.equal((await prisma.companyInvoice.findUnique({ where: { id: other.id } })).status, 'pending');
    await as('staff')('POST', `/admin/invoices/${other.id}/void`);
    assert.equal((await prisma.companyInvoice.findUnique({ where: { id: other.id } })).status, 'void');
  });

  it('la revisión diaria marca vencidas, avisa, y al pagar por transferencia vuelve a estar al día', async () => {
    const late = await prisma.companyInvoice.create({
      data: { companyId: company.id, periodStart: new Date('2021-01-01'), periodEnd: new Date('2021-01-31'), items: [], total: 135000, dueDate: new Date('2021-01-10') },
    });
    const billing = app.get(BillingService);
    const r = await billing.run();
    assert.ok(r.overdue >= 1);
    assert.equal((await prisma.companySubscription.findUnique({ where: { companyId: company.id } })).status, 'past_due');
    assert.ok(await prisma.notification.findFirst({ where: { companyId: company.id, title: { contains: 'está vencida' } } }));
    assert.equal((await as('owner')('POST', `/admin/invoices/${late.id}/paid`, { method: 'transfer' })).status, 403);
    const paid = await as('staff')('POST', `/admin/invoices/${late.id}/paid`, { method: 'transfer', note: 'Bancolombia 3 oct' });
    assert.equal(paid.body.status, 'paid');
    assert.equal((await prisma.companySubscription.findUnique({ where: { companyId: company.id } })).status, 'active');
  });

  it('el periodo de prueba terminado pasa a activo', async () => {
    await prisma.companySubscription.update({ where: { companyId: company.id }, data: { status: 'trial', trialEndsAt: new Date('2020-01-01') } });
    await app.get(BillingService).run();
    assert.equal((await prisma.companySubscription.findUnique({ where: { companyId: company.id } })).status, 'active');
  });
});
