// Módulo 04 (caja y pagos) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 04: caja y pagos', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, cashier: Actor;
  let burger: string, beer: string, t1: string, t2: string, t3: string;
  // Marca única por archivo (corren en paralelo): Date.now() solo puede repetirse entre dos archivos.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const order = async (table: string, lines: { productId: string; quantity: number }[]) => {
    const sessionId = await store.openTable(waiter, table, { guests: 2 });
    await orders.sendOrder(waiter, sessionId, lines, randomUUID());
    return sessionId;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Caja`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: null, pin: '2468' });
    waiter = await login(a.slug, '0002', '1357');
    cashier = await login(a.slug, '0003', '2468');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 30000 });
    beer = await orders.saveProduct(owner, { categoryId: food, name: 'Cerveza', price: 8000, station: 'bar' });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    t3 = await store.createTable(owner, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('sin caja abierta no se cobra; una sola caja por sede', async () => {
    const s = await order(t1, [{ productId: burger, quantity: 1 }]);
    await assert.rejects(cash.pay(cashier, s, { method: 'cash', amount: 30000, clientKey: randomUUID() }), { code: 'CONFLICT' });
    await assert.rejects(cash.openShift(waiter, 100000), { code: 'FORBIDDEN' });
    await cash.openShift(cashier, 100000);
    await assert.rejects(cash.openShift(owner, 50000), { code: 'CONFLICT' });
    assert.equal(cash.suggestedTipFor(84000, 10), 8400);
    assert.equal(cash.suggestedTipFor(33333, 10), 3300);
  });

  it('cuenta dividida: efectivo con vueltas + tarjeta; al quedar en cero la mesa se cierra', async () => {
    const s = await order(t2, [
      { productId: burger, quantity: 2 },
      { productId: beer, quantity: 3 },
    ]);
    let c = (await cash.getCheckout(cashier, s))!;
    assert.equal(c.subtotal, 84000);
    assert.equal(c.balance, 84000);

    await assert.rejects(cash.pay(cashier, s, { method: 'cash', amount: 90000, clientKey: randomUUID() }), { code: 'INVALID' }, 'no más que el saldo');
    await assert.rejects(cash.pay(cashier, s, { method: 'cash', amount: 42000, received: 40000, clientKey: randomUUID() }), { code: 'INVALID' });
    const key = randomUUID();
    const first = await cash.pay(cashier, s, { method: 'cash', amount: 42000, tip: 4200, received: 50000, clientKey: key });
    assert.equal(first.change, 50000 - 42000 - 4200);
    assert.equal(first.closed, false);
    const again = await cash.pay(cashier, s, { method: 'cash', amount: 42000, tip: 4200, received: 50000, clientKey: key });
    assert.equal(again.duplicate, true, 'el mismo pago no se cobra dos veces');
    c = (await cash.getCheckout(cashier, s))!;
    assert.equal(c.balance, 42000);

    const second = await cash.pay(cashier, s, { method: 'card', amount: 42000, tip: 4200, reference: 'Voucher 1234', clientKey: randomUUID() });
    assert.equal(second.closed, true);
    c = (await cash.getCheckout(cashier, s))!;
    assert.equal(c.session.status, 'closed');
    assert.equal(c.tips, 8400);
    assert.equal((await store.listTables(waiter)).find((t) => t.id === t2)!.status, 'free');
  });

  it('descuentos: el cajero hasta el límite; el administrador más', async () => {
    const s = await order(t3, [{ productId: burger, quantity: 2 }]);
    await assert.rejects(cash.applyDiscount(cashier, s, { percent: 15, reason: 'Cliente frecuente' }), { code: 'FORBIDDEN' });
    await cash.applyDiscount(cashier, s, { percent: 10, reason: 'Cliente frecuente' });
    await assert.rejects(cash.applyDiscount(cashier, s, { amount: 1000, reason: 'Otro' }), { code: 'FORBIDDEN' }, 'el límite es sobre el total de descuentos');
    await assert.rejects(cash.applyDiscount(cashier, s, { percent: 5, amount: 1000, reason: 'Los dos' }), { code: 'INVALID' });
    await cash.applyDiscount(owner, s, { amount: 4000, reason: 'Demora en la cocina' });
    let c = (await cash.getCheckout(cashier, s))!;
    assert.equal(c.discountTotal, 6000 + 4000);
    assert.equal(c.total, 50000);
    await cash.voidDiscount(cashier, c.discounts[1].id);
    c = (await cash.getCheckout(cashier, s))!;
    assert.equal(c.total, 54000);
    const audit = await store.listAudit(owner, { action: 'discount.apply' });
    assert.equal(audit.length, 2);
  });

  it('reversar un pago reabre la mesa; el cajero no puede', async () => {
    // La mesa 1 sigue abierta desde la primera prueba.
    const s1 = (await store.listTables(waiter)).find((t) => t.id === t1)!.session!.id;
    const p = await cash.pay(cashier, s1, { method: 'transfer', amount: 30000, reference: 'Nequi', clientKey: randomUUID() });
    assert.equal(p.closed, true);
    await assert.rejects(cash.reversePayment(cashier, p.paymentId, 'Error'), { code: 'FORBIDDEN' });
    await cash.reversePayment(owner, p.paymentId, 'La transferencia no llegó');
    const c = (await cash.getCheckout(cashier, s1))!;
    assert.equal(c.session.status, 'bill');
    assert.equal(c.balance, 30000);
    await cash.pay(cashier, s1, { method: 'cash', amount: 30000, clientKey: randomUUID() });
  });

  it('una mesa con saldo no se cierra a mano; con cortesía total sí', async () => {
    const s3 = (await store.listTables(waiter)).find((t) => t.id === t3)!.session!.id;
    await assert.rejects(store.closeTable(owner, s3, 'Se fueron'), { code: 'CONFLICT' });
    await cash.applyDiscount(owner, s3, { percent: 90, reason: 'Cortesía de la casa' });
    await store.closeTable(owner, s3, 'Cortesía total');
  });

  it('entradas y salidas, y el cierre de caja con su diferencia', async () => {
    await cash.addMovement(cashier, { kind: 'in', amount: 20000, reason: 'Cambio que trajo el dueño' });
    await cash.addMovement(cashier, { kind: 'out', amount: 15000, reason: 'Pago del hielo' });
    await assert.rejects(cash.addMovement(cashier, { kind: 'out', amount: 10_000_000, reason: 'Demasiado' }), { code: 'CONFLICT' });
    const shift = (await cash.getOpenShift(cashier))!;
    const summary = (await cash.shiftSummary(cashier, shift.id))!;
    // base 100.000 + efectivo (42.000 + 4.200 propina + 30.000) + 20.000 − 15.000
    assert.equal(summary.expectedCash, 100000 + 42000 + 4200 + 30000 + 20000 - 15000);
    assert.equal(summary.byMethod.card.amount, 42000);
    assert.equal(summary.byMethod.transfer.amount, 0, 'la transferencia reversada no cuenta');
    assert.equal(summary.reversed, 30000);
    const closed = await cash.closeShift(cashier, summary.expectedCash - 2000, 'Faltó un billete');
    assert.equal(closed.difference, -2000);
    assert.equal(await cash.getOpenShift(cashier), null);
    const audit = await store.listAudit(owner, { action: 'cash.close' });
    assert.match(audit[0].summary, /faltan \$2\.000/);
  });
});
