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
});
