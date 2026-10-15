// Módulo 01 contra una base de datos real. Necesita TEST_DATABASE_URL (una base vacía, solo para pruebas).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 01: núcleo y mesas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let db: typeof import('../lib/db');
  // Marca única por archivo (corren en paralelo): Date.now() solo puede repetirse entre dos archivos.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  let businessId: string, slug: string, mainId: string, ownerId: string;
  let owner: import('../lib/store').Actor;
  let waiter: import('../lib/store').Actor;
  let cashier: import('../lib/store').Actor;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('valida el PIN', () => {
    for (const pin of ['123', '1234567', 'abcd', '0000', '1234', '4321', '56789']) assert.throws(() => store.validatePin(pin), { code: 'INVALID' }, pin);
    store.validatePin('2580');
    store.validatePin('918273');
  });

  it('3R crea el negocio con su sede y su dueño (código 0001)', async () => {
    const created = await store.createBusiness({ name: `Prueba ${stamp} Café Ñandú`, locationName: 'Centro', ownerName: 'Ana Dueña', ownerPin: '2580' });
    ({ businessId, slug, ownerId } = created);
    mainId = created.locationId;
    assert.equal(created.ownerCode, '0001');
    assert.match(slug, /^prueba-\d+-cafe-nandu$/);
    const again = await store.createBusiness({ name: `Prueba ${stamp} Café Ñandú`, locationName: '', ownerName: 'Otro', ownerPin: '2580' });
    assert.equal(again.slug, `${slug}-2`, 'el enlace no se repite');
    await assert.rejects(store.createBusiness({ name: 'x', locationName: 'A', ownerName: 'Ana', ownerPin: '2580' }), { code: 'INVALID' });
  });

  it('el dueño entra con código y PIN; 5 PIN malos bloquean 15 min', async () => {
    await assert.rejects(store.loginStaff({ slug: 'no-existe', code: '0001', pin: '2580' }), { code: 'NOT_FOUND' });
    await assert.rejects(store.loginStaff({ slug, code: '0001', pin: '9999' }), { code: 'INVALID' });
    const ok = await store.loginStaff({ slug, code: '0001', pin: '2580' });
    assert.equal(ok.kind, 'ok');
    if (ok.kind !== 'ok') return;
    assert.equal(ok.locationId, mainId, 'con una sola sede entra directo');
    const session = (await store.getStaffSession(ok.staffId, ok.locationId, ok.epoch))!;
    assert.equal(session.role, 'owner');
    assert.equal(session.businessSlug, slug);
    owner = session;
    assert.equal(await store.getStaffSession(ok.staffId, ok.locationId, ok.epoch + 1), null, 'una sesión vieja no vale');
  });

  it('el dueño arma su equipo; el código sale solo y los roles se respetan', async () => {
    const w = await store.createStaff(owner, { name: 'Beto Mesero', role: 'waiter', locationId: mainId, pin: '1357' });
    const c = await store.createStaff(owner, { name: 'Caro Caja', role: 'cashier', locationId: null, pin: '2468' });
    const m = await store.createStaff(owner, { name: 'Mario Admin', role: 'manager', locationId: mainId, pin: '9512' });
    assert.deepEqual([w.code, c.code, m.code], ['0002', '0003', '0004']);
    await assert.rejects(store.createStaff(owner, { name: 'Malo', role: 'chef', locationId: null, pin: '1357' }), { code: 'INVALID' });

    const loginW = await store.loginStaff({ slug, code: '2', pin: '1357' }).catch(() => null);
    assert.equal(loginW, null, 'el código va completo (0002)');
    const lw = await store.loginStaff({ slug, code: '0002', pin: '1357' });
    assert.equal(lw.kind, 'ok');
    if (lw.kind === 'ok') waiter = (await store.getStaffSession(lw.staffId, lw.locationId, lw.epoch))!;
    const lc = await store.loginStaff({ slug, code: '0003', pin: '2468' });
    if (lc.kind === 'ok') cashier = (await store.getStaffSession(lc.staffId, lc.locationId, lc.epoch))!;

    await assert.rejects(store.listStaff(waiter), { code: 'FORBIDDEN' });
    await assert.rejects(store.createStaff(waiter, { name: 'Yo', role: 'owner', locationId: null, pin: '1357' }), { code: 'FORBIDDEN' });

    const lm = await store.loginStaff({ slug, code: '0004', pin: '9512' });
    assert.equal(lm.kind, 'ok');
    if (lm.kind !== 'ok') return;
    const manager = (await store.getStaffSession(lm.staffId, lm.locationId, lm.epoch))!;
    await assert.rejects(store.createStaff(manager, { name: 'Otro Admin', role: 'manager', locationId: null, pin: '1357' }), { code: 'FORBIDDEN' });
    await assert.rejects(store.updateStaff(manager, ownerId, { name: 'Ana', role: 'owner', locationId: null, isActive: false }), { code: 'FORBIDDEN' });
    await assert.rejects(store.updateStaff(owner, ownerId, { name: 'Ana', role: 'owner', locationId: null, isActive: false }), { code: 'INVALID' });

    // Cambiar el PIN cierra la sesión abierta.
    await store.resetPin(manager, waiter.id, '8642');
    assert.equal(await store.getStaffSession(lw.kind === 'ok' ? lw.staffId : '', mainId, lw.kind === 'ok' ? lw.epoch : 0), null);
    const again = await store.loginStaff({ slug, code: '0002', pin: '8642' });
    if (again.kind === 'ok') waiter = (await store.getStaffSession(again.staffId, again.locationId, again.epoch))!;
    assert.equal(waiter.role, 'waiter');
  });

  it('la pantalla de ingreso lista los nombres activos y no deja dos iguales', async () => {
    await assert.rejects(store.createStaff(owner, { name: 'beto mesero', role: 'waiter', locationId: null, pin: '1357' }), { code: 'CONFLICT' });
    const tmp = await store.createStaff(owner, { name: 'Eva Temporal', role: 'waiter', locationId: null, pin: '1357' });
    await assert.rejects(store.updateStaff(owner, tmp.id, { name: 'Caro Caja', role: 'waiter', locationId: null, isActive: true }), { code: 'CONFLICT' });
    await store.updateStaff(owner, tmp.id, { name: 'Eva Temporal', role: 'waiter', locationId: null, isActive: false });
    const people = await store.listLoginPeople(slug);
    assert.ok(people.some((p) => p.name === 'Beto Mesero' && p.code === '0002' && p.role === 'waiter'));
    assert.ok(!people.some((p) => p.name === 'Eva Temporal'), 'quien está desactivado no sale');
    assert.deepEqual(Object.keys(people[0]).sort(), ['code', 'name', 'role'], 'nada del PIN ni otros datos');
    // Con otra persona desactivada con el mismo nombre, sí se puede crear.
    const eva = await store.createStaff(owner, { name: 'Eva Temporal', role: 'waiter', locationId: null, pin: '2468' });
    await store.updateStaff(owner, eva.id, { name: 'Eva Temporal', role: 'waiter', locationId: null, isActive: false });
  });

  it('bloquea tras 5 PIN equivocados', async () => {
    const extra = await store.createStaff(owner, { name: 'Dani Barra', role: 'bar', locationId: mainId, pin: '7531' });
    for (let i = 0; i < 5; i++) await assert.rejects(store.loginStaff({ slug, code: extra.code, pin: '0101' }), { code: 'INVALID' });
    await assert.rejects(store.loginStaff({ slug, code: extra.code, pin: '7531' }), { code: 'LOCKED' }, 'ni con el PIN bueno');
    await store.resetPin(owner, extra.id, '7532');
    assert.equal((await store.loginStaff({ slug, code: extra.code, pin: '7532' })).kind, 'ok', 'el nuevo PIN desbloquea');
  });

  it('con dos sedes, quien trabaja en todas elige sede', async () => {
    const northId = await store.createLocation(owner, { name: 'Norte' });
    await assert.rejects(store.createLocation(owner, { name: 'Norte' }), { code: 'CONFLICT' });
    await assert.rejects(store.createLocation(waiter, { name: 'Sur' }), { code: 'FORBIDDEN' });
    const choose = await store.loginStaff({ slug, code: '0003', pin: '2468' });
    assert.equal(choose.kind, 'choose-location');
    const picked = await store.loginStaff({ slug, code: '0003', pin: '2468', locationId: northId });
    assert.ok(picked.kind === 'ok' && picked.locationId === northId);
    // El mesero es de Centro: siempre entra a Centro, y no puede abrir sesión en Norte.
    const w = await store.loginStaff({ slug, code: '0002', pin: '8642', locationId: northId });
    assert.ok(w.kind === 'ok' && w.locationId === mainId);
    if (w.kind === 'ok') assert.equal(await store.getStaffSession(w.staffId, northId, w.epoch), null);
  });

  it('plano: mesas con hueco libre, número único y solo de la propia sede', async () => {
    const t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    const t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 2, shape: 'round' });
    await store.createTable(owner, { zone: 'Terraza', number: '10', capacity: 6, shape: 'long' });
    await assert.rejects(store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' }), { code: 'CONFLICT' });
    await assert.rejects(store.createTable(waiter, { zone: 'Salón', number: '3', capacity: 4, shape: 'square' }), { code: 'FORBIDDEN' });
    const tables = await store.listTables(owner);
    assert.deepEqual(tables.map((t) => t.number), ['1', '2', '10']);
    const [a, b] = tables;
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, 'no se montan');

    await store.saveLayout(owner, [{ id: t1, x: 5000, y: -3, w: 110, h: 110 }]);
    const moved = (await store.listTables(owner)).find((t) => t.id === t1)!;
    assert.deepEqual([moved.x, moved.y], [store.CANVAS.width - 110, 0], 'se queda dentro del lienzo');

    // Desde otra sede, la mesa no existe.
    const north = { ...cashier, locationId: (await store.listLocations(businessId)).find((l) => l.name === 'Norte')!.id };
    await assert.rejects(store.openTable(north, t2, { guests: 2 }), { code: 'NOT_FOUND' });
    await assert.rejects(store.saveLayout({ ...owner, locationId: north.locationId }, [{ id: t1, x: 1, y: 1, w: 110, h: 110 }]), { code: 'NOT_FOUND' });
  });

  it('abrir, pedir cuenta, mover y cerrar una mesa (con rastro)', async () => {
    const [t1, t2, t10] = await store.listTables(waiter);
    const sessionId = await store.openTable(waiter, t1.id, { guests: 3, notes: 'Cumpleaños' });
    await assert.rejects(store.openTable(waiter, t1.id, { guests: 2 }), { code: 'CONFLICT' }, 'no se abre dos veces');
    // Dos meseros al mismo tiempo sobre la misma mesa: solo uno gana.
    const race = await Promise.allSettled([store.openTable(waiter, t2.id, { guests: 2 }), store.openTable(cashier, t2.id, { guests: 2 })]);
    assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);

    let view = (await store.listTables(waiter)).find((t) => t.id === t1.id)!;
    assert.equal(view.status, 'open');
    assert.equal(view.session?.openedBy, 'Beto Mesero');

    await store.moveSession(waiter, sessionId, t10.id);
    await assert.rejects(store.moveSession(waiter, sessionId, t2.id), { code: 'CONFLICT' }, 'no se pasa a una mesa ocupada');
    view = (await store.listTables(waiter)).find((t) => t.id === t10.id)!;
    assert.equal(view.session?.id, sessionId);
    assert.equal((await store.listTables(waiter)).find((t) => t.id === t1.id)!.status, 'free');

    await assert.rejects(store.closeTable(waiter, sessionId, 'x'), { code: 'FORBIDDEN' }, 'el mesero no cierra');
    await assert.rejects(store.closeTable(cashier, sessionId), { code: 'INVALID' }, 'sin cuenta pedida exige motivo');
    await store.setBill(waiter, sessionId, true);
    assert.equal((await store.listTables(waiter)).find((t) => t.id === t10.id)!.status, 'bill');
    await store.closeTable(cashier, sessionId);
    await assert.rejects(store.closeTable(cashier, sessionId), { code: 'NOT_FOUND' });
    await assert.rejects(store.removeTable(owner, t2.id), { code: 'CONFLICT' }, 'no se quita una mesa abierta');

    const events = await store.listAudit(owner, { limit: 50 });
    const actions = events.map((e) => e.action);
    for (const a of ['table.open', 'table.move', 'table.bill', 'table.close', 'auth.locked', 'staff.pin_reset']) assert.ok(actions.includes(a), a);
    await assert.rejects(store.listAudit(waiter), { code: 'FORBIDDEN' });
  });

  it('la auditoría no se puede cambiar ni borrar', async () => {
    await assert.rejects(db.query('UPDATE audit_events SET summary = $2 WHERE business_id = $1', [businessId, 'nada']), /no se puede/);
    await assert.rejects(db.query('DELETE FROM audit_events WHERE business_id = $1', [businessId]), /no se puede/);
  });

  it('un negocio suspendido no deja entrar a nadie', async () => {
    await store.setBusinessActive(businessId, false);
    await assert.rejects(store.loginStaff({ slug, code: '0001', pin: '2580' }), { code: 'FORBIDDEN' });
    assert.equal(await store.getStaffSession(owner.id, owner.locationId, 0), null);
    await store.setBusinessActive(businessId, true);
  });
});
