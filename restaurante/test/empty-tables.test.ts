// Una mesa que se abrió pero no comandó nada no cuenta como abierta (pedido de Rigoberto, 23 oct 2026).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('mesas abiertas sin pedidos', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let waiters: typeof import('../lib/waiters');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, paola: Actor, cashier: Actor;
  let product: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    waiters = await import('../lib/waiters');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Vacías`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Paola', role: 'waiter', locationId: owner.locationId, pin: '4826' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: owner.locationId, pin: '2468' });
    paola = await login('0002', '4826');
    cashier = await login('0003', '2468');
    const cat = await orders.saveCategory(owner, { name: 'Bebidas', station: 'bar' });
    product = await orders.saveProduct(owner, { categoryId: cat, name: 'Limonada', price: 8000 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('sin comandar sale libre, no está en caja ni en la cuenta de la mesera, y al abrirla otra vez es la misma', async () => {
    const t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    const empty = await store.openTable(paola, t1, { guests: 2 });
    const status = async (id: string) => (await store.listTables(owner)).find((t) => t.id === id)!.status;
    assert.equal(await status(t1), 'free');
    assert.equal((await cash.openAccounts(cashier)).length, 0);
    assert.equal((await waiters.waiterAccount(paola)).openTables.length, 0);
    // Abrirla de nuevo usa la misma cuenta vacía (no choca con «alguien acaba de abrir esa mesa»).
    assert.equal(await store.openTable(owner, t1, { guests: 3 }), empty);
    // Con un pedido ya cuenta.
    await orders.sendOrder(owner, empty, [{ productId: product, quantity: 1 }], randomUUID());
    assert.equal(await status(t1), 'open');
    assert.equal((await cash.openAccounts(cashier)).length, 1);
  });

  it('pasar una mesa a otra que quedó abierta sin pedidos, o quitarla del plano, se deja', async () => {
    const t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    const t3 = await store.createTable(owner, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' });
    await store.openTable(paola, t2, { guests: 1 });
    const busy = await store.openTable(paola, t3, { guests: 1 });
    await orders.sendOrder(paola, busy, [{ productId: product, quantity: 1 }], randomUUID());
    await store.moveSession(paola, busy, t2);
    assert.equal((await store.listTables(owner)).find((t) => t.id === t2)!.session?.id, busy);
    const t4 = await store.createTable(owner, { zone: 'Salón', number: '4', capacity: 4, shape: 'square' });
    await store.openTable(paola, t4, { guests: 1 });
    await store.removeTable(owner, t4);
    assert.equal((await store.listTables(owner)).some((t) => t.id === t4), false);
  });
});
