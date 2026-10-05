// Módulo 03 (cocina y barra) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 03: cocina y barra', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let kds: typeof import('../lib/kds');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, cook: Actor, bartender: Actor;
  let sessionId: string;
  const stamp = Date.now();

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
    kds = await import('../lib/kds');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Cocina`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Chef', role: 'kitchen', locationId: null, pin: '2468' });
    await store.createStaff(owner, { name: 'Bartender', role: 'bar', locationId: null, pin: '9753' });
    waiter = await login(a.slug, '0002', '1357');
    cook = await login(a.slug, '0003', '2468');
    bartender = await login(a.slug, '0004', '9753');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    const drinks = await orders.saveCategory(owner, { name: 'Bebidas', station: 'bar' });
    const burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 30000 });
    const fries = await orders.saveProduct(owner, { categoryId: food, name: 'Papas', price: 9000 });
    const beer = await orders.saveProduct(owner, { categoryId: drinks, name: 'Cerveza', price: 8000 });
    const table = await store.createTable(owner, { zone: 'Salón', number: '5', capacity: 4, shape: 'square' });
    sessionId = await store.openTable(waiter, table, { guests: 2 });
    await orders.sendOrder(
      waiter,
      sessionId,
      [
        { productId: burger, quantity: 2, notes: 'Sin cebolla' },
        { productId: fries, quantity: 1 },
        { productId: beer, quantity: 2 },
      ],
      randomUUID(),
    );
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('cada estación ve solo lo suyo', async () => {
    const kitchen = await kds.listTickets(cook, 'kitchen');
    assert.equal(kitchen.length, 1);
    assert.deepEqual(kitchen[0].items.map((i) => `${i.quantity} ${i.name} ${i.notes ?? ''}`.trim()), ['2 Hamburguesa Sin cebolla', '1 Papas']);
    assert.equal(kitchen[0].tableNumber, '5');
    const bar = await kds.listTickets(bartender, 'bar');
    assert.deepEqual(bar[0].items.map((i) => i.name), ['Cerveza']);
    await assert.rejects(kds.listTickets(cook, 'bar'), { code: 'FORBIDDEN' });
    await assert.rejects(kds.listTickets(waiter, 'kitchen'), { code: 'FORBIDDEN' });
    assert.equal((await kds.listTickets(owner, 'bar')).length, 1, 'el dueño ve las dos');
    assert.deepEqual(await kds.pendingCounts(owner), { kitchen: 1, bar: 1 });
  });

  it('la comanda avanza paso a paso y guarda las horas', async () => {
    const [ticket] = await kds.listTickets(cook, 'kitchen');
    await assert.rejects(kds.moveTicket(cook, ticket.id, 'ready'), { code: 'CONFLICT' }, 'no se salta pasos');
    await assert.rejects(kds.moveTicket(bartender, ticket.id, 'preparing'), { code: 'FORBIDDEN' });
    await kds.moveTicket(cook, ticket.id, 'preparing');
    await kds.moveTicket(cook, ticket.id, 'ready');
    const [ready] = await kds.listTickets(cook, 'kitchen');
    assert.equal(ready.status, 'ready');
    assert.ok(ready.startedAt && ready.readyAt);

    const toServe = await kds.readyToServe(waiter);
    assert.equal(toServe.length, 1);
    assert.deepEqual(toServe[0].items, ['2 × Hamburguesa', '1 × Papas']);
    await assert.rejects(kds.moveTicket(waiter, ticket.id, 'preparing'), { code: 'FORBIDDEN' }, 'el mesero no devuelve a cocina');
    await kds.moveTicket(waiter, ticket.id, 'delivered');
    assert.equal((await kds.readyToServe(waiter)).length, 0);
    const order = (await orders.getSessionOrder(waiter, sessionId))!;
    assert.ok(order.rounds[0].items.filter((i) => i.station === 'kitchen').every((i) => i.ticketStatus === 'delivered'));

    // Deshacer un toque equivocado queda en la auditoría.
    await kds.moveTicket(owner, ticket.id, 'ready');
    const audit = await store.listAudit(owner, { action: 'ticket.undo' });
    assert.equal(audit.length, 1);
  });

  it('lo anulado se ve tachado en la comanda', async () => {
    const [ticket] = await kds.listTickets(bartender, 'bar');
    await orders.voidItem(owner, ticket.items[0].id, 'Pidió otra cosa');
    const [after] = await kds.listTickets(bartender, 'bar');
    assert.equal(after.items[0].voided, true);
    // Todo anulado: se descarta de un toque, sin pasar por preparación.
    await kds.moveTicket(bartender, after.id, 'delivered');
    assert.equal((await kds.listTickets(bartender, 'bar'))[0].status, 'delivered');
  });
});
