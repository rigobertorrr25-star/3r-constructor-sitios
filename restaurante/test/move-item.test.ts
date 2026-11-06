// Pasar un producto de una mesa a otra (6 nov 2026). Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('pasar un producto a otra mesa', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, cashier: Actor;
  let beer: string, t1: string, t2: string, t3: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const items = async (sessionId: string) =>
    (await orders.getSessionOrder(waiter, sessionId))!.rounds.flatMap((r) => r.items.filter((i) => !i.voidedAt).map((i) => [i.name, i.quantity, i.notes]));

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Pasar`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: null, pin: '2468' });
    waiter = await login(a.slug, '0002', '1357');
    cashier = await login(a.slug, '0003', '2468');
    const drinks = await orders.saveCategory(owner, { name: 'Bebidas', station: 'bar' });
    beer = await orders.saveProduct(owner, { categoryId: drinks, name: 'Cerveza', price: 8000 });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    t3 = await store.createTable(owner, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('pasa una parte o todo; abre la mesa libre y cierra la que queda vacía', async () => {
    const s1 = await store.openTable(waiter, t1, { guests: 2 });
    await orders.sendOrder(waiter, s1, [{ productId: beer, quantity: 3 }], randomUUID());
    const [item] = (await orders.getSessionOrder(waiter, s1))!.rounds[0].items;

    const options = await orders.tablesForMove(waiter, t1);
    assert.deepEqual(options.map((o) => [o.number, o.busy]), [['2', false], ['3', false]]);

    await assert.rejects(orders.moveItem(waiter, item.id, t1), { code: 'INVALID' }, 'a la misma mesa no');
    await assert.rejects(orders.moveItem(waiter, item.id, t2, 4), { code: 'INVALID' }, 'no más de los que hay');

    // 1 de 3 a la mesa 2, que estaba libre: se abre.
    const r = await orders.moveItem(waiter, item.id, t2, 1);
    assert.equal(r.closedFrom, false);
    assert.deepEqual(await items(s1), [['Cerveza', 2, null]]);
    assert.deepEqual(await items(r.toSession), [['Cerveza', 1, 'Pasado de la mesa 1']]);
    assert.equal((await cash.getCheckout(cashier, r.toSession))!.total, 8000);
    assert.equal((await cash.getCheckout(cashier, s1))!.total, 16000);

    // Las otras 2 también: la mesa 1 queda vacía y se cierra.
    const r2 = await orders.moveItem(waiter, item.id, t2);
    assert.equal(r2.toSession, r.toSession, 'a la misma cuenta de la mesa 2');
    assert.equal(r2.closedFrom, true);
    assert.equal((await cash.getCheckout(cashier, r.toSession))!.total, 24000);
    assert.equal((await cash.getCheckout(cashier, s1))!.session.status, 'closed', 'la mesa 1 quedó vacía y se cerró');
    assert.ok(!(await orders.tablesForMove(waiter, t2)).find((o) => o.number === '1')!.busy, 'la mesa 1 vuelve a estar libre');

    const audit = await store.listAudit(owner, { action: 'order.move' });
    assert.ok(audit.some((x) => /Pasó 1 × Cerveza de la mesa 1 a la mesa 2/.test(x.summary)));
  });

  it('no se deja si la mesa ya tiene abonos', async () => {
    await cash.openShift(cashier, 0);
    const s3 = await store.openTable(waiter, t3, { guests: 1 });
    await orders.sendOrder(waiter, s3, [{ productId: beer, quantity: 2 }], randomUUID());
    const [item] = (await orders.getSessionOrder(waiter, s3))!.rounds[0].items;
    await cash.pay(cashier, s3, { method: 'card', amount: 8000, clientKey: randomUUID() });
    await assert.rejects(orders.moveItem(waiter, item.id, t1, 1), { code: 'CONFLICT' });
  });
});
