// Cobrar con dólares (8 nov 2026). Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('cobro con dólares', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let waiters: typeof import('../lib/waiters');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, cashier: Actor;
  let dish: string, t1: string, t2: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const order = async (table: string) => {
    const s = await store.openTable(waiter, table, { guests: 1 });
    await orders.sendOrder(waiter, s, [{ productId: dish, quantity: 1 }], randomUUID());
    return s;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    waiters = await import('../lib/waiters');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Dolares`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: null, pin: '2468' });
    waiter = await login(a.slug, '0002', '1357');
    cashier = await login(a.slug, '0003', '2468');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    dish = await orders.saveProduct(owner, { categoryId: food, name: 'Pescado', price: 25000 });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('10 dólares a 3.000 pagan 25.000 y dan 5.000 de vueltas; la caja cuenta los dólares aparte', async () => {
    assert.equal((await cash.workMode(owner.businessId)).usdRate, 3000, 'por defecto 3.000');
    await cash.openShift(cashier, 100000);
    const s1 = await order(t1);
    await assert.rejects(cash.pay(cashier, s1, { method: 'transfer', amount: 25000, usdReceived: 10, clientKey: randomUUID() }), { code: 'INVALID' }, 'dólares solo en efectivo');
    await assert.rejects(cash.pay(cashier, s1, { method: 'cash', amount: 25000, usdReceived: 5, clientKey: randomUUID() }), { code: 'INVALID' }, '15.000 no alcanza');
    const p = await cash.pay(cashier, s1, { method: 'cash', amount: 25000, usdReceived: 10, clientKey: randomUUID() });
    assert.equal(p.change, 5000);
    assert.equal(p.closed, true);
    const sum = (await cash.shiftSummary(cashier, (await cash.getOpenShift(cashier))!.id))!;
    assert.deepEqual(sum.usd, { dollars: 10, pesos: 30000 });
    assert.equal(sum.byMethod.cash.amount, 25000, 'la venta sigue siendo 25.000');
    assert.equal(sum.expectedCash, 95000, 'pesos: 100.000 de base − 5.000 de vueltas');

    // Se cambia el valor del dólar en Sedes.
    await waiters.updateWorkMode(owner, { waitersCollect: false, barOnly: false, usdRate: 4000 });
    const s2 = await order(t2);
    const p2 = await cash.pay(cashier, s2, { method: 'cash', amount: 25000, usdReceived: 7, clientKey: randomUUID() });
    assert.equal(p2.change, 3000);
    await assert.rejects(waiters.updateWorkMode(owner, { waitersCollect: false, barOnly: false, usdRate: 5 }), { code: 'INVALID' });
  });
});
