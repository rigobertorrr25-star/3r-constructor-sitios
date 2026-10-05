// Módulo 02 (carta y pedidos) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 02: carta y pedidos', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let db: typeof import('../lib/db');
  let owner: import('../lib/store').Actor;
  let waiter: import('../lib/store').Actor;
  let other: import('../lib/store').Actor;
  const stamp = Date.now();
  let burger: string, mojito: string, water: string, sessionId: string, tableId: string;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    assert.equal(r.kind, 'ok');
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Pedidos`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login(a.slug, '0002', '1357');
    const b = await store.createBusiness({ name: `Prueba ${stamp} Otro`, locationName: 'Sur', ownerName: 'Otro', ownerPin: '2580' });
    other = await login(b.slug, '0001', '2580');
    tableId = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('arma la carta; el precio va en pesos enteros', async () => {
    assert.equal(orders.parsePrice('12.500'), 12500);
    assert.equal(orders.parsePrice('$ 8000'), 8000);
    assert.throws(() => orders.parsePrice('12,5'), { code: 'INVALID' });
    assert.throws(() => orders.parsePrice('-1'), { code: 'INVALID' });

    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    const drinks = await orders.saveCategory(owner, { name: 'Cócteles', station: 'bar' });
    await assert.rejects(orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' }), { code: 'CONFLICT' });
    await assert.rejects(orders.saveCategory(waiter, { name: 'Postres', station: 'kitchen' }), { code: 'FORBIDDEN' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa Caribe', price: '32.000' });
    mojito = await orders.saveProduct(owner, { categoryId: drinks, name: 'Mojito', price: 18000 });
    water = await orders.saveProduct(owner, { categoryId: food, name: 'Agua', price: 4000, station: 'bar' });
    await assert.rejects(orders.saveProduct(other, { categoryId: food, name: 'Robo', price: 1 }), { code: 'INVALID' }, 'otra empresa no usa mis categorías');

    const menu = await orders.getMenu(owner.businessId);
    assert.deepEqual(menu.categories.map((c) => c.name), ['Platos', 'Cócteles']);
    const byName = Object.fromEntries(menu.products.map((p) => [p.name, p]));
    assert.equal(byName['Hamburguesa Caribe'].price, 32000);
    assert.equal(byName['Mojito'].station, 'bar', 'hereda la estación de su categoría');
    assert.equal(byName['Agua'].station, 'bar', 'o usa la suya');
    assert.equal((await orders.getMenu(other.businessId)).products.length, 0);
  });

  it('envía un pedido partido en cocina y barra, sin duplicar con el mismo envío', async () => {
    sessionId = await store.openTable(waiter, tableId, { guests: 2 });
    const key = randomUUID();
    const cart = [
      { productId: burger, quantity: 2, notes: 'Una sin cebolla' },
      { productId: mojito, quantity: 2 },
      { productId: water, quantity: 1 },
    ];
    const [first, second] = await Promise.all([orders.sendOrder(waiter, sessionId, cart, key), orders.sendOrder(waiter, sessionId, cart, key)]);
    assert.equal(first.roundId, second.roundId, 'un doble toque no manda dos pedidos');
    assert.equal(first.number, 1);

    const tickets = await db.query<{ station: string }>('SELECT station FROM station_tickets WHERE round_id = $1 ORDER BY station', [first.roundId]);
    assert.deepEqual(tickets.map((t) => t.station), ['bar', 'kitchen']);

    // Un cambio de precio no toca lo ya pedido.
    const menu = await orders.getMenu(owner.businessId);
    const b = menu.products.find((p) => p.id === burger)!;
    await orders.saveProduct(owner, { id: burger, categoryId: b.categoryId, name: b.name, price: 35000 });
    const order = (await orders.getSessionOrder(waiter, sessionId))!;
    assert.equal(order.total, 2 * 32000 + 2 * 18000 + 4000);
    assert.equal(order.rounds.length, 1);

    const second2 = await orders.sendOrder(waiter, sessionId, [{ productId: burger, quantity: 1 }], randomUUID());
    assert.equal(second2.number, 2);
    assert.equal((await orders.getSessionOrder(waiter, sessionId))!.total, 104000 + 35000);
    assert.equal((await orders.sessionTotals(owner.businessId, [sessionId])).get(sessionId), 139000);
  });

  it('no deja pedir lo agotado, lo de otra empresa ni en una mesa cerrada', async () => {
    await orders.setProductAvailable(waiter, mojito, false);
    await assert.rejects(orders.sendOrder(waiter, sessionId, [{ productId: mojito, quantity: 1 }], randomUUID()), { code: 'CONFLICT' });
    await orders.setProductAvailable(waiter, mojito, true);
    await assert.rejects(orders.sendOrder(other, sessionId, [{ productId: burger, quantity: 1 }], randomUUID()), { code: 'NOT_FOUND' });
    await assert.rejects(orders.sendOrder(waiter, sessionId, [{ productId: burger, quantity: 0 }], randomUUID()), { code: 'INVALID' });
    await assert.rejects(orders.sendOrder(waiter, sessionId, [], randomUUID()), { code: 'INVALID' });
    assert.equal(await orders.getSessionOrder(other, sessionId), null);
  });

  it('anular deja rastro y baja el total; el mesero no puede', async () => {
    const order = (await orders.getSessionOrder(waiter, sessionId))!;
    const water1 = order.rounds[0].items.find((i) => i.name === 'Agua')!;
    await assert.rejects(orders.voidItem(waiter, water1.id, 'No la quiso'), { code: 'FORBIDDEN' });
    await assert.rejects(orders.voidItem(owner, water1.id, ''), { code: 'INVALID' });
    await orders.voidItem(owner, water1.id, 'No la quiso');
    await assert.rejects(orders.voidItem(owner, water1.id, 'otra vez'), { code: 'CONFLICT' });
    const after = (await orders.getSessionOrder(waiter, sessionId))!;
    assert.equal(after.total, 139000 - 4000);
    assert.equal(after.rounds[0].items.find((i) => i.id === water1.id)!.voidReason, 'No la quiso');
    const audit = await store.listAudit(owner, { action: 'order.void' });
    assert.equal(audit[0].reason, 'No la quiso');
  });

  it('una mesa con consumo no se cierra sin cobrar', async () => {
    await store.setBill(waiter, sessionId, true);
    await assert.rejects(store.closeTable(owner, sessionId), { code: 'CONFLICT' });
    // Pedir más con la cuenta pedida la vuelve a abrir.
    await orders.sendOrder(waiter, sessionId, [{ productId: water, quantity: 1 }], randomUUID());
    assert.equal((await orders.getSessionOrder(waiter, sessionId))!.session.status, 'open');
  });
});
