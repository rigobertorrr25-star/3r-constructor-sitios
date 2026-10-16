// Barras del plano: el dueño las pone, las mueve y les cambia las sillas; un mesero solo las ve.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('barras del plano', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let floor: typeof import('../lib/floor');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor;
  let slug: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión ' + code);
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    floor = await import('../lib/floor');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Barras`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    slug = a.slug;
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Caridad', role: 'waiter', locationId: null, pin: '4826' });
    waiter = await login('0002', '4826');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('el dueño pone la barra, la estira y le cambia las sillas; el mesero la ve pero no la toca', async () => {
    await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'round' });
    const id = await floor.createFixture(owner, { zone: 'Salón', label: '', seats: 8, seatSide: 'bottom' });
    let [bar] = await floor.listFixtures(owner);
    assert.equal(bar.id, id);
    assert.equal(bar.label, 'Barra');
    assert.equal(bar.seats, 8);
    // Cae en un hueco libre, sin pisar la mesa 1.
    const [mesa] = await store.listTables(owner);
    assert.ok(bar.y >= mesa.y + mesa.h || bar.x >= mesa.x + mesa.w || bar.x + bar.w <= mesa.x);

    // Puede ser tan larga como el local, pero no salirse del lienzo.
    await floor.saveFixtureLayout(owner, [{ id, x: 900, y: 600, w: 2000, h: 90 }]);
    [bar] = await floor.listFixtures(waiter);
    assert.deepEqual({ x: bar.x, y: bar.y, w: bar.w, h: bar.h }, { x: 0, y: 550, w: 1000, h: 90 });

    await floor.updateFixture(owner, id, { label: 'Barra principal', seats: 10, seatSide: 'top' });
    [bar] = await floor.listFixtures(owner);
    assert.equal(bar.label, 'Barra principal');
    assert.equal(bar.seatSide, 'top');

    await assert.rejects(floor.createFixture(waiter, { zone: 'Salón', label: 'Otra', seats: 2, seatSide: 'bottom' }), /permiso/);
    await assert.rejects(floor.updateFixture(owner, id, { label: 'X', seats: 31, seatSide: 'top' }), /de 0 a 30/);
    await assert.rejects(floor.updateFixture(owner, id, { label: 'X', seats: 4, seatSide: 'diagonal' }), /lado/);

    await floor.removeFixture(owner, id);
    assert.equal((await floor.listFixtures(owner)).length, 0);
  });

  it('agrega 25 mesas de una vez: numeradas seguidas, dentro del lienzo y sin montarse', async () => {
    const created = await store.createTables(owner, { zone: 'Salón', count: 25, capacity: 4, shape: 'square' });
    assert.equal(created.length, 25);
    assert.deepEqual(created.slice(0, 2), ['2', '3']); // la mesa 1 ya existía
    assert.equal(created.at(-1), '26');
    const tables = (await store.listTables(owner)).filter((t) => t.zone === 'Salón');
    assert.equal(tables.length, 26);
    for (const t of tables) assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1000 && t.y + t.h <= 640, `mesa ${t.number} fuera del lienzo`);
    for (const a of tables)
      for (const b of tables)
        if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `mesas ${a.number} y ${b.number} montadas`);
    await assert.rejects(store.createTables(owner, { zone: 'Salón', count: 61, capacity: 4, shape: 'square' }), /de 1 a 60/);
    await assert.rejects(store.createTables(waiter, { zone: 'Salón', count: 2, capacity: 4, shape: 'square' }), /permiso/);
  });

  it('quita varias mesas elegidas y luego todas, menos las abiertas', async () => {
    let tables = (await store.listTables(owner)).filter((t) => t.zone === 'Salón');
    const byNumber = (n: string) => tables.find((t) => t.number === n)!.id;
    const five = ['2', '3', '4', '5', '6'].map(byNumber);
    assert.deepEqual(await store.removeTables(owner, five), { removed: 5, kept: [] });
    tables = await store.listTables(owner);
    assert.equal(tables.length, 21);
    assert.ok(!tables.some((t) => ['2', '3', '4', '5', '6'].includes(t.number)));

    await store.openTable(owner, byNumber('7'), { guests: 2 });
    await assert.rejects(store.removeTables(waiter, 'all'), /permiso/);
    await assert.rejects(store.removeTables(owner, []), /Elige/);
    assert.deepEqual(await store.removeTables(owner, 'all'), { removed: 20, kept: ['7'] });
    assert.deepEqual((await store.listTables(owner)).map((t) => t.number), ['7']);

    // Después se pueden volver a crear: la numeración sigue desde la que quedó.
    assert.deepEqual(await store.createTables(owner, { zone: 'Salón', count: 2, capacity: 4, shape: 'round' }), ['8', '9']);
  });
});
