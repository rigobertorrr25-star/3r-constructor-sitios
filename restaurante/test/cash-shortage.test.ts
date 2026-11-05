// Faltante al cerrar la caja: cobros marcados en efectivo que fueron por transferencia o datáfono. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('faltante al cerrar la caja', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let waiter: Actor, cashier: Actor;
  let burger: string, t1: string, t2: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const order = async (table: string, quantity: number) => {
    const sessionId = await store.openTable(waiter, table, { guests: 2 });
    await orders.sendOrder(waiter, sessionId, [{ productId: burger, quantity }], randomUUID());
    return sessionId;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Faltante`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: null, pin: '2468' });
    waiter = await login(a.slug, '0002', '1357');
    cashier = await login(a.slug, '0003', '2468');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 30000 });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('todo un cobro o una parte pasa a transferencia; la plata sacada para pagar es una salida; el esperado baja', async () => {
    const shift = await cash.openShift(cashier, 100000);
    const s1 = await order(t1, 1);
    const s2 = await order(t2, 2);
    await cash.pay(cashier, s1, { method: 'cash', amount: 30000, tip: 3000, received: 33000, clientKey: randomUUID() });
    await cash.pay(cashier, s2, { method: 'cash', amount: 60000, received: 60000, clientKey: randomUUID() });
    const shiftId = (await cash.getOpenShift(cashier))!.id;
    const expected = async () => (await cash.shiftSummary(cashier, shiftId))!.expectedCash;
    assert.equal(await expected(), 193000);

    const list = await cash.openShiftCashPayments(cashier);
    assert.deepEqual(list.map((p) => [p.tableNumber, p.amount, p.tip]).sort(), [['1', 30000, 3000], ['2', 60000, 0]]);
    const p1 = list.find((p) => p.tableNumber === '1')!;
    const p2 = list.find((p) => p.tableNumber === '2')!;

    await assert.rejects(cash.moveCashPayment(waiter, p1.id, { method: 'transfer', amount: 33000 }), { code: 'FORBIDDEN' });
    await assert.rejects(cash.moveCashPayment(cashier, p1.id, { method: 'cash', amount: 33000 }), { code: 'INVALID' });
    await assert.rejects(cash.moveCashPayment(cashier, p1.id, { method: 'transfer', amount: 31000 }), { code: 'INVALID' }, 'entre el valor y el total con propina no se deja');

    // Mesa 1: todo fue por transferencia (con la propina).
    await cash.moveCashPayment(cashier, p1.id, { method: 'transfer', amount: 33000 });
    assert.equal(await expected(), 160000);
    await assert.rejects(cash.moveCashPayment(cashier, p1.id, { method: 'card', amount: 33000 }), { code: 'CONFLICT' }, 'ya no está en efectivo');

    // Mesa 2: 20.000 fueron por datáfono y el resto sí en efectivo.
    await cash.moveCashPayment(cashier, p2.id, { method: 'card', amount: 20000 });
    assert.equal(await expected(), 140000);
    const sum = (await cash.shiftSummary(cashier, shiftId))!;
    assert.deepEqual(
      [sum.byMethod.cash.amount, sum.byMethod.transfer.amount, sum.byMethod.transfer.tip, sum.byMethod.card.amount],
      [40000, 30000, 3000, 20000],
    );
    assert.equal(sum.sales, 90000, 'lo vendido no cambia');
    const c2 = (await cash.getCheckout(cashier, s2))!;
    assert.equal(c2.balance, 0, 'la mesa sigue pagada');

    // La plata que se sacó para pagar algo.
    await cash.addMovement(cashier, { kind: 'out', amount: 15000, reason: 'Pago: hielo' });
    assert.equal(await expected(), 125000);
    const closed = await cash.closeShift(cashier, 125000, '', {});
    assert.ok(closed);
    void shift;
  });
});
