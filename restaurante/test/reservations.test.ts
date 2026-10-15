// Módulo 11 (reservas y carta pública) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 11: reservas y carta pública', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let res: typeof import('../lib/reservations');
  let fin: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, slug: string, t1: string, t2: string;
  // Marca única por archivo (corren en paralelo).
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const tz = 'America/Bogota';
  let tomorrow: string;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    res = await import('../lib/reservations');
    fin = await import('../lib/finance');
    tomorrow = fin.addDays(fin.todayIn(tz), 1);
    const a = await store.createBusiness({ name: `Prueba ${stamp} Reservas`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    slug = a.slug;
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login('0002', '1357');
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 6, shape: 'square' });
    const cat = await orders.saveCategory(owner, { name: 'Entradas', station: 'kitchen' });
    await orders.saveProduct(owner, { categoryId: cat, name: 'Patacones', price: 15000 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('teléfonos', () => {
    assert.equal(res.normalizePhone('+57 310 123 4567'), '573101234567');
    assert.throws(() => res.normalizePhone('12'), { code: 'INVALID' });
  });

  it('el equipo reserva; la misma mesa no se cruza', async () => {
    await res.createReservation(waiter, { name: 'Laura Gómez', phone: '3101234567', date: tomorrow, time: '20:00', guests: 4, tableId: t1, deposit: 50000 });
    await assert.rejects(res.createReservation(waiter, { name: 'Otro', phone: '3009998877', date: tomorrow, time: '21:00', guests: 2, tableId: t1 }), { code: 'CONFLICT' });
    await res.createReservation(waiter, { name: 'Otro', phone: '3009998877', date: tomorrow, time: '22:30', guests: 2, tableId: t1 });
    await assert.rejects(res.createReservation(waiter, { name: 'Ayer', phone: '3009998877', date: '2020-01-01', time: '20:00', guests: 2 }), { code: 'INVALID' });
    const list = await res.listReservations(waiter, tomorrow);
    assert.deepEqual(list.day.map((r) => [r.customerName, r.tableNumber, r.status]), [
      ['Laura Gómez', '1', 'confirmed'],
      ['Otro', '1', 'confirmed'],
    ]);
    assert.equal(list.day[0].deposit, 50000);
  });

  it('el cliente pide en línea; el equipo confirma y le asigna mesa', async () => {
    const r = await res.requestReservation(slug, { name: 'Pedro', phone: '311 555 0000', date: tomorrow, time: '19:00', guests: 3, notes: 'Cumpleaños' });
    assert.equal(r.locationName, 'Centro');
    await assert.rejects(res.requestReservation(slug, { name: 'Grande', phone: '3115550001', date: tomorrow, time: '19:00', guests: 25 }), { code: 'INVALID' });
    await assert.rejects(res.requestReservation('no-existe', { name: 'X', phone: '3115550002', date: tomorrow, time: '19:00', guests: 2 }), { code: 'NOT_FOUND' });
    const list = await res.listReservations(owner, tomorrow);
    assert.equal(list.requested.length, 1);
    await res.updateReservation(owner, r.id, { status: 'confirmed', tableId: t2 });
    assert.equal((await res.listReservations(owner, tomorrow)).requested.length, 0);
    await res.updatePublicSettings(owner, { phone: '3101112233', reservationsEnabled: false });
    await assert.rejects(res.requestReservation(slug, { name: 'Tarde', phone: '3115550003', date: tomorrow, time: '19:00', guests: 2 }), { code: 'FORBIDDEN' });
  });

  it('al llegar se abre la mesa', async () => {
    const list = await res.listReservations(waiter, tomorrow);
    const pedro = list.day.find((r) => r.customerName === 'Pedro')!;
    const sessionId = await res.seatReservation(waiter, pedro.id);
    const table = (await store.listTables(waiter)).find((t) => t.id === t2)!;
    assert.equal(table.session?.id, sessionId);
    assert.equal(table.session?.guests, 3);
    assert.match(table.session?.notes ?? '', /Reserva de Pedro · Cumpleaños/);
    await assert.rejects(res.seatReservation(waiter, pedro.id), { code: 'CONFLICT' });
    const laura = list.day.find((r) => r.customerName === 'Laura Gómez')!;
    await res.updateReservation(waiter, laura.id, { status: 'no_show' });
    assert.equal((await res.listReservations(waiter, tomorrow)).day.find((r) => r.id === laura.id)!.status, 'no_show');
  });

  it('carta pública', async () => {
    const menu = (await res.publicMenu(slug))!;
    assert.equal(menu.products[0].name, 'Patacones');
    assert.equal(menu.phone, '3101112233');
    assert.equal(menu.reservations, false);
    assert.equal(await res.publicMenu('no-existe'), null);
  });
});
