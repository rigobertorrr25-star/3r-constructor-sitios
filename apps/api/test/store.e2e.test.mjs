// Pruebas de integración del tienda online de la plataforma empresarial.
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
  owner: `sto.owner.${stamp}@example.com`,
  emp: `sto.emp.${stamp}@example.com`,
  emp2: `sto.emp2.${stamp}@example.com`,
  sup: `sto.sup.${stamp}@example.com`,
  hr: `sto.hr.${stamp}@example.com`,
  staff: `sto.staff.${stamp}@example.com`,
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

describe('tienda online', () => {
  let st;
  let slug;
  let cafe;
  let torta;
  let ultimo;
  const member = async (k) => prisma.companyMember.findFirst({ where: { companyId: company.id, user: { email: emails[k] } } });
  const buyer = { name: 'Ana Cliente', phone: '300 123 4567' };

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
    company = (await as('owner')('POST', '/companies', { name: `Tienda ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['emp2', 'employee'],
      ['sup', 'supervisor'],
      ['hr', 'hr'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    st = `/companies/${company.id}/store`;
    slug = `tienda-${stamp}`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'sto.' } } });
    } finally {
      await app.close();
    }
  });

  it('ajustes: solo administradores; dirección válida y al menos una forma de entrega', async () => {
    assert.equal((await as('owner')('GET', `${st}/settings`)).status, 403);
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['store', 'alerts'] });
    const s0 = (await as('sup')('GET', `${st}/settings`)).body;
    assert.equal(s0.settings, null);
    assert.equal(s0.canEdit, false);
    assert.equal(s0.suggestedSlug, `tienda-${stamp}`);
    const settings = {
      slug,
      name: 'Café de prueba',
      whatsapp: '300 555 1234',
      pickupEnabled: true,
      deliveryEnabled: true,
      deliveryFee: 5000,
      freeFrom: 60000,
      paymentNote: 'Nequi 300 555 1234',
    };
    assert.equal((await as('sup')('PUT', `${st}/settings`, settings)).status, 403);
    assert.equal((await as('owner')('PUT', `${st}/settings`, { ...settings, slug: 'Con Espacios' })).status, 400);
    assert.equal((await as('owner')('PUT', `${st}/settings`, { ...settings, pickupEnabled: false, deliveryEnabled: false })).status, 400);
    assert.equal((await as('owner')('PUT', `${st}/settings`, settings)).status, 200);
    assert.equal((await as('emp')('GET', `${st}/products`)).status, 403, 'el empleado no maneja la tienda');
  });

  it('productos con opciones y existencias; el catálogo público solo muestra lo activo', async () => {
    cafe = (
      await as('sup')('POST', `${st}/products`, {
        name: 'Café de la casa',
        price: 6000,
        category: 'Bebidas',
        featured: true,
        trackStock: true,
        variants: [
          { name: 'Pequeño', stock: 10 },
          { name: 'Grande', price: 8500, stock: 2 },
        ],
      })
    ).body;
    torta = (await as('sup')('POST', `${st}/products`, { name: 'Torta de queso', price: 12000, compareAt: 15000, category: 'Postres' })).body;
    ultimo = (await as('sup')('POST', `${st}/products`, { name: 'Pan del día', price: 3000, trackStock: true, stock: 1 })).body;
    await as('sup')('POST', `${st}/products`, { name: 'Oculto', price: 1000, active: false });
    assert.equal((await as('sup')('POST', `${st}/products`, { name: 'Repetido', price: 1, variants: [{ name: 'A' }, { name: 'a' }] })).status, 400);
    const cat = (await pub('GET', slug)).body;
    assert.equal(cat.store.whatsapp, '573005551234');
    assert.equal(cat.store.deliveryFee, 5000);
    assert.deepEqual(
      cat.products.map((p) => p.name),
      ['Café de la casa', 'Torta de queso', 'Pan del día'],
      'destacados primero; sin categoría al final',
    );
    const c = cat.products[0];
    assert.deepEqual(
      c.variants.map((v) => [v.name, v.price, v.available]),
      [
        ['Pequeño', 6000, true],
        ['Grande', 8500, true],
      ],
    );
    assert.equal(cat.products[1].compareAt, 15000);
    assert.equal(c.stock, undefined, 'no se muestran las existencias');
    assert.equal((await pub('GET', 'no-existe')).status, 404);
  });

  it('carrito: precios de la tienda, cupones y domicilio gratis desde un valor', async () => {
    const full = await as('sup')('GET', `${st}/products/${cafe.id}`);
    const [peq, gde] = full.body.variants;
    await as('sup')('POST', `${st}/coupons`, { code: 'bienvenida', percent: 10, minOrder: 20000, maxUses: 1 });
    assert.equal((await as('sup')('POST', `${st}/coupons`, { code: 'BIENVENIDA', amount: 2000 })).status, 400, 'código repetido');
    assert.equal((await as('sup')('POST', `${st}/coupons`, { code: 'AMBOS', amount: 2000, percent: 5 })).status, 400);
    await as('sup')('POST', `${st}/coupons`, { code: 'VENCIDO', amount: 2000, expiresAt: '2020-01-01' });
    const items = [
      { productId: cafe.id, variantId: gde.id, qty: 2 },
      { productId: torta.id, qty: 1 },
    ];
    let q = (await pub('POST', `${slug}/quote`, { items, delivery: 'delivery' })).body;
    assert.deepEqual([q.subtotal, q.discount, q.shipping, q.total], [29000, 0, 5000, 34000]);
    q = (await pub('POST', `${slug}/quote`, { items, delivery: 'delivery', coupon: 'Bienvenida' })).body;
    assert.deepEqual([q.subtotal, q.discount, q.shipping, q.total], [29000, 2900, 5000, 31100]);
    assert.equal((await pub('POST', `${slug}/quote`, { items, delivery: 'pickup', coupon: 'VENCIDO' })).body.message, 'Ese cupón ya venció');
    assert.equal(
      (await pub('POST', `${slug}/quote`, { items: [{ productId: torta.id, qty: 1 }], delivery: 'pickup', coupon: 'BIENVENIDA' })).body.message,
      'Ese cupón aplica en compras desde $20.000',
    );
    assert.equal(
      (await pub('POST', `${slug}/quote`, { items: [{ productId: cafe.id, qty: 1 }], delivery: 'pickup' })).body.message,
      'Elige una opción de «Café de la casa»',
    );
    assert.equal(
      (await pub('POST', `${slug}/quote`, { items: [{ productId: cafe.id, variantId: gde.id, qty: 3 }], delivery: 'pickup' })).body.message,
      'De Café de la casa (Grande) solo quedan 2',
    );
    q = (await pub('POST', `${slug}/quote`, { items: [{ productId: torta.id, qty: 5 }], delivery: 'delivery' })).body;
    assert.equal(q.shipping, 0, 'desde $60.000 el domicilio es gratis');
    assert.equal(peq.stock, 10);
  });

  it('pedido: descuenta existencias y el cupón, avisa al equipo y el cliente lo ve con su enlace', async () => {
    const gde = (await as('sup')('GET', `${st}/products/${cafe.id}`)).body.variants[1];
    const items = [
      { productId: cafe.id, variantId: gde.id, qty: 2 },
      { productId: torta.id, qty: 1 },
    ];
    assert.equal(
      (await pub('POST', `${slug}/orders`, { ...buyer, items, delivery: 'delivery' })).body.message,
      'Escribe la dirección para el domicilio',
    );
    const res = await pub('POST', `${slug}/orders`, {
      ...buyer,
      items,
      delivery: 'delivery',
      address: 'Calle 10 # 5-20, Centro',
      coupon: 'BIENVENIDA',
      notes: 'Sin azúcar',
    });
    assert.equal(res.status, 201);
    const o = res.body;
    assert.equal(o.number, 1);
    assert.equal(o.total, 31100);
    assert.equal(o.items[0].unit, 8500);
    assert.equal(o.store.whatsapp, '573005551234');
    assert.equal(o.staffNote, undefined);
    assert.equal((await as('sup')('GET', `${st}/products/${cafe.id}`)).body.variants[1].stock, 0);
    assert.equal((await pub('GET', slug)).body.products[0].variants[1].available, false, 'agotado');
    assert.equal(
      (await pub('POST', `${slug}/orders`, { ...buyer, items: [{ productId: torta.id, qty: 2 }], delivery: 'pickup', coupon: 'BIENVENIDA' })).body
        .message,
      'Ese cupón ya se agotó',
    );
    const sup = await member('sup');
    const emp = await member('emp');
    assert.ok(await prisma.notification.findFirst({ where: { memberId: sup.id, title: 'Pedido nuevo #1: $31.100' } }));
    assert.equal(await prisma.notification.count({ where: { memberId: emp.id, kind: 'store' } }), 0);
    const view = (await pub('GET', `${slug}/orders/${o.publicToken}`)).body;
    assert.equal(view.status, 'new');
    assert.equal(view.address, 'Calle 10 # 5-20, Centro');
    assert.equal((await as('sup')('GET', `${st}/summary`)).body.newOrders, 1);
  });

  it('dos clientes por la última unidad: solo uno se la lleva', async () => {
    const tries = await Promise.all(
      [0, 1, 2].map(() => pub('POST', `${slug}/orders`, { ...buyer, items: [{ productId: ultimo.id, qty: 1 }], delivery: 'pickup' })),
    );
    assert.equal(tries.filter((t) => t.status === 201).length, 1);
    assert.equal((await as('sup')('GET', `${st}/products/${ultimo.id}`)).body.stock, 0);
    const numbers = (await as('sup')('GET', `${st}/orders?status=all`)).body.orders.map((x) => x.number).sort();
    assert.deepEqual(numbers, [1, 2], 'números seguidos, sin huecos por los que fallaron');
  });

  it('la empresa avanza el pedido; cancelar devuelve existencias y el cupón', async () => {
    const list = (await as('sup')('GET', `${st}/orders`)).body;
    const first = list.orders.find((x) => x.number === 1);
    assert.equal(list.counts.new, 2);
    await as('sup')('PATCH', `${st}/orders/${first.id}`, { status: 'preparing', paid: true, staffNote: 'Pagó por Nequi' });
    let o = (await as('sup')('GET', `${st}/orders/${first.id}`)).body;
    assert.deepEqual([o.status, o.paid, o.staffNote, o.slug], ['preparing', true, 'Pagó por Nequi', slug]);
    assert.equal((await pub('GET', `${slug}/orders/${first.publicToken}`)).body.staffNote, undefined, 'la nota interna no se ve');
    await as('sup')('PATCH', `${st}/orders/${first.id}`, { status: 'cancelled' });
    assert.equal((await as('sup')('GET', `${st}/products/${cafe.id}`)).body.variants[1].stock, 2);
    const coupons = (await as('sup')('GET', `${st}/coupons`)).body;
    assert.equal(coupons.find((c) => c.code === 'BIENVENIDA').used, 0);
    assert.equal((await as('sup')('PATCH', `${st}/orders/${first.id}`, { status: 'new' })).status, 400, 'cancelado no se reabre');
    o = (await as('sup')('GET', `${st}/orders?status=cancelled`)).body;
    assert.equal(o.orders.length, 1);
  });

  it('tienda cerrada: se ve el catálogo, pero no recibe pedidos', async () => {
    await as('owner')('PUT', `${st}/settings`, { slug, name: 'Café de prueba', pickupEnabled: true, deliveryEnabled: false, open: false });
    assert.equal((await pub('GET', slug)).status, 200);
    assert.equal((await pub('POST', `${slug}/orders`, { ...buyer, items: [{ productId: torta.id, qty: 1 }], delivery: 'pickup' })).status, 400);
    await as('owner')('PUT', `${st}/settings`, { slug, name: 'Café de prueba', pickupEnabled: true, deliveryEnabled: false });
    assert.equal(
      (await pub('POST', `${slug}/quote`, { items: [{ productId: torta.id, qty: 1 }], delivery: 'delivery' })).body.message,
      'Esta tienda no hace domicilios',
    );
  });
});
