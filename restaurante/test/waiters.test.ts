// Bar sin cajero (DELIRIUM): cada mesero cobra sus mesas, lleva su cuenta y entrega su cierre; el administrador verifica.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('cada mesero cobra sus mesas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let waiters: typeof import('../lib/waiters');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, isabel: Actor, johan: Actor, agusto: Actor;
  let aguardiente: string, mesa1: string, mesa2: string;
  let slug: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión ' + code);
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const order = (who: Actor, session: string, quantity: number) => orders.sendOrder(who, session, [{ productId: aguardiente, quantity }], randomUUID());
  const pay = (who: Actor, session: string, method: string, amount: number, extra: { tip?: number; received?: number } = {}) =>
    cash.pay(who, session, { method, amount, clientKey: randomUUID(), ...extra });

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    waiters = await import('../lib/waiters');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Delirium`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    slug = a.slug;
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Isabel', role: 'waiter', locationId: null, pin: '4826' });
    await store.createStaff(owner, { name: 'Johan', role: 'waiter', locationId: null, pin: '5937' });
    await store.createStaff(owner, { name: 'Agusto', role: 'manager', locationId: null, pin: '6149' });
    const drinks = await orders.saveCategory(owner, { name: 'Licores', station: 'bar' });
    aguardiente = await orders.saveProduct(owner, { categoryId: drinks, name: 'Media de aguardiente', price: 50000 });
    const t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    const t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    isabel = await login('0002', '4826');
    johan = await login('0003', '5937');
    agusto = await login('0004', '6149');
    mesa1 = await store.openTable(isabel, t1, { guests: 3 });
    mesa2 = await store.openTable(isabel, t2, { guests: 2 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('sin la opción prendida, el mesero no cobra (lo hace la caja)', async () => {
    await order(isabel, mesa1, 3);
    await assert.rejects(pay(isabel, mesa1, 'card', 100000), { code: 'FORBIDDEN' });
    await assert.rejects(waiters.updateWorkMode(agusto, { waitersCollect: true, barOnly: true }), { code: 'FORBIDDEN' }, 'solo el dueño la prende');
    await waiters.updateWorkMode(owner, { waitersCollect: true, barOnly: true });
    const s = await login('0002', '4826');
    assert.equal(s.waitersCollect, true);
    assert.equal(s.barOnly, true);
  });

  it('Isabel cobra su mesa 1 ($150.000) por datáfono y efectivo; Johan no puede cobrarla', async () => {
    assert.equal(await cash.canCollectSession(isabel, mesa1), true);
    assert.equal(await cash.canCollectSession(johan, mesa1), false);
    await assert.rejects(cash.getCheckout(johan, mesa1), { code: 'FORBIDDEN' });
    await assert.rejects(pay(johan, mesa1, 'cash', 50000), { code: 'FORBIDDEN' });
    assert.equal((await cash.getCheckout(isabel, mesa1))!.balance, 150000);
    await pay(isabel, mesa1, 'card', 100000);
    const done = await pay(isabel, mesa1, 'cash', 50000, { tip: 5000, received: 60000 });
    assert.equal(done.closed, true);
    assert.equal(done.change, 5000);
    assert.equal(await cash.getOpenShift(owner), null, 'no hace falta abrir la caja de la sede');
  });

  it('su cuenta dice cuánto lleva, en qué forma de pago y por mesa; solo ella y el administrador la ven', async () => {
    const acc = await waiters.waiterAccount(isabel);
    assert.equal(acc.sales, 150000);
    assert.equal(acc.byMethod.card.amount, 100000);
    assert.equal(acc.byMethod.cash.amount, 50000);
    assert.equal(acc.byMethod.transfer.amount, 0);
    assert.equal(acc.tips, 5000);
    assert.equal(acc.cash, 55000, 'efectivo a entregar: venta + propina en efectivo');
    assert.equal(acc.tables.length, 1);
    assert.equal(acc.tables[0].tableNumber, '1');
    assert.deepEqual(acc.tables[0].payments.map((p) => p.method).sort(), ['card', 'cash']);
    assert.equal(acc.openTables.length, 1, 'la mesa 2 sigue abierta');
    await assert.rejects(waiters.waiterAccount(johan, isabel.id), { code: 'FORBIDDEN' });
    const all = await waiters.listWaiterAccounts(agusto);
    assert.deepEqual(all.map((a) => a.staff.name), ['Isabel', 'Johan']);
    assert.equal(all.find((a) => a.staff.name === 'Johan')!.sales, 0);
  });

  it('no puede cerrar con mesas abiertas; el administrador cobra la mesa 2 y entra a la cuenta de Isabel', async () => {
    await order(isabel, mesa2, 1);
    await assert.rejects(waiters.closeWaiterShift(isabel, isabel.id, 55000), { code: 'CONFLICT' });
    await pay(agusto, mesa2, 'transfer', 50000);
    const acc = await waiters.waiterAccount(agusto, isabel.id);
    assert.equal(acc.sales, 200000);
    assert.equal(acc.byMethod.transfer.amount, 50000);
    assert.equal(acc.openTables.length, 0);
  });

  it('cierra su cuenta con el efectivo que entrega; el administrador lo verifica', async () => {
    await assert.rejects(waiters.closeWaiterShift(johan, johan.id, 0), { code: 'CONFLICT' }, 'Johan no cobró nada');
    const closing = await waiters.closeWaiterShift(isabel, isabel.id, 50000, 'Me faltó la propina');
    assert.equal(closing.expected, 55000);
    assert.equal(closing.difference, -5000);
    await assert.rejects(waiters.verifyWaiterShift(isabel, closing.shiftId), { code: 'FORBIDDEN' });
    const list = await waiters.listWaiterClosings(agusto);
    assert.equal(list.length, 1);
    assert.equal(list[0].staffName, 'Isabel');
    assert.equal(list[0].sales, 200000);
    assert.equal(list[0].verifiedAt, null);
    await waiters.verifyWaiterShift(agusto, closing.shiftId, 'Revisado con Isabel');
    await assert.rejects(waiters.verifyWaiterShift(agusto, closing.shiftId), { code: 'CONFLICT' });
    const mine = await waiters.listWaiterClosings(isabel);
    assert.equal(mine[0].verifiedBy, 'Agusto');
    assert.equal((await waiters.waiterAccount(isabel)).sales, 0, 'la cuenta nueva empieza en cero');
  });

  it('una mesa que abrió el dueño la cobra el mesero que la atiende y entra a su cuenta', async () => {
    const t3 = await store.createTable(owner, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' });
    const mesa3 = await store.openTable(owner, t3, { guests: 2 });
    await order(owner, mesa3, 2);
    assert.equal(await cash.canCollectSession(johan, mesa3), true);
    assert.equal((await cash.getCheckout(johan, mesa3))!.balance, 100000);
    const done = await pay(johan, mesa3, 'transfer', 100000);
    assert.equal(done.closed, true);
    const acc = await waiters.waiterAccount(johan);
    assert.equal(acc.sales, 100000);
    assert.equal(acc.byMethod.transfer.amount, 100000);
    assert.equal((await waiters.waiterAccount(owner, owner.id)).sales, 0, 'no entra a la cuenta del dueño');
  });

  it('sin propina (0 %): no se sugiere y se puede volver a poner', async () => {
    await assert.rejects(waiters.updateWorkMode(owner, { waitersCollect: true, barOnly: true, suggestedTip: 31 }), /de 0 a 30/);
    await waiters.updateWorkMode(owner, { waitersCollect: true, barOnly: true, suggestedTip: 0 });
    assert.equal((await cash.workMode(owner.businessId)).suggestedTip, 0);
    const t4 = await store.createTable(owner, { zone: 'Salón', number: '4', capacity: 4, shape: 'square' });
    const mesa4 = await store.openTable(isabel, t4, { guests: 2 });
    await order(isabel, mesa4, 1);
    assert.equal((await cash.getCheckout(isabel, mesa4))!.suggestedTipPercent, 0);
    // Guardar sin tocar la propina no la cambia.
    await waiters.updateWorkMode(owner, { waitersCollect: true, barOnly: true });
    assert.equal((await cash.workMode(owner.businessId)).suggestedTip, 0);
  });
});
