// Módulo 07 (gastos y estado de resultados) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 07: gastos y finanzas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let inv: typeof import('../lib/inventory');
  let fin: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, manager: Actor;
  // Marca única por archivo (corren en paralelo): Date.now() solo puede repetirse entre dos archivos.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const tz = 'America/Bogota';
  let today: string;

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
    inv = await import('../lib/inventory');
    fin = await import('../lib/finance');
    today = fin.todayIn(tz);
    const a = await store.createBusiness({ name: `Prueba ${stamp} Finanzas`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Admin', role: 'manager', locationId: null, pin: '9512' });
    waiter = await login(a.slug, '0002', '1357');
    manager = await login(a.slug, '0003', '9512');

    // Una venta con receta: 2 hamburguesas de $30.000 con 150 g de carne a $40 el gramo ($6.000 de costo cada una).
    const cat = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    const burger = await orders.saveProduct(owner, { categoryId: cat, name: 'Hamburguesa', price: 30000 });
    const beef = await inv.saveItem(owner, { name: 'Carne', unit: 'g', minStock: 0 });
    await inv.registerPurchase(owner, { itemId: beef, quantity: 5000, total: 200000 });
    await inv.saveRecipe(owner, burger, [{ itemId: beef, quantity: 150 }]);
    const table = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    const sessionId = await store.openTable(waiter, table, { guests: 3 });
    await orders.sendOrder(waiter, sessionId, [{ productId: burger, quantity: 2 }], randomUUID());
    await cash.openShift(owner, 100000);
    await cash.applyDiscount(owner, sessionId, { amount: 5000, reason: 'Cortesía' });
    await cash.pay(owner, sessionId, { method: 'card', amount: 55000, tip: 5500, clientKey: randomUUID() });
    await inv.registerWaste(owner, { itemId: beef, quantity: 100, reason: 'Se dañó' });
    await inv.registerCount(owner, { itemId: beef, counted: 4500 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('fechas del negocio', () => {
    assert.equal(fin.todayIn(tz, new Date('2026-10-06T03:00:00Z')), '2026-10-05', 'a las 10 p. m. en Colombia sigue siendo el 5');
    assert.equal(fin.addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(fin.monthStart('2026-10-17'), '2026-10-01');
  });

  it('gastos: de la caja sale la plata; anular la devuelve', async () => {
    await assert.rejects(fin.addExpense(waiter, { category: 'rent', description: 'Arriendo', amount: 1, spentOn: today }), { code: 'FORBIDDEN' });
    await fin.addExpense(owner, { category: 'rent', description: 'Arriendo de octubre', amount: 2_000_000, spentOn: today });
    const iceId = await fin.addExpense(manager, { category: 'suppliers', description: 'Hielo', supplier: 'Hielos SAS', amount: 20000, spentOn: today, paidFromCash: true });
    await assert.rejects(fin.addExpense(owner, { category: 'other', description: 'Mucho', amount: 50_000_000, spentOn: today, paidFromCash: true }), { code: 'CONFLICT' });
    const shift = (await cash.getOpenShift(owner))!;
    assert.equal((await cash.shiftSummary(owner, shift.id))!.expectedCash, 100000 - 20000);
    const dup = await fin.addExpense(owner, { category: 'other', description: 'Registrado dos veces', amount: 7000, spentOn: today, paidFromCash: true });
    await fin.voidExpense(owner, dup, 'Duplicado');
    assert.equal((await cash.shiftSummary(owner, shift.id))!.expectedCash, 100000 - 20000, 'la plata volvió a la caja');
    const list = await fin.listExpenses(owner, { from: today, to: today });
    assert.equal(list.length, 3);
    assert.equal(list.find((e) => e.id === iceId)!.paidFromCash, true);
    await assert.rejects(fin.listExpenses(owner, { from: today, to: '2020-01-01' }), { code: 'INVALID' });
  });

  it('estado de resultados del día', async () => {
    const st = await fin.getStatement(owner, { from: today, to: today }, tz);
    assert.equal(st.sales, 55000);
    assert.equal(st.tips, 5500);
    assert.equal(st.discounts, 5000);
    assert.equal(st.costOfSales, 12000, '2 × 150 g × $40');
    assert.equal(st.grossProfit, 55000 - 12000);
    assert.equal(st.waste, 4000, '100 g × $40');
    // Había 5.000 − 300 − 100 = 4.600 g; se contaron 4.500: faltan 100 g = $4.000.
    assert.equal(st.inventoryShortage, 4000);
    assert.equal(st.expensesTotal, 2_020_000);
    assert.equal(st.operatingProfit, 55000 - 12000 - 4000 - 4000 - 2_020_000);
    assert.equal(st.tables, 1);
    assert.equal(st.guests, 3);
    assert.equal(st.averageTicket, 55000);
    assert.deepEqual(st.topProducts, [{ name: 'Hamburguesa', quantity: 2, total: 60000 }]);
    assert.deepEqual(st.byMethod, [{ method: 'card', amount: 55000 }]);
    const yesterday = await fin.getStatement(owner, { from: fin.addDays(today, -1), to: fin.addDays(today, -1) }, tz);
    assert.equal(yesterday.sales, 0);
  });
});
