// Mesa con 100 % de descuento (un jefe): queda en $0 y debe cerrarse. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('cuenta en $0 por descuento', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor;
  let burger: string, t1: string, t2: string, t3: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const order = async (table: string) => {
    const s = await store.openTable(waiter, table, { guests: 1 });
    await orders.sendOrder(waiter, s, [{ productId: burger, quantity: 2 }], randomUUID());
    return s;
  };
  const status = async (s: string) => (await cash.getCheckout(owner, s))!.session.status;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Cero`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login(a.slug, '0002', '1357');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 30000 });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
    t3 = await store.createTable(owner, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' });
    await cash.openShift(owner, 0);
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('el 100 % de descuento cierra la mesa; uno parcial no; el resto pagado lo cierra el pago', async () => {
    const s1 = await order(t1);
    await cash.applyDiscount(owner, s1, { percent: 100, reason: 'Consumo del jefe' });
    assert.equal(await status(s1), 'closed');

    const s2 = await order(t2);
    await cash.applyDiscount(owner, s2, { percent: 50, reason: 'Cortesía' });
    assert.equal(await status(s2), 'open');
    // Lo que falta, en pesos exactos, también la deja en $0 y la cierra.
    await cash.applyDiscount(owner, s2, { amount: 30000, reason: 'Cortesía' });
    assert.equal(await status(s2), 'closed');
  });

  it('una mesa que ya quedó en $0 y abierta se cierra con el botón', async () => {
    const s3 = await order(t3);
    // Así quedaban antes: el descuento del 100 % sin cerrar la mesa.
    await db.query(`INSERT INTO session_discounts (business_id, session_id, amount, percent, reason, applied_by) VALUES ($1, $2, 60000, 100, 'Jefe', $3)`, [
      owner.businessId,
      s3,
      owner.id,
    ]);
    assert.equal(await status(s3), 'open');
    await assert.rejects(cash.closeZeroBalance(waiter, s3), { code: 'FORBIDDEN' });
    await cash.closeZeroBalance(owner, s3);
    assert.equal(await status(s3), 'closed');
    await assert.rejects(cash.closeZeroBalance(owner, s3), { code: 'CONFLICT' });
    const s4 = await order(t3);
    await assert.rejects(cash.closeZeroBalance(owner, s4), { code: 'CONFLICT' }, 'con saldo se cierra cobrando');
  });
});
