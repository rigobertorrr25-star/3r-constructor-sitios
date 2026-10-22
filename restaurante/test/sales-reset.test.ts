// Borrar las ventas de prueba de un negocio (lo hace 3R desde /admin). Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('borrar ventas de prueba', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let inv: typeof import('../lib/inventory');
  let cash: typeof import('../lib/cash');
  let reset: typeof import('../lib/sales-reset');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, waiter: Actor, other: Actor;
  let beer: string, beerItem: string, table1: string, table2: string, name: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const count = async (table: string, businessId: string) =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE business_id = $1`, [businessId]))[0].n;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    inv = await import('../lib/inventory');
    cash = await import('../lib/cash');
    reset = await import('../lib/sales-reset');
    name = `Prueba ${stamp} Ventas`;
    const a = await store.createBusiness({ name, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesera', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login(a.slug, '0002', '1357');
    const cat = await orders.saveCategory(owner, { name: 'Cervezas', station: 'bar' });
    beer = await orders.saveProduct(owner, { categoryId: cat, name: 'Club Colombia', price: 8000 });
    beerItem = await inv.saveItem(owner, { name: 'Club Colombia', unit: 'und', minStock: 0 });
    await inv.saveRecipe(owner, beer, [{ itemId: beerItem, quantity: '1' }]);
    await inv.registerPurchase(owner, { itemId: beerItem, quantity: 24, total: 72000 });
    table1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    table2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    // Otro negocio: lo suyo no se toca.
    const b = await store.createBusiness({ name: `Prueba ${stamp} Otro`, locationName: 'Centro', ownerName: 'Otro', ownerPin: '2580' });
    other = await login(b.slug, '0001', '2580');
    const t = await store.createTable(other, { zone: 'Salón', number: '1', capacity: 2, shape: 'square' });
    await store.openTable(other, t, { guests: 2 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('borra mesas, pedidos, pagos y caja; el inventario vuelve a lo cargado y lo demás se queda', async () => {
    // Una mesa cobrada y otra que quedó abierta.
    await cash.openShift(owner, 50000);
    const s1 = await store.openTable(waiter, table1, { guests: 2 });
    await orders.sendOrder(waiter, s1, [{ productId: beer, quantity: 3 }], randomUUID());
    await cash.pay(owner, s1, { method: 'cash', amount: 24000, clientKey: randomUUID() });
    const s2 = await store.openTable(waiter, table2, { guests: 4 });
    await orders.sendOrder(waiter, s2, [{ productId: beer, quantity: 2 }], randomUUID());
    assert.equal((await inv.getItem(owner, beerItem))!.stock, 19);

    await assert.rejects(reset.clearSales(owner.businessId, 'Otro nombre'), { code: 'INVALID' }, 'hay que escribir el nombre');
    assert.equal(await count('table_sessions', owner.businessId), 2, 'sin confirmar no borra nada');

    const r = await reset.clearSales(owner.businessId, `  ${name.toUpperCase()} `);
    assert.deepEqual(r, { sessions: 2, payments: 1, collected: 24000, shifts: 1 });
    for (const t of ['table_sessions', 'order_rounds', 'order_items', 'payments', 'cash_shifts', 'invoices']) {
      assert.equal(await count(t, owner.businessId), 0, t);
    }
    assert.equal((await inv.getItem(owner, beerItem))!.stock, 24, 'la existencia vuelve a la compra');
    // Se queda: equipo, mesas libres, carta, inventario con su compra.
    assert.equal(await count('staff', owner.businessId), 2);
    assert.equal(await count('menu_products', owner.businessId), 1);
    assert.equal((await store.listTables(owner)).filter((t) => t.status === 'free').length, 2);
    // Y se puede volver a vender de una.
    await cash.openShift(owner, 0);
    await store.openTable(waiter, table1, { guests: 1 });
    const audit = await db.query<{ action: string }>(`SELECT action FROM audit_events WHERE business_id = $1 AND action = 'business.clear_sales'`, [owner.businessId]);
    assert.equal(audit.length, 1);
    // El otro negocio sigue con su mesa abierta.
    assert.equal(await count('table_sessions', other.businessId), 1);
  });
});
