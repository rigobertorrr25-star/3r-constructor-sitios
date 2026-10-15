// Módulos 05 y 06 (inventario, recetas y botellas) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulos 05 y 06: inventario y recetas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let inv: typeof import('../lib/inventory');
  let kds: typeof import('../lib/kds');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, bartender: Actor;
  let whisky: string, lime: string, drink: string, table: string;
  // Marca única por archivo (corren en paralelo): Date.now() solo puede repetirse entre dos archivos.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const stock = async (id: string) => (await inv.getItem(owner, id))!.stock;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    inv = await import('../lib/inventory');
    kds = await import('../lib/kds');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Inventario`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Bartender', role: 'bar', locationId: null, pin: '9753' });
    waiter = await login(a.slug, '0002', '1357');
    bartender = await login(a.slug, '0003', '9753');
    const cat = await orders.saveCategory(owner, { name: 'Whisky', station: 'bar' });
    drink = await orders.saveProduct(owner, { categoryId: cat, name: 'Whisky con limón', price: 25000 });
    table = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('insumos y compras con costo promedio', async () => {
    assert.equal(inv.parseQuantity('1,5'), 1.5);
    assert.throws(() => inv.parseQuantity('-2'), { code: 'INVALID' });
    await assert.rejects(inv.saveItem(owner, { name: 'Ron', unit: 'g', minStock: 0, bottleSize: 750 }), { code: 'INVALID' }, 'botella en ml');
    whisky = await inv.saveItem(owner, { name: 'Whisky', unit: 'ml', minStock: 1500, bottleSize: 750 });
    lime = await inv.saveItem(owner, { name: 'Limón', unit: 'und', minStock: 0 });
    await assert.rejects(inv.saveItem(waiter, { name: 'Hielo', unit: 'g', minStock: 0 }), { code: 'FORBIDDEN' });
    // 2 botellas (1.500 ml) por $120.000 → $80 el ml; luego 750 ml por $75.000 → $100 el ml. Promedio: $86,67.
    await inv.registerPurchase(owner, { itemId: whisky, quantity: 1500, total: 120000 });
    await inv.registerPurchase(owner, { itemId: whisky, quantity: 750, total: 75000 });
    await inv.registerPurchase(owner, { itemId: lime, quantity: 50, total: 10000 });
    const w = (await inv.getItem(owner, whisky))!;
    assert.equal(w.stock, 2250);
    assert.ok(Math.abs(w.unitCost - 86.6667) < 0.01, String(w.unitCost));
  });

  it('cada venta descuenta la receta; anular antes de preparar lo devuelve', async () => {
    await inv.saveRecipe(owner, drink, [
      { itemId: whisky, quantity: '45' },
      { itemId: lime, quantity: '0,5' },
    ]);
    await assert.rejects(inv.saveRecipe(owner, drink, [{ itemId: whisky, quantity: 1 }, { itemId: whisky, quantity: 2 }]), { code: 'INVALID' });
    const recipe = await inv.getRecipe(owner, drink);
    assert.deepEqual(recipe.map((r) => [r.name, r.quantity]), [['Limón', 0.5], ['Whisky', 45]]);
    const cost = (await inv.productCosts(owner.businessId)).get(drink)!;
    assert.ok(Math.abs(cost - (45 * 86.6667 + 0.5 * 200)) < 1);

    const sessionId = await store.openTable(waiter, table, { guests: 2 });
    await orders.sendOrder(waiter, sessionId, [{ productId: drink, quantity: 4 }], randomUUID());
    assert.equal(await stock(whisky), 2250 - 180);
    assert.equal(await stock(lime), 48);

    // Ronda 2 se anula antes de prepararse: vuelve. Ronda 1 ya estaba preparándose: se queda gastada.
    const [t1] = await kds.listTickets(bartender, 'bar');
    await kds.moveTicket(bartender, t1.id, 'preparing');
    await orders.sendOrder(waiter, sessionId, [{ productId: drink, quantity: 2 }], randomUUID());
    const order = (await orders.getSessionOrder(owner, sessionId))!;
    await orders.voidItem(owner, order.rounds[1].items[0].id, 'Se equivocó el mesero');
    assert.equal(await stock(whisky), 2250 - 180);
    await orders.voidItem(owner, order.rounds[0].items[0].id, 'Lo devolvieron');
    assert.equal(await stock(whisky), 2250 - 180, 'ya preparado: no vuelve');
  });

  it('merma y conteo de botellas: la diferencia es la fuga', async () => {
    await assert.rejects(inv.registerWaste(waiter, { itemId: whisky, quantity: 30, reason: 'Se cayó' }), { code: 'FORBIDDEN' });
    await inv.registerWaste(bartender, { itemId: whisky, quantity: 30, reason: 'Se cayó un trago' });
    assert.equal(await stock(whisky), 2040);
    await assert.rejects(inv.registerCount(owner, { itemId: lime, counted: 2, inBottles: true }), { code: 'INVALID' });
    // Hay 2 botellas llenas y un 36 % de la abierta = 2,36 × 750 = 1.770 ml. Debían ser 2.040: faltan 270 ml.
    const r = await inv.registerCount(owner, { itemId: whisky, counted: '2,36', inBottles: true, reason: 'Conteo del domingo' });
    assert.equal(r.expected, 2040);
    assert.equal(r.counted, 1770);
    assert.equal(r.difference, -270);
    assert.equal(await stock(whisky), 1770);
    const low = await inv.lowStock(owner);
    assert.deepEqual(low.map((l) => l.name), [], 'aún sobre el mínimo de 1.500');
    await inv.registerWaste(owner, { itemId: whisky, quantity: 300, reason: 'Botella rota' });
    assert.deepEqual((await inv.lowStock(owner)).map((l) => l.name), ['Whisky']);
    const moves = await inv.listMovements(owner, { itemId: whisky, kind: 'count' });
    assert.equal(moves[0].counted, 1770);
  });

  it('los movimientos no se pueden cambiar ni borrar', async () => {
    await assert.rejects(db.query('UPDATE inventory_movements SET quantity = 0 WHERE item_id = $1', [whisky]), /no se puede/);
    await assert.rejects(db.query('DELETE FROM inventory_movements WHERE item_id = $1', [whisky]), /no se puede/);
  });
});
