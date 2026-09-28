// Flujo completo contra una base de datos real. Necesita TEST_DATABASE_URL (una base vacía, solo para pruebas).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { CODE_WINDOW_MS, currentCode, kioskCode } from '../lib/codes';

const url = process.env.TEST_DATABASE_URL;

describe('asistencia con base de datos', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let db: typeof import('../lib/db');
  const stamp = Date.now();
  let businessId: string, slug: string, secret: string, anaId: string;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
  });

  after(async () => {
    await db.query("DELETE FROM businesses WHERE name LIKE 'Prueba %'");
    await db.closePool();
  });

  it('crea el negocio y sus empleados; el PIN no se repite', async () => {
    businessId = await store.createBusiness(`Prueba ${stamp} Azul Caribe`);
    const business = (await store.getBusiness(businessId))!;
    slug = business.slug;
    secret = business.kioskSecret;
    assert.match(slug, /^prueba-\d+-azul-caribe$/);
    assert.equal(await store.getBusiness('no-es-un-id'), null);

    anaId = await store.createEmployee(businessId, { name: ' Ana  Gómez ', pin: '1234', shiftStart: '08:00', shiftEnd: '15:00' });
    await assert.rejects(store.createEmployee(businessId, { name: 'Beto', pin: '1234', shiftStart: '', shiftEnd: '' }), { code: 'PIN_TAKEN' });
    await assert.rejects(store.createEmployee(businessId, { name: 'Beto', pin: '12a4', shiftStart: '', shiftEnd: '' }), { code: 'INVALID' });
    await assert.rejects(store.createEmployee(businessId, { name: 'Beto', pin: '5678', shiftStart: '08:00', shiftEnd: '' }), { code: 'INVALID' });
    await assert.rejects(store.createEmployee(businessId, { name: 'Beto', pin: '5678', shiftStart: '25:00', shiftEnd: '26:00' }), { code: 'INVALID' });

    const again = (await store.getBusiness(businessId))!;
    assert.deepEqual(again.employees.map((e) => e.name), ['Ana Gómez']);
    assert.equal((await store.listBusinesses()).find((b) => b.id === businessId)?.employees, 1);
  });

  it('la tablet da un código vigente; un código viejo o inventado no sirve', async () => {
    assert.equal(await store.getKiosk('no-existe'), null);
    const kiosk = (await store.getKiosk(secret))!;
    assert.equal(kiosk.slug, slug);
    assert.ok(kiosk.expiresInMs > 0 && kiosk.expiresInMs <= CODE_WINDOW_MS);

    const old = kioskCode(secret, slug, Math.floor(Date.now() / CODE_WINDOW_MS) - 10);
    await assert.rejects(store.punch(slug, old, '1234'), { code: 'CODE_EXPIRED' });
    await assert.rejects(store.punch(slug, 'inventado', '1234'), { code: 'CODE_EXPIRED' });
    await assert.rejects(store.punch(slug, kiosk.code, '9999'), { code: 'PIN_INVALID' });
    await assert.rejects(store.punch('no-existe', kiosk.code, '1234'), { code: 'NOT_FOUND' });
  });

  it('marca entrada, rechaza el doble escaneo, marca salida y da por olvidada una entrada vieja', async () => {
    const code = (at: Date) => currentCode(secret, slug, at.getTime()).code;
    const t0 = new Date();
    const entry = await store.punch(slug, code(t0), '1234', t0);
    assert.equal(entry.type, 'in');
    assert.equal(entry.employeeName, 'Ana Gómez');
    await assert.rejects(store.punch(slug, code(t0), '1234', new Date(t0.getTime() + 30_000)), { code: 'DOUBLE_SCAN' });

    const t1 = new Date(t0.getTime() + 7 * 3_600_000);
    const exit = await store.punch(slug, code(t1), '1234', t1);
    assert.equal(exit.type, 'out');
    assert.equal(exit.workedMinutes, 420);
    await assert.rejects(store.punch(slug, code(t1), '1234', new Date(t1.getTime() + 60_000)), { code: 'DOUBLE_SCAN' });

    const t2 = new Date(t0.getTime() + 24 * 3_600_000);
    assert.equal((await store.punch(slug, code(t2), '1234', t2)).type, 'in');
    const t3 = new Date(t0.getTime() + 42 * 3_600_000);
    assert.equal((await store.punch(slug, code(t3), '1234', t3)).type, 'in', 'la entrada sin salida de hace 18 h se da por olvidada');
  });

  it('dos toques al mismo tiempo no abren dos jornadas', async () => {
    const beto = await store.createEmployee(businessId, { name: 'Beto', pin: '5678', shiftStart: '', shiftEnd: '' });
    const now = new Date();
    const c = currentCode(secret, slug, now.getTime()).code;
    const results = await Promise.allSettled([store.punch(slug, c, '5678', now), store.punch(slug, c, '5678', now)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rows = await db.query('SELECT id FROM records WHERE employee_id = $1', [beto]);
    assert.equal(rows.length, 1);
  });

  it('el reporte lista jornadas por fechas y se corrigen o borran con rastro', async () => {
    const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
    const from = day(new Date());
    const to = day(new Date(Date.now() + 3 * 86_400_000));
    const list = (await store.listRecords(businessId, from, to)).filter((r) => r.employeeId === anaId);
    assert.equal(list.length, 3);
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
    // Otro negocio no puede tocar estas jornadas.
    const other = await store.createBusiness(`Prueba ${stamp} Otro`);
    await assert.rejects(store.deleteRecord(other, after[0].id), { code: 'NOT_FOUND' });
  });

  it('un empleado desactivado o un enlace de tablet cambiado ya no sirven', async () => {
    await store.updateEmployee(businessId, anaId, { name: 'Ana Gómez', pin: '', shiftStart: '08:00', shiftEnd: '15:00', isActive: false });
    const c = currentCode(secret, slug).code;
    await assert.rejects(store.punch(slug, c, '1234'), { code: 'PIN_INVALID' });

    await store.rotateKiosk(businessId);
    assert.equal(await store.getKiosk(secret), null);
    const fresh = (await store.getBusiness(businessId))!.kioskSecret;
    assert.notEqual(fresh, secret);
    assert.ok(await store.getKiosk(fresh));
  });
});
