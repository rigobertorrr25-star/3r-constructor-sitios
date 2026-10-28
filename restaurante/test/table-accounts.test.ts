// Mesas del día: por cobrar, cobradas y quién las atendió, contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('mesas del día', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let accounts: typeof import('../lib/table-accounts');
  let finance: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let ana: Actor, beto: Actor, cashier: Actor;
  let burger: string, t1: string, t2: string, t3: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const tz = 'America/Bogota';

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    accounts = await import('../lib/table-accounts');
    finance = await import('../lib/finance');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Mesas`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Ana', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Beto', role: 'waiter', locationId: null, pin: '3579' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: null, pin: '2468' });
    ana = await login(a.slug, '0002', '1357');
    beto = await login(a.slug, '0003', '3579');
    cashier = await login(a.slug, '0004', '2468');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 30000 });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    t3 = await store.createTable(owner, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('por cobrar con todos los que atendieron, cobradas con quién cobró y cómo, y el resumen por mesero', async () => {
    // Mesa 1: la abre Ana y Beto le manda otra ronda. Queda por cobrar.
    const s1 = await store.openTable(ana, t1, { guests: 2 });
    await orders.sendOrder(ana, s1, [{ productId: burger, quantity: 1 }], randomUUID());
    await orders.sendOrder(beto, s1, [{ productId: burger, quantity: 1 }], randomUUID());
    // Mesa 2: la abre Beto y la cajera la cobra en efectivo y datáfono.
    const s2 = await store.openTable(beto, t2, { guests: 2 });
    await orders.sendOrder(beto, s2, [{ productId: burger, quantity: 1 }], randomUUID());
    await cash.openShift(cashier, 50000);
    await cash.pay(cashier, s2, { method: 'cash', amount: 10000, received: 10000, clientKey: randomUUID() });
    await cash.pay(cashier, s2, { method: 'card', amount: 20000, tip: 3000, clientKey: randomUUID() });
    // Mesa 3: abierta sin pedidos, no cuenta.
    await store.openTable(ana, t3, { guests: 1 });

    const today = finance.todayIn(tz);
    const r = await accounts.tableAccounts(cashier, today, tz);
    assert.deepEqual(r.pending.map((a) => a.tableNumber), ['1']);
    assert.deepEqual(r.pending[0].waiters.map((w) => w.name), ['Ana', 'Beto'], 'quien abrió primero y luego quien mandó pedidos');
    assert.equal(r.pending[0].balance, 60000);

    assert.deepEqual(r.collected.map((a) => a.tableNumber), ['2']);
    const c = r.collected[0];
    assert.deepEqual(c.waiters.map((w) => w.name), ['Beto']);
    assert.deepEqual(c.collectedBy, ['Cajera']);
    assert.deepEqual(c.methods, ['cash', 'card']);
    assert.equal(c.paid, 30000);
    assert.equal(c.tip, 3000);

    assert.deepEqual(
      r.waiters.map((w) => [w.name, w.collected, w.collectedTotal, w.pending, w.pendingTotal]),
      [
        ['Ana', 0, 0, 1, 60000],
        ['Beto', 1, 30000, 0, 0],
      ],
    );

    const yesterday = await accounts.tableAccounts(cashier, '2020-01-01', tz);
    assert.equal(yesterday.collected.length, 0, 'las cobradas son las del día escogido');
    assert.equal(yesterday.pending.length, 1, 'las por cobrar salen siempre');

    await assert.rejects(accounts.tableAccounts(ana, today, tz), { code: 'FORBIDDEN' }, 'el mesero no la ve');
  });
});
