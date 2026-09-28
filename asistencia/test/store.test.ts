// Flujo completo contra una base de datos real. Necesita TEST_DATABASE_URL (una base vacía, solo para pruebas).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { CODE_WINDOW_MS, currentCode, kioskCode } from '../lib/codes';

const url = process.env.TEST_DATABASE_URL;

describe('asistencia con base de datos', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let db: typeof import('../lib/db');
  const stamp = Date.now();
  let businessId: string, slug: string, secret: string, anaId: string, betoId: string;
  const code = (at = new Date()) => currentCode(secret, slug, at.getTime()).code;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
  });

  after(async () => {
    await db.query("DELETE FROM businesses WHERE name LIKE 'Prueba %'");
    await db.closePool();
  });

  it('crea el negocio, sus turnos y sus empleados (sin PIN)', async () => {
    businessId = await store.createBusiness(`Prueba ${stamp} Azul Caribe`);
    const business = (await store.getBusiness(businessId))!;
    slug = business.slug;
    secret = business.kioskSecret;
    assert.match(slug, /^prueba-\d+-azul-caribe$/);
    assert.deepEqual(business.shifts, []);
    assert.equal(await store.getBusiness('no-es-un-id'), null);

    await store.updateShifts(businessId, [
      { start: '14:00', end: '21:00' },
      { start: '', end: '' },
      { start: '08:00', end: '15:00' },
      { start: '11:00', end: '18:00' },
    ]);
    assert.deepEqual((await store.getBusiness(businessId))!.shifts.map((s) => s.start), ['08:00', '11:00', '14:00'], 'ordenados, sin filas vacías');
    await assert.rejects(store.updateShifts(businessId, [{ start: '08:00', end: '' }]), { code: 'INVALID' });
    await assert.rejects(store.updateShifts(businessId, [{ start: '08:00', end: '08:00' }]), { code: 'INVALID' });
    await assert.rejects(store.updateShifts(businessId, [{ start: '08:00', end: '15:00' }, { start: '08:00', end: '16:00' }]), { code: 'INVALID' });
    await assert.rejects(store.updateShifts(businessId, [{ start: '25:00', end: '26:00' }]), { code: 'INVALID' });

    anaId = await store.createEmployee(businessId, { name: ' Ana  Gómez ' });
    betoId = await store.createEmployee(businessId, { name: 'Beto' });
    await assert.rejects(store.createEmployee(businessId, { name: 'x' }), { code: 'INVALID' });
    const again = (await store.getBusiness(businessId))!;
    assert.deepEqual(again.employees.map((e) => [e.name, e.hasPin]), [['Ana Gómez', false], ['Beto', false]]);
  });

  it('la lista de nombres solo se ve con un código vigente de la tablet', async () => {
    assert.equal(await store.getKiosk('no-existe'), null);
    const kiosk = (await store.getKiosk(secret))!;
    assert.equal(kiosk.slug, slug);
    assert.ok(kiosk.expiresInMs > 0 && kiosk.expiresInMs <= CODE_WINDOW_MS);

    const screen = await store.getPunchScreen(slug, kiosk.code);
    assert.deepEqual(screen.employees.map((e) => e.name), ['Ana Gómez', 'Beto']);
    const old = kioskCode(secret, slug, Math.floor(Date.now() / CODE_WINDOW_MS) - 10);
    await assert.rejects(store.getPunchScreen(slug, old), { code: 'CODE_EXPIRED' });
    await assert.rejects(store.getPunchScreen(slug, 'inventado'), { code: 'CODE_EXPIRED' });
    await assert.rejects(store.getPunchScreen('no-existe', kiosk.code), { code: 'NOT_FOUND' });
    await assert.rejects(store.punch(slug, old, anaId, '1234'), { code: 'CODE_EXPIRED' });
  });

  it('la primera vez el empleado crea su PIN y queda marcada la entrada', async () => {
    const t0 = new Date();
    const first = await store.punch(slug, code(t0), anaId, '4321', t0);
    assert.equal(first.type, 'in');
    assert.equal(first.pinCreated, true);
    assert.equal(first.employeeName, 'Ana Gómez');
    assert.equal((await store.getBusiness(businessId))!.employees.find((e) => e.id === anaId)?.hasPin, true);

    // Dos empleados pueden tener el mismo PIN: cada uno toca su nombre primero.
    const beto = await store.punch(slug, code(t0), betoId, '4321', t0);
    assert.equal(beto.pinCreated, true);

    await assert.rejects(store.punch(slug, code(t0), anaId, '4321', new Date(t0.getTime() + 30_000)), { code: 'DOUBLE_SCAN' });
    await assert.rejects(store.punch(slug, code(t0), 'no-es-un-id', '4321', t0), { code: 'EMPLOYEE' });
  });

  it('después marca con su PIN: entrada, salida y entrada olvidada', async () => {
    const base = Date.now();
    const t1 = new Date(base + 7 * 3_600_000);
    await assert.rejects(store.punch(slug, code(t1), anaId, '0000', t1), { code: 'PIN_INVALID' });
    const exit = await store.punch(slug, code(t1), anaId, '4321', t1);
    assert.equal(exit.type, 'out');
    assert.equal(exit.pinCreated, false);
    assert.ok(Math.abs(exit.workedMinutes! - 420) <= 1);

    const t2 = new Date(base + 24 * 3_600_000);
    assert.equal((await store.punch(slug, code(t2), anaId, '4321', t2)).type, 'in');
    const t3 = new Date(base + 42 * 3_600_000);
    assert.equal((await store.punch(slug, code(t3), anaId, '4321', t3)).type, 'in', 'la entrada sin salida de hace 18 h se da por olvidada');
  });

  it('5 PIN equivocados bloquean 15 minutos; reiniciar el PIN lo desbloquea', async () => {
    const now = new Date(Date.now() + 50 * 3_600_000);
    for (let i = 0; i < 4; i++) await assert.rejects(store.punch(slug, code(now), betoId, '9999', now), { code: 'PIN_INVALID' });
    await assert.rejects(store.punch(slug, code(now), betoId, '9999', now), { code: 'LOCKED' });
    await assert.rejects(store.punch(slug, code(now), betoId, '4321', now), { code: 'LOCKED' }, 'ni con el PIN correcto');
    const later = new Date(now.getTime() + 16 * 60_000);
    assert.equal((await store.punch(slug, code(later), betoId, '4321', later)).type, 'in', 'pasados 15 minutos vuelve a servir');

    await store.resetPin(businessId, betoId);
    assert.equal((await store.getBusiness(businessId))!.employees.find((e) => e.id === betoId)?.hasPin, false);
    const after = new Date(later.getTime() + 8 * 3_600_000);
    const res = await store.punch(slug, code(after), betoId, '1111', after);
    assert.equal(res.pinCreated, true);
    assert.equal(res.type, 'out');
  });

  it('dos toques al mismo tiempo no abren dos jornadas', async () => {
    const cata = await store.createEmployee(businessId, { name: 'Cata' });
    const now = new Date();
    const results = await Promise.allSettled([store.punch(slug, code(now), cata, '5678', now), store.punch(slug, code(now), cata, '5678', now)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await db.query('SELECT id FROM records WHERE employee_id = $1', [cata])).length, 1);
  });

  it('el reporte lista jornadas por fechas y se corrigen o borran con rastro', async () => {
    const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
    const from = day(new Date());
    const to = day(new Date(Date.now() + 3 * 86_400_000));
    const list = (await store.listRecords(businessId, from, to)).filter((r) => r.employeeId === anaId);
    assert.equal(list.length, 3);
    assert.equal(list[0].employee.name, 'Ana Gómez');
    assert.ok(list[0].clockOut);
    const forgotten = list[1];
    assert.equal(forgotten.clockOut, null);

    await assert.rejects(store.listRecords(businessId, '2026-01-01', '2026-12-31'), { code: 'INVALID' });
    await assert.rejects(store.listRecords(businessId, 'x', to), { code: 'INVALID' });

    const clockIn = new Date(forgotten.clockIn);
    await assert.rejects(store.updateRecord(businessId, forgotten.id, clockIn, new Date(clockIn.getTime() - 60_000)), { code: 'INVALID' });
    await assert.rejects(store.updateRecord(businessId, forgotten.id, clockIn, new Date(clockIn.getTime() + 25 * 3_600_000)), { code: 'INVALID' });
    await store.updateRecord(businessId, forgotten.id, clockIn, new Date(clockIn.getTime() + 7 * 3_600_000));
    await store.deleteRecord(businessId, list[2].id);

    const after = (await store.listRecords(businessId, from, to)).filter((r) => r.employeeId === anaId);
    assert.equal(after.length, 2);
    assert.ok(after[1].editedAt);
    const changes = await db.query<{ action: string }>('SELECT action FROM record_changes WHERE record_id = ANY($1) ORDER BY created_at', [
      [forgotten.id, list[2].id],
    ]);
    assert.deepEqual(changes.map((c) => c.action), ['edited', 'deleted']);
    const other = await store.createBusiness(`Prueba ${stamp} Otro`);
    await assert.rejects(store.deleteRecord(other, after[0].id), { code: 'NOT_FOUND' });
    await assert.rejects(store.resetPin(other, anaId), { code: 'NOT_FOUND' }, 'otro negocio no reinicia PIN ajenos');
  });

  it('un empleado desactivado o un enlace de tablet cambiado ya no sirven', async () => {
    await store.updateEmployee(businessId, anaId, { name: 'Ana Gómez', isActive: false });
    await assert.rejects(store.punch(slug, code(), anaId, '4321'), { code: 'EMPLOYEE' });
    assert.ok(!(await store.getPunchScreen(slug, code())).employees.some((e) => e.id === anaId), 'no sale en la lista');

    await store.rotateKiosk(businessId);
    assert.equal(await store.getKiosk(secret), null);
    const fresh = (await store.getBusiness(businessId))!.kioskSecret;
    assert.notEqual(fresh, secret);
    assert.ok(await store.getKiosk(fresh));
  });
});
