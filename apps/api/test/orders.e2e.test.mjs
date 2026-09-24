// Pruebas de integración de la tienda de páginas: paquetes, pedidos, seguimiento y administración.
// Requieren: npm run dev:db, npm run db:seed y npm run build -w api.
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
  a: `orders.a.${stamp}@example.com`,
  b: `orders.b.${stamp}@example.com`,
  admin: `orders.admin.${stamp}@example.com`,
};

let app;
let prisma;
let base;
const tokens = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
};

/** Extrae el token de un enlace ?token=... en el correo de prueba (LoggingMailSender). */
const tokenFromEmail = (to, subjectContains) => {
  const sent = [...sentEmails].reverse().find((m) => m.to === to && m.subject.includes(subjectContains));
  const match = sent && /token=([^\s&"]+)/.exec(sent.text);
  return match ? decodeURIComponent(match[1]) : null;
};

const signup = async (email) => {
  await call('POST', '/auth/register', { body: { email, password, firstName: 'Test' } });
  // Pedir una página exige el correo verificado: se verifica con el enlace que "llegó" (modo prueba).
  const token = tokenFromEmail(email, 'confirma tu correo');
  if (!token) throw new Error(`no se encontró el correo de verificación para ${email}`);
  const verified = await call('POST', '/auth/verify-email', { body: { token } });
  if (verified.status !== 200) throw new Error(`no se pudo verificar ${email}: ${verified.raw}`);
  return (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
};

const brief = (name = 'Café Azul') => ({
  businessName: name,
  businessType: 'Restaurante',
  description: 'Un café pequeño con comida casera y buen ambiente.',
  phone: '+1 555 0100',
});

describe('paquetes y pedidos', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);

    tokens.a = await signup(emails.a);
    tokens.b = await signup(emails.b);
    await signup(emails.admin);
    const admin = await prisma.user.findUnique({ where: { email: emails.admin } });
    await prisma.userRole.create({ data: { userId: admin.id, role: 'ADMIN' } });
    // Se vuelve a iniciar sesión para que el token lleve el rol.
    tokens.admin = (await call('POST', '/auth/login', { body: { email: emails.admin, password } })).body.accessToken;
  });

  after(async () => {
    try {
      const owned = { user: { email: { startsWith: 'orders.' } } };
      await prisma.order.deleteMany({ where: owned });
      await prisma.package.deleteMany({ where: { slug: { startsWith: 'test-' } } });
      await prisma.package.updateMany({ where: { slug: 'esencial' }, data: { priceCents: 19900, isActive: true } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'orders.' } } });
    } finally {
      await app.close();
    }
  });

  let orderA;

  it('el catálogo es público y solo trae paquetes activos', async () => {
    const res = await call('GET', '/packages');
    assert.equal(res.status, 200);
    const slugs = res.body.map((p) => p.slug);
    assert.deepEqual(slugs.slice(0, 3), ['esencial', 'negocio', 'completa']);
    assert.ok(Array.isArray(res.body[0].features) && res.body[0].features.length > 0);
    assert.ok(!('isActive' in res.body[0]));
  });

  it('pedir exige iniciar sesión', async () => {
    assert.equal((await call('POST', '/orders', { body: { packageSlug: 'esencial', brief: brief() } })).status, 401);
    assert.equal((await call('GET', '/orders')).status, 401);
  });

  it('valida el pedido (400)', async () => {
    const send = (body) => call('POST', '/orders', { token: tokens.a, body });
    assert.equal((await send({ packageSlug: 'esencial' })).status, 400, 'sin datos del negocio');
    assert.equal((await send({ packageSlug: 'esencial', brief: { ...brief(), description: 'corto' } })).status, 400);
    assert.equal((await send({ packageSlug: 'no-existe', brief: brief() })).status, 400);
    assert.equal((await send({ packageSlug: 'esencial', brief: brief(), priceCents: 1 })).status, 400, 'no se puede mandar el precio');
    assert.equal((await send({ packageSlug: 'esencial', brief: { ...brief(), rol: 'ADMIN' } })).status, 400);
  });

  it('crea un pedido con el precio del paquete y la mensualidad solo si la pide', async () => {
    const pkg = await prisma.package.findUnique({ where: { slug: 'negocio' } });
    const withMonthly = await call('POST', '/orders', { token: tokens.a, body: { packageSlug: 'negocio', maintenance: true, brief: brief() } });
    assert.equal(withMonthly.status, 201);
    assert.equal(withMonthly.body.status, 'new');
    assert.equal(withMonthly.body.paymentStatus, 'unpaid');
    assert.equal(withMonthly.body.priceCents, pkg.priceCents);
    assert.equal(withMonthly.body.monthlyPriceCents, pkg.monthlyPriceCents);
    assert.ok(withMonthly.body.orderNumber > 0);
    orderA = withMonthly.body;

    const without = await call('POST', '/orders', { token: tokens.a, body: { packageSlug: 'esencial', brief: brief('Otro') } });
    assert.equal(without.body.monthlyPriceCents, null);
  });

  it('el cliente ve sus pedidos con historial y sin datos internos; otro cliente no ve nada', async () => {
    const mine = await call('GET', '/orders', { token: tokens.a });
    assert.equal(mine.body.length, 2);
    assert.deepEqual((await call('GET', '/orders', { token: tokens.b })).body, []);

    const detail = await call('GET', `/orders/${orderA.id}`, { token: tokens.a });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.brief.businessName, 'Café Azul');
    assert.equal(detail.body.events[0].body, 'Pedido recibido');
    assert.ok(!detail.raw.includes('actorId'), 'no se filtra quién escribió cada evento');

    assert.equal((await call('GET', `/orders/${orderA.id}`, { token: tokens.b })).status, 404);
    assert.equal((await call('POST', `/orders/${orderA.id}/messages`, { token: tokens.b, body: { body: 'hola' } })).status, 404);
    assert.equal((await call('POST', `/orders/${orderA.id}/cancel`, { token: tokens.b })).status, 404);
  });

  it('el cliente manda un mensaje y aparece en su historial', async () => {
    const res = await call('POST', `/orders/${orderA.id}/messages`, { token: tokens.a, body: { body: 'Quisiera el logo en azul' } });
    assert.equal(res.status, 201);
    const detail = (await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body;
    const last = detail.events.at(-1);
    assert.equal(last.body, 'Quisiera el logo en azul');
    assert.equal(last.fromTeam, false);
    assert.equal((await call('POST', `/orders/${orderA.id}/messages`, { token: tokens.a, body: { body: '' } })).status, 400);
  });

  it('un cliente no entra a la administración (403) y sin token da 401', async () => {
    for (const path of ['/admin/orders', '/admin/stats', '/admin/packages']) {
      assert.equal((await call('GET', path)).status, 401, path);
      assert.equal((await call('GET', path, { token: tokens.a })).status, 403, path);
    }
    assert.equal((await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.a, body: { status: 'delivered' } })).status, 403);
    assert.equal((await call('POST', '/admin/packages', { token: tokens.a, body: {} })).status, 403);
  });

  it('el administrador lista, filtra y busca pedidos', async () => {
    const all = await call('GET', '/admin/orders', { token: tokens.admin });
    assert.equal(all.status, 200);
    assert.ok(all.body.some((o) => o.id === orderA.id));
    assert.ok(all.body.find((o) => o.id === orderA.id).user.email === emails.a);

    const byStatus = await call('GET', '/admin/orders?status=delivered', { token: tokens.admin });
    assert.ok(!byStatus.body.some((o) => o.id === orderA.id));

    const byEmail = await call('GET', `/admin/orders?q=${encodeURIComponent(emails.a)}`, { token: tokens.admin });
    assert.ok(byEmail.body.some((o) => o.id === orderA.id));
    const byName = await call('GET', '/admin/orders?q=caf%C3%A9%20azul', { token: tokens.admin });
    assert.ok(byName.body.some((o) => o.id === orderA.id));
    const byNumber = await call('GET', `/admin/orders?q=3R-${orderA.orderNumber}`, { token: tokens.admin });
    assert.ok(byNumber.body.some((o) => o.id === orderA.id));
  });

  it('cambiar el estado deja un evento que el cliente ve como del equipo', async () => {
    const res = await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { status: 'awaiting_payment' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'awaiting_payment');
    const detail = (await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body;
    const last = detail.events.at(-1);
    assert.equal(last.kind, 'status');
    assert.equal(last.body, 'Esperando pago');
    assert.equal(last.fromTeam, true);
  });

  it('el pago se deduce del monto recibido y queda registrado', async () => {
    const half = Math.floor(orderA.priceCents / 2);
    let res = await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { amountPaidCents: half } });
    assert.equal(res.body.paymentStatus, 'partial');
    assert.equal(res.body.amountPaidCents, half);

    res = await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { amountPaidCents: orderA.priceCents } });
    assert.equal(res.body.paymentStatus, 'paid');
    const events = (await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body.events;
    assert.ok(events.filter((e) => e.kind === 'payment').length >= 2);

    assert.equal((await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { amountPaidCents: -5 } })).status, 400);
    assert.equal((await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { status: 'inventado' } })).status, 400);
  });

  it('las notas internas no las ve el cliente; los mensajes sí', async () => {
    await call('POST', `/admin/orders/${orderA.id}/events`, { token: tokens.admin, body: { body: 'SECRETO-INTERNO', internal: true } });
    await call('POST', `/admin/orders/${orderA.id}/events`, { token: tokens.admin, body: { body: 'Hola, ya empezamos', internal: false } });

    const client = await call('GET', `/orders/${orderA.id}`, { token: tokens.a });
    assert.ok(!client.raw.includes('SECRETO-INTERNO'));
    assert.ok(client.raw.includes('Hola, ya empezamos'));

    const admin = await call('GET', `/admin/orders/${orderA.id}`, { token: tokens.admin });
    assert.ok(admin.raw.includes('SECRETO-INTERNO'));
  });

  it('no se puede entregar sin enlace; con enlace queda entregado', async () => {
    const blocked = await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { status: 'delivered' } });
    assert.equal(blocked.status, 400);

    assert.equal((await call('PATCH', `/admin/orders/${orderA.id}`, { token: tokens.admin, body: { deliveryUrl: 'javascript:alert(1)' } })).status, 400);

    const done = await call('PATCH', `/admin/orders/${orderA.id}`, {
      token: tokens.admin,
      body: { status: 'delivered', deliveryUrl: 'https://cafeazul.example.com' },
    });
    assert.equal(done.status, 200);
    assert.equal(done.body.status, 'delivered');
    assert.ok(done.body.deliveredAt);
    const client = (await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body;
    assert.equal(client.deliveryUrl, 'https://cafeazul.example.com');
  });

  it('el cliente solo puede cancelar mientras nadie empezó a trabajar', async () => {
    assert.equal((await call('POST', `/orders/${orderA.id}/cancel`, { token: tokens.a })).status, 409);

    const fresh = await call('POST', '/orders', { token: tokens.b, body: { packageSlug: 'esencial', brief: brief('Panadería') } });
    const cancelled = await call('POST', `/orders/${fresh.body.id}/cancel`, { token: tokens.b });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal((await call('POST', `/orders/${fresh.body.id}/messages`, { token: tokens.b, body: { body: 'hola' } })).status, 409);
  });

  it('el equipo crea el sitio del pedido en su cuenta, sin límite de plan, y no se repite', async () => {
    const second = await call('POST', '/orders', { token: tokens.a, body: { packageSlug: 'completa', brief: brief('Gimnasio Sol') } });
    const first = await call('POST', `/admin/orders/${second.body.id}/site`, { token: tokens.admin, body: { templateSlug: 'portfolio' } });
    assert.equal(first.status, 201);
    assert.equal(first.body.name, 'Gimnasio Sol');

    // El equipo tiene más de un sitio aunque el plan gratis solo permite uno.
    const other = await call('POST', `/admin/orders/${orderA.id}/site`, { token: tokens.admin, body: {} });
    assert.equal(other.status, 201);

    assert.equal((await call('POST', `/admin/orders/${second.body.id}/site`, { token: tokens.admin, body: {} })).status, 409);
    const detail = await call('GET', `/admin/orders/${second.body.id}`, { token: tokens.admin });
    assert.equal(detail.body.site.name, 'Gimnasio Sol');
    // El cliente nunca ve el sitio interno.
    assert.ok(!(await call('GET', `/orders/${second.body.id}`, { token: tokens.a })).raw.includes(first.body.id));

    // Un mensaje que le escriben a la página publicada (formulario de contacto) le llega al
    // cliente dueño del pedido, en su propia cuenta — sin depender solo del correo.
    await prisma.formSubmission.create({
      data: { siteId: first.body.id, name: 'Visitante', email: 'visitante@example.com', message: 'Hola, ¿tienen cupo mañana?' },
    });
    const withMessage = await call('GET', `/orders/${second.body.id}`, { token: tokens.a });
    assert.equal(withMessage.body.formSubmissions.length, 1);
    assert.equal(withMessage.body.formSubmissions[0].message, 'Hola, ¿tienen cupo mañana?');
    assert.equal(withMessage.body.formSubmissions[0].status, 'new', 'un mensaje nuevo arranca en "new"');
    // Otro cliente no ve los mensajes de un sitio que no es suyo.
    assert.deepEqual((await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body.formSubmissions, []);

    // El cliente mueve su mensaje por el embudo.
    const leadId = withMessage.body.formSubmissions[0].id;
    const moved = await call('PATCH', `/orders/${second.body.id}/leads/${leadId}`, { token: tokens.a, body: { status: 'contacted' } });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.status, 'contacted');
    const refreshed = await call('GET', `/orders/${second.body.id}`, { token: tokens.a });
    assert.equal(refreshed.body.formSubmissions[0].status, 'contacted');

    assert.equal((await call('PATCH', `/orders/${second.body.id}/leads/${leadId}`, { token: tokens.a, body: { status: 'inventado' } })).status, 400);
    // Otro cliente no puede mover un mensaje que no es de su pedido.
    assert.equal((await call('PATCH', `/orders/${second.body.id}/leads/${leadId}`, { token: tokens.b, body: { status: 'won' } })).status, 404);
  });

  it('cambiar el precio del paquete no altera pedidos existentes', async () => {
    const before = (await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body.priceCents;
    const pkg = await prisma.package.findUnique({ where: { slug: 'esencial' } });
    const res = await call('PATCH', `/admin/packages/${pkg.id}`, { token: tokens.admin, body: { priceCents: 12345 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.priceCents, 12345);

    assert.equal((await call('GET', `/orders/${orderA.id}`, { token: tokens.a })).body.priceCents, before);
    const bNew = await call('POST', '/orders', { token: tokens.b, body: { packageSlug: 'esencial', brief: brief('Nuevo') } });
    assert.equal(bNew.body.priceCents, 12345, 'los pedidos nuevos usan el precio nuevo');
  });

  it('administrar paquetes: crear, validar, ocultar', async () => {
    const create = (body) => call('POST', '/admin/packages', { token: tokens.admin, body });
    const ok = await create({ name: 'Prueba', slug: `test-${stamp}`, priceCents: 10000, monthlyPriceCents: null, features: ['Uno', 'Dos'] });
    assert.equal(ok.status, 201);
    assert.equal((await create({ name: 'Otra', slug: `test-${stamp}`, priceCents: 1 })).status, 409, 'slug repetido');
    assert.equal((await create({ name: 'X', slug: 'Mal Slug', priceCents: 1 })).status, 400);
    assert.equal((await create({ name: 'Ok', slug: `test-b-${stamp}`, priceCents: -1 })).status, 400);
    assert.equal((await create({ name: 'Ok', slug: `test-c-${stamp}`, priceCents: 1, currency: 'dolares' })).status, 400);

    assert.ok((await call('GET', '/packages')).body.some((p) => p.slug === `test-${stamp}`));
    await call('PATCH', `/admin/packages/${ok.body.id}`, { token: tokens.admin, body: { isActive: false } });
    assert.ok(!(await call('GET', '/packages')).body.some((p) => p.slug === `test-${stamp}`), 'un paquete oculto no se ve');
    assert.equal((await call('POST', '/orders', { token: tokens.a, body: { packageSlug: `test-${stamp}`, brief: brief() } })).status, 400, 'ni se puede pedir');
  });

  it('limita los pedidos en curso por cliente', async () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push((await call('POST', '/orders', { token: tokens.b, body: { packageSlug: 'negocio', brief: brief(`Lote ${i}`) } })).status);
    }
    assert.ok(results.includes(409), `esperaba un 409 entre ${results.join(',')}`);
  });

  it('las estadísticas cuentan pedidos y dinero cobrado', async () => {
    const stats = await call('GET', '/admin/stats', { token: tokens.admin });
    assert.equal(stats.status, 200);
    assert.ok(stats.body.counts.delivered >= 1);
    assert.ok(stats.body.counts.cancelled >= 1);
    assert.ok(stats.body.collectedCents >= orderA.priceCents);
  });
});
