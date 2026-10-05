// Módulo 08 (tablero y radar de fugas) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { levelOf, radarScore } from '../lib/dashboard';

const url = process.env.TEST_DATABASE_URL;

describe('radar: cálculo', () => {
  it('niveles y puntaje', () => {
    assert.equal(levelOf(0, 1, 3), 'ok');
    assert.equal(levelOf(1, 1, 3), 'watch');
    assert.equal(levelOf(5, 1, 3), 'alert');
    assert.equal(radarScore([{ points: 8 }, { points: 0 }, { points: 22 }]), 70);
    assert.equal(radarScore([{ points: 80 }, { points: 80 }]), 0);
  });
});

describe('módulo 08: tablero del dueño', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let inv: typeof import('../lib/inventory');
  let kds: typeof import('../lib/kds');
  let dash: typeof import('../lib/dashboard');
  let fin: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor;
  // Marca única por archivo (corren en paralelo): Date.now() solo puede repetirse entre dos archivos.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const tz = 'America/Bogota';

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    inv = await import('../lib/inventory');
    kds = await import('../lib/kds');
    dash = await import('../lib/dashboard');
    fin = await import('../lib/finance');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Tablero`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login('0002', '1357');
    const cat = await orders.saveCategory(owner, { name: 'Bar', station: 'bar' });
    const whiskyDrink = await orders.saveProduct(owner, { categoryId: cat, name: 'Whisky doble', price: 40000 });
    const whisky = await inv.saveItem(owner, { name: 'Whisky', unit: 'ml', minStock: 2000, bottleSize: 750 });
    await inv.registerPurchase(owner, { itemId: whisky, quantity: 1500, total: 150000 });
    await inv.saveRecipe(owner, whiskyDrink, [{ itemId: whisky, quantity: 90 }]);
    const t = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    const s = await store.openTable(waiter, t, { guests: 2 });
    await orders.sendOrder(waiter, s, [{ productId: whiskyDrink, quantity: 3 }], randomUUID());
    const [ticket] = await kds.listTickets(owner, 'bar');
    await kds.moveTicket(owner, ticket.id, 'preparing');
    await kds.moveTicket(owner, ticket.id, 'ready');
    const order = (await orders.getSessionOrder(owner, s))!;
    await orders.voidItem(owner, order.rounds[0].items[0].id, 'Lo devolvió el cliente');
    await orders.sendOrder(waiter, s, [{ productId: whiskyDrink, quantity: 2 }], randomUUID());
    await cash.openShift(owner, 50000);
    await cash.applyDiscount(owner, s, { percent: 30, reason: 'Amigo del dueño' });
    await cash.pay(owner, s, { method: 'cash', amount: 56000, clientKey: randomUUID() });
    // Debía haber 1.500 − 270 − 180 = 1.050 ml; se cuentan 1,04 botellas = 780 ml: faltan 270 ml.
    await inv.registerCount(owner, { itemId: whisky, counted: '1,04', inBottles: true });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('el radar ve la anulación, el descuento alto y la fuga de whisky', async () => {
    const today = fin.todayIn(tz);
    await assert.rejects(dash.getDashboard(waiter, { from: today, to: today }, tz), { code: 'FORBIDDEN' });
    const d = await dash.getDashboard(owner, { from: today, to: today }, tz);
    assert.equal(d.statement.sales, 56000);
    const by = Object.fromEntries(d.signals.map((s) => [s.key, s]));
    assert.equal(by.voids.level, 'alert', '$120.000 anulados sobre $56.000 de ventas');
    assert.match(by.voids.detail, /1 ya se estaban preparando/);
    assert.equal(by.discounts.level, 'watch');
    assert.equal(by.inventory.level, 'alert');
    assert.match(by.inventory.detail, /Whisky: −270 ml/);
    assert.equal(by.cash.level, 'ok');
    assert.ok(d.score < 100 && d.score === 100 - d.signals.reduce((s, x) => s + x.points, 0));
    assert.equal(d.expectedCash, 50000 + 56000);
    assert.deepEqual(d.topByStation.find((t) => t.station === 'bar')!.items, [{ name: 'Whisky doble', quantity: 2 }]);
    assert.equal(d.prep.find((p) => p.station === 'bar')!.tickets, 1);
    assert.deepEqual(d.lowStock.map((l) => l.name), ['Whisky']);
  });
});

describe('módulo 12: resumen del día', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  it('sin llave de IA arma el resumen con plantilla y lo guarda', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.DATABASE_URL = url;
    const store = await import('../lib/store');
    const brief = await import('../lib/brief');
    const fin = await import('../lib/finance');
    const db = await import('../lib/db');
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const a = await store.createBusiness({ name: `Prueba ${stamp} Resumen`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const r = await store.loginStaff({ slug: a.slug, code: '0001', pin: '2580' });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    const owner = (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    const day = fin.todayIn('America/Bogota');
    const first = await brief.getBrief(owner, { day, locationId: null, timeZone: 'America/Bogota' });
    assert.equal(first.source, 'plantilla');
    assert.equal(first.cached, false);
    assert.match(first.text, /todavía no hay ventas/);
    const again = await brief.getBrief(owner, { day, locationId: null, timeZone: 'America/Bogota' });
    assert.equal(again.cached, true);
    await store.purgeBusiness(a.businessId);
    await db.closePool();
  });
});
