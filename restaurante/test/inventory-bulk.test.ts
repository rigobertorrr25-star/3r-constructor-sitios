// Inventario masivo (DELIRIUM): armarlo desde la carta y cargar existencias, costos y mínimos de una vez.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('inventario masivo', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let inv: typeof import('../lib/inventory');
  let bulk: typeof import('../lib/inventory-bulk');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor;
  let beers: string, cocktails: string, corona: string, mojito: string, table: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const byName = async (name: string) => (await inv.listItems(owner)).find((i) => i.name === name)!;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    inv = await import('../lib/inventory');
    bulk = await import('../lib/inventory-bulk');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Masivo`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Isabel', role: 'waiter', locationId: null, pin: '4826' });
    waiter = await login(a.slug, '0002', '4826');
    beers = await orders.saveCategory(owner, { name: 'Cervezas', station: 'bar' });
    cocktails = await orders.saveCategory(owner, { name: 'Cócteles', station: 'bar' });
    corona = await orders.saveProduct(owner, { categoryId: beers, name: 'Corona', price: 12000 });
    await orders.saveProduct(owner, { categoryId: beers, name: 'Club Colombia', price: 8000 });
    mojito = await orders.saveProduct(owner, { categoryId: cocktails, name: 'Mojito', price: 27000 });
    table = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('crea un insumo por producto de las categorías marcadas y cada venta descuenta 1', async () => {
    await assert.rejects(bulk.inventoryFromMenu(waiter, [beers]), { code: 'FORBIDDEN' });
    await assert.rejects(bulk.inventoryFromMenu(owner, []), /al menos una categoría/);
    const menu = await bulk.menuForInventory(owner);
    assert.deepEqual(
      menu.map((c) => [c.name, c.withoutRecipe]),
      [
        ['Cervezas', 2],
        ['Cócteles', 1],
      ],
    );
    assert.deepEqual(await bulk.inventoryFromMenu(owner, [beers]), { created: 2, linked: 2, skipped: [] });
    assert.deepEqual(await bulk.inventoryFromMenu(owner, [beers]), { created: 0, linked: 0, skipped: [] }, 'no repite');
    assert.equal((await inv.getRecipe(owner, corona))[0].quantity, 1);
    assert.equal((await inv.getRecipe(owner, mojito)).length, 0, 'los cócteles no se tocan');

    // Cargar 48 Coronas a $4.500 con mínimo 24, y vender 2.
    const item = await byName('Corona');
    await assert.rejects(bulk.bulkStock(owner, [{ itemId: item.id }]), /al menos una cantidad/);
    assert.deepEqual(await bulk.bulkStock(owner, [{ itemId: item.id, counted: '48', unitCost: '$ 4.500', minStock: '24' }]), { counted: 1, costs: 1, mins: 1 });
    let corona1 = await byName('Corona');
    assert.deepEqual([corona1.stock, corona1.unitCost, corona1.minStock], [48, 4500, 24]);
    const session = await store.openTable(waiter, table, { guests: 2 });
    await orders.sendOrder(waiter, session, [{ productId: corona, quantity: 2 }], randomUUID());
    corona1 = await byName('Corona');
    assert.equal(corona1.stock, 46);
    // Volver a contar deja la diferencia como conteo (45 → falta 1).
    await bulk.bulkStock(owner, [{ itemId: item.id, counted: '45' }]);
    assert.equal((await byName('Corona')).stock, 45);
  });

  it('un insumo en botellas se carga en botellas; uno con el mismo nombre en ml no se pisa', async () => {
    const ron = await inv.saveItem(owner, { name: 'Ron', unit: 'ml', minStock: 0, bottleSize: 750 });
    await bulk.bulkStock(owner, [{ itemId: ron, counted: '2,5', unitCost: '60000', minStock: '1' }]);
    const r = (await inv.getItem(owner, ron))!;
    assert.deepEqual([r.stock, r.unitCost, r.minStock], [1875, 80, 750]);
    await inv.saveItem(owner, { name: 'Mojito', unit: 'ml', minStock: 0 });
    assert.deepEqual(await bulk.inventoryFromMenu(owner, [cocktails]), { created: 0, linked: 0, skipped: ['Mojito'] });
  });

  it('el bartender carga cantidades y mínimos (no costos) y el administrador ve quién lo hizo', async () => {
    await store.createStaff(owner, { name: 'Breiner', role: 'bar', locationId: null, pin: '7391' });
    await store.createStaff(owner, { name: 'Agusto', role: 'manager', locationId: null, pin: '6149' });
    const slug = (await db.query<{ slug: string }>('SELECT slug FROM businesses WHERE id = $1', [owner.businessId]))[0].slug;
    const breiner = await login(slug, '0003', '7391');
    const agusto = await login(slug, '0004', '6149');
    const club = await byName('Club Colombia');
    await assert.rejects(bulk.bulkStock(breiner, [{ itemId: club.id, counted: '10', unitCost: '3000' }]), /dueño o el administrador/);
    await bulk.bulkStock(breiner, [{ itemId: club.id, counted: '24', minStock: '12' }]);
    assert.deepEqual([(await byName('Club Colombia')).stock, (await byName('Club Colombia')).minStock], [24, 12]);
    await assert.rejects(bulk.bulkStock(waiter, [{ itemId: club.id, counted: '1' }]), { code: 'FORBIDDEN' });

    const tz = 'America/Bogota';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const people = await inv.movementPeople(agusto);
    assert.ok(people.some((p) => p.name === 'Breiner'));
    const hisMoves = await inv.listMovements(agusto, { staffId: breiner.id, days: { from: today, to: today, timeZone: tz } });
    assert.equal(hisMoves.length, 1);
    assert.deepEqual([hisMoves[0].itemName, hisMoves[0].kind, hisMoves[0].counted, hisMoves[0].createdBy], ['Club Colombia', 'count', 24, 'Breiner']);
    assert.equal((await inv.listMovements(agusto, { staffId: breiner.id, days: { from: '2020-01-01', to: '2020-01-01', timeZone: tz } })).length, 0);
    await assert.rejects(inv.movementPeople(breiner), { code: 'FORBIDDEN' });
  });
});
