// Pruebas de integración del pago en línea (Wompi), del dominio propio del cliente y de su renovación anual.
// Requieren: npm run dev:db, npm run db:seed y npm run build -w api.
// Wompi no se llama de verdad: un servidor local hace de su API de transacciones.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');

// API de transacciones de Wompi falsa: devuelve lo que la prueba guarde en `transactions`.
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
process.env.WEB_ORIGIN = 'https://3rpaginas.test';
const CRON = 'clave-del-cron-de-prueba';
process.env.CRON_SECRET = CRON;
const publishDir = mkdtempSync(join(tmpdir(), '3r-pay-'));
process.env.PUBLISH_DIR = publishDir;
process.env.SITES_ROOT_HOST = 'localhost';
process.env.SITES_URL_TEMPLATE = 'http://{label}.localhost:3000';

const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = { a: `pay.a.${stamp}@example.com`, b: `pay.b.${stamp}@example.com`, admin: `pay.admin.${stamp}@example.com` };
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

let app;
let prisma;
let base;
const tokens = {};

const call = async (method, path, { body, token, headers } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
};

const tokenFromEmail = (to, subjectContains) => {
  const sent = [...sentEmails].reverse().find((m) => m.to === to && m.subject.includes(subjectContains));
  const match = sent && /token=([^\s&"]+)/.exec(sent.text);
  return match ? decodeURIComponent(match[1]) : null;
};

const signup = async (email) => {
  await call('POST', '/auth/register', { body: { email, password, firstName: 'Test', acceptPrivacy: true } });
  await call('POST', '/auth/verify-email', { body: { token: tokenFromEmail(email, 'confirma tu correo') } });
  return (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
};

const brief = { businessName: 'Café Pago', businessType: 'Restaurante', description: 'Un café para probar pagos en línea.' };

/** Un aviso de Wompi firmado como lo firma Wompi (o mal firmado, con `secret` distinto). */
const event = (transaction, secret = EVENTS) => {
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const timestamp = Math.floor(Date.now() / 1000);
  const checksum = sha256(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${secret}`);
  return { event: 'transaction.updated', data: { transaction }, environment: 'test', signature: { properties, checksum }, timestamp, sent_at: new Date().toISOString() };
};

describe('pago en línea con Wompi y dominio propio', () => {
  let pkg;

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const [key, email] of Object.entries(emails)) tokens[key] = await signup(email);
    const admin = await prisma.user.findUnique({ where: { email: emails.admin } });
    await prisma.userRole.create({ data: { userId: admin.id, role: 'ADMIN' } });
    tokens.admin = (await call('POST', '/auth/login', { body: { email: emails.admin, password } })).body.accessToken;
    pkg = (await call('GET', '/packages')).body.find((p) => p.slug === 'negocio');
  });

  after(async () => {
    try {
      const mine = { email: { startsWith: 'pay.' } };
      await prisma.order.deleteMany({ where: { user: mine } });
      await prisma.domain.deleteMany({ where: { site: { user: mine } } });
      await prisma.user.deleteMany({ where: mine });
    } finally {
      await app.close();
      wompiApi.close();
      rmSync(publishDir, { recursive: true, force: true });
    }
  });

  let order;

  it('los paquetes informan lo que cuesta el dominio propio', () => {
    assert.equal(pkg.domainAddonCents, 5_000_000);
  });

  it('con dominio propio, el pedido suma el primer año del dominio ($50.000)', async () => {
    const res = await call('POST', '/orders', { token: tokens.a, body: { packageSlug: 'negocio', customDomain: true, brief } });
    assert.equal(res.status, 201);
    order = res.body;
    assert.equal(order.priceCents, pkg.priceCents + 5_000_000);
    assert.equal(order.domainPriceCents, 5_000_000);

    const plain = await call('POST', '/orders', { token: tokens.b, body: { packageSlug: 'negocio', brief } });
    assert.equal(plain.body.priceCents, pkg.priceCents);
    assert.equal(plain.body.domainPriceCents, null);
  });

  it('el pedido dice si se puede pagar en línea', async () => {
    const res = await call('GET', `/orders/${order.id}`, { token: tokens.a });
    assert.equal(res.body.onlinePayment, true);
  });

  let checkout;

  it('el botón de pago va a Wompi, firmado, por lo que falta', async () => {
    const res = await call('POST', `/orders/${order.id}/payments/wompi`, { token: tokens.a });
    assert.equal(res.status, 201);
    checkout = res.body;
    const url = new URL(checkout.url);
    assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
    const q = url.searchParams;
    assert.equal(q.get('public-key'), 'pub_test_llave');
    assert.equal(q.get('currency'), 'COP');
    assert.equal(q.get('amount-in-cents'), String(order.priceCents));
    assert.match(q.get('reference'), /^3R-\d{4,}-[0-9a-f]{8}$/);
    assert.equal(q.get('signature:integrity'), sha256(`${q.get('reference')}${order.priceCents}COP${INTEGRITY}`));
    assert.equal(q.get('redirect-url'), `https://3rpaginas.test/dashboard/pedidos/${order.id}?pago=wompi`);
    assert.equal(q.get('customer-data:email'), emails.a);
    const stored = await prisma.payment.findUnique({ where: { reference: q.get('reference') } });
    assert.equal(stored.status, 'pending');
    assert.equal(stored.amountCents, order.priceCents);
  });

  it('nadie más puede pagar ni confirmar ese pedido', async () => {
    assert.equal((await call('POST', `/orders/${order.id}/payments/wompi`)).status, 401);
    assert.equal((await call('POST', `/orders/${order.id}/payments/wompi`, { token: tokens.b })).status, 404);
    assert.equal((await call('POST', `/orders/${order.id}/payments/wompi/confirm`, { token: tokens.b, body: { transactionId: 'x-1' } })).status, 404);
  });

  it('un aviso mal firmado no cambia nada', async () => {
    const tx = { id: 'tx-falso', status: 'APPROVED', reference: checkout.reference, amount_in_cents: checkout.amountCents, currency: 'COP' };
    const res = await call('POST', '/payments/wompi/events', { body: event(tx, 'otro-secreto') });
    assert.equal(res.status, 401);
    const current = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(current.amountPaidCents, 0);
    assert.equal(current.paymentStatus, 'unpaid');
  });

  it('un aviso aprobado marca el pedido como pagado, y repetirlo no suma dos veces', async () => {
    const tx = { id: 'tx-ok-1', status: 'APPROVED', reference: checkout.reference, amount_in_cents: checkout.amountCents, currency: 'COP' };
    assert.equal((await call('POST', '/payments/wompi/events', { body: event(tx) })).status, 200);
    assert.equal((await call('POST', '/payments/wompi/events', { body: event(tx) })).status, 200);

    const current = await prisma.order.findUnique({ where: { id: order.id }, include: { events: true } });
    assert.equal(current.amountPaidCents, order.priceCents);
    assert.equal(current.paymentStatus, 'paid');
    assert.equal(current.events.filter((e) => e.kind === 'payment').length, 1);
    const payment = await prisma.payment.findUnique({ where: { reference: checkout.reference } });
    assert.equal(payment.status, 'approved');
    assert.equal(payment.providerTransactionId, 'tx-ok-1');
    assert.ok(sentEmails.some((m) => m.to === emails.a && m.text.includes('Recibimos tu pago')));
  });

  it('un pedido ya pagado no abre otro pago', async () => {
    assert.equal((await call('POST', `/orders/${order.id}/payments/wompi`, { token: tokens.a })).status, 400);
  });

  it('al volver de Wompi se confirma la transacción: rechazada no suma, y un monto distinto no se acepta', async () => {
    const other = (await call('POST', '/orders', { token: tokens.a, body: { packageSlug: 'esencial', brief } })).body;
    const first = (await call('POST', `/orders/${other.id}/payments/wompi`, { token: tokens.a })).body;
    transactions.set('tx-rechazada', { id: 'tx-rechazada', status: 'DECLINED', reference: first.reference, amount_in_cents: first.amountCents, currency: 'COP' });
    const declined = await call('POST', `/orders/${other.id}/payments/wompi/confirm`, { token: tokens.a, body: { transactionId: 'tx-rechazada' } });
    assert.equal(declined.status, 200);
    assert.equal(declined.body.status, 'declined');

    const second = (await call('POST', `/orders/${other.id}/payments/wompi`, { token: tokens.a })).body;
    transactions.set('tx-otro-monto', { id: 'tx-otro-monto', status: 'APPROVED', reference: second.reference, amount_in_cents: 100, currency: 'COP' });
    const wrong = await call('POST', `/orders/${other.id}/payments/wompi/confirm`, { token: tokens.a, body: { transactionId: 'tx-otro-monto' } });
    assert.equal(wrong.body.status, 'error');

    const current = await prisma.order.findUnique({ where: { id: other.id } });
    assert.equal(current.amountPaidCents, 0);
    assert.equal(current.paymentStatus, 'unpaid');

    // Una transacción de otro pedido no se puede usar para confirmar este.
    transactions.set('tx-ajena', { id: 'tx-ajena', status: 'APPROVED', reference: checkout.reference, amount_in_cents: checkout.amountCents, currency: 'COP' });
    assert.equal((await call('POST', `/orders/${other.id}/payments/wompi/confirm`, { token: tokens.a, body: { transactionId: 'tx-ajena' } })).status, 404);
    assert.equal((await call('POST', `/orders/${other.id}/payments/wompi/confirm`, { token: tokens.a, body: { transactionId: 'no-existe' } })).status, 404);
  });

  describe('dominio propio del sitio', () => {
    let site;
    const admin = (method, path, body) => call(method, path, { token: tokens.admin, body });

    before(async () => {
      site = (await admin('POST', '/sites', { name: 'Tienda Dominio Propio', templateSlug: 'restaurant-caribbean' })).body;
      await admin('POST', `/sites/${site.id}/publish`);
    });

    it('se asigna limpio (sin https ni www) y queda en el estado del sitio', async () => {
      const res = await admin('PUT', `/sites/${site.id}/domain`, { domain: 'https://www.Tienda-Propia.com/menu' });
      assert.equal(res.status, 200);
      assert.equal(res.body.customDomain, 'tienda-propia.com');
      assert.equal(res.body.customUrl, 'https://tienda-propia.com');
    });

    it('la web averigua qué sitio va en ese dominio (con o sin www)', async () => {
      const label = (await admin('GET', `/sites/${site.id}/publication`)).body.url.replace(/^http:\/\//, '').split('.')[0];
      for (const host of ['tienda-propia.com', 'www.tienda-propia.com']) {
        const res = await call('GET', `/public/domains/${host}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.label, label);
      }
      assert.equal((await call('GET', '/public/domains/no-existe.com')).status, 404);
    });

    it('rechaza dominios inválidos, de 3R o ya usados', async () => {
      assert.equal((await admin('PUT', `/sites/${site.id}/domain`, { domain: 'no es un dominio' })).status, 400);
      assert.equal((await admin('PUT', `/sites/${site.id}/domain`, { domain: 'algo.localhost' })).status, 400);
      const other = (await admin('POST', '/sites', { name: 'Otra Tienda', templateSlug: 'restaurant-caribbean' })).body;
      assert.equal((await admin('PUT', `/sites/${other.id}/domain`, { domain: 'tienda-propia.com' })).status, 409);
      assert.equal((await call('PUT', `/sites/${site.id}/domain`, { token: tokens.b, body: { domain: 'x.com' } })).status, 404);
    });

    it('un sitio despublicado no se sirve en su dominio, y con texto vacío se quita', async () => {
      await admin('POST', `/sites/${site.id}/unpublish`);
      assert.equal((await call('GET', '/public/domains/tienda-propia.com')).status, 404);
      await admin('POST', `/sites/${site.id}/publish`);
      const removed = await admin('PUT', `/sites/${site.id}/domain`, { domain: '' });
      assert.equal(removed.body.customDomain, null);
      assert.equal((await call('GET', '/public/domains/tienda-propia.com')).status, 404);
    });
  });

  describe('renovación anual del dominio propio', () => {
    const admin = (method, path, body) => call(method, path, { token: tokens.admin, body });
    const cron = (secret = CRON) => call('POST', '/internal/domain-renewals/run', { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
    const DAY = 86_400_000;
    let site;
    const stored = () => prisma.domain.findUnique({ where: { domain: 'renueva-ya.com' } });
    const notices = async () =>
      (await prisma.orderEvent.findMany({ where: { orderId: order.id, kind: 'message' } })).filter((e) => e.body?.includes('renueva-ya.com'));

    before(async () => {
      // El sitio del pedido con dominio propio (el del cliente A), como lo crea el equipo.
      site = (await admin('POST', '/sites', { name: 'Tienda Renueva', templateSlug: 'restaurant-caribbean' })).body;
      await prisma.order.update({ where: { id: order.id }, data: { siteId: site.id } });
    });

    it('al asignar el dominio, queda pagado por un año', async () => {
      const res = await admin('PUT', `/sites/${site.id}/domain`, { domain: 'renueva-ya.com' });
      assert.equal(res.status, 200);
      const days = (new Date(res.body.customDomainExpiresAt).getTime() - Date.now()) / DAY;
      assert.ok(days > 364 && days < 367, `vence en ${days} días`);
    });

    it('la revisión diaria exige la clave del cron', async () => {
      assert.equal((await cron(null)).status, 401);
      assert.equal((await cron('otra-clave')).status, 401);
      assert.equal((await cron()).status, 200);
      assert.equal((await notices()).length, 0, 'a un año de vencer no se avisa');
    });

    it('un mes antes se le avisa al cliente una sola vez (correo y mensaje en su pedido)', async () => {
      const soon = new Date(Date.now() + 20 * DAY).toISOString().slice(0, 10);
      const res = await admin('PUT', `/sites/${site.id}/domain/expiry`, { expiresOn: soon });
      assert.equal(res.status, 200);
      assert.equal(res.body.customDomainExpiresAt.slice(0, 10), soon);

      assert.ok((await cron()).body.sent >= 1);
      assert.equal((await notices()).length, 1);
      const mail = [...sentEmails].reverse().find((m) => m.to === emails.a && m.subject.includes('renueva-ya.com'));
      assert.ok(mail, 'le llega el correo al cliente');
      assert.match(mail.subject, /vence pronto/);
      assert.match(mail.text, /\$\s?50\.000/);
      assert.ok(mail.text.includes(`/dashboard/pedidos/${order.id}`));

      await cron();
      assert.equal((await notices()).length, 1, 'no se repite');
    });

    it('solo el dueño del sitio cambia la fecha o renueva, y las fechas se validan', async () => {
      assert.equal((await call('POST', `/sites/${site.id}/domain/renew`, { token: tokens.b })).status, 404);
      assert.equal((await call('PUT', `/sites/${site.id}/domain/expiry`, { token: tokens.b, body: { expiresOn: '2030-01-01' } })).status, 404);
      assert.equal((await admin('PUT', `/sites/${site.id}/domain/expiry`, { expiresOn: '2027-02-30' })).status, 400);
      assert.equal((await admin('PUT', `/sites/${site.id}/domain/expiry`, { expiresOn: 'mañana' })).status, 400);
      const bare = (await admin('POST', '/sites', { name: 'Sin Dominio', templateSlug: 'restaurant-caribbean' })).body;
      assert.equal((await admin('POST', `/sites/${bare.id}/domain/renew`)).status, 400);
    });

    it('renovar suma un año al vencimiento y deja listo el aviso del año siguiente', async () => {
      const before = (await stored()).expiresAt;
      const res = await admin('POST', `/sites/${site.id}/domain/renew`);
      assert.equal(res.status, 200);
      const after = await stored();
      const next = new Date(before);
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      assert.equal(after.expiresAt.toISOString(), next.toISOString());
      assert.equal(after.renewalNoticeSentAt, null);
      await cron();
      assert.equal((await notices()).length, 1, 'renovado, no se avisa');
    });

    it('un dominio que ya venció sin aviso también se avisa', async () => {
      const past = new Date(Date.now() - 3 * DAY).toISOString().slice(0, 10);
      await admin('PUT', `/sites/${site.id}/domain/expiry`, { expiresOn: past });
      await cron();
      assert.equal((await notices()).length, 2);
      const mail = [...sentEmails].reverse().find((m) => m.to === emails.a && m.subject.includes('renueva-ya.com'));
      assert.match(mail.subject, /venció/);

      // Renovar un dominio vencido cuenta el año desde hoy, no desde la fecha vieja.
      await admin('POST', `/sites/${site.id}/domain/renew`);
      const days = ((await stored()).expiresAt.getTime() - Date.now()) / DAY;
      assert.ok(days > 364 && days < 367, `vence en ${days} días`);
    });
  });
});
