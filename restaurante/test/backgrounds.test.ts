// Fondo propio de cada restaurante. Necesita TEST_DATABASE_URL (una base vacía, solo para pruebas).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('fondo del restaurante', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let db: typeof import('../lib/db');
  let bg: typeof import('../lib/backgrounds');
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  let owner: import('../lib/store').StaffSession;
  let waiter: import('../lib/store').StaffSession;
  let slug: string;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    bg = await import('../lib/backgrounds');
    const created = await store.createBusiness({ name: `Prueba ${stamp} Fondo`, locationName: 'Centro', ownerName: 'Ana Dueña', ownerPin: '2580' });
    slug = created.slug;
    const lo = await store.loginStaff({ slug, code: '0001', pin: '2580' });
    if (lo.kind !== 'ok') throw new Error('sin dueño');
    owner = (await store.getStaffSession(lo.staffId, lo.locationId, lo.epoch))!;
    await store.createStaff(owner, { name: 'Beto Mesero', role: 'waiter', locationId: null, pin: '1357' });
    const lw = await store.loginStaff({ slug, code: '0002', pin: '1357' });
    if (lw.kind !== 'ok') throw new Error('sin mesero');
    waiter = (await store.getStaffSession(lw.staffId, lw.locationId, lw.epoch))!;
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('reconoce fotos de verdad por sus primeros bytes', () => {
    assert.equal(bg.imageMime(JPG), 'image/jpeg');
    assert.equal(bg.imageMime(PNG), 'image/png');
    assert.equal(bg.imageMime(new TextEncoder().encode('RIFF1234WEBPVP8 ')), 'image/webp');
    assert.equal(bg.imageMime(new TextEncoder().encode('<svg onload=alert(1)>')), null);
  });

  it('solo el dueño lo cambia; se ve en la lista de ingreso y en la sesión', async () => {
    assert.equal(owner.background, null);
    await assert.rejects(bg.saveBackground(waiter, JPG), { code: 'FORBIDDEN' });
    await assert.rejects(bg.saveBackground(owner, new TextEncoder().encode('no soy foto')), { code: 'INVALID' });
    await assert.rejects(bg.saveBackground(owner, new Uint8Array(bg.BACKGROUND_MAX_BYTES + 1).fill(0xff)), { code: 'INVALID' });

    await bg.saveBackground(owner, JPG);
    const first = await bg.getBackground(slug);
    assert.equal(first?.mime, 'image/jpeg');
    assert.deepEqual(new Uint8Array(first!.image), JPG);
    const listed = (await store.listActiveBusinesses()).find((b) => b.slug === slug);
    assert.equal(typeof listed?.background, 'number');

    await bg.saveBackground(owner, PNG);
    const v2 = await bg.backgroundVersion(owner.businessId);
    assert.ok(v2 && v2 >= listed!.background!, 'al cambiarla cambia la versión (y la dirección)');
    assert.equal((await bg.getBackground(slug))?.mime, 'image/png');

    await bg.removeBackground(owner);
    assert.equal(await bg.getBackground(slug), null);
    assert.equal(await bg.backgroundVersion(owner.businessId), null);
    const audit = await db.query<{ summary: string }>(`SELECT summary FROM audit_events WHERE business_id = $1 AND action = 'business.background' ORDER BY created_at`, [owner.businessId]);
    assert.equal(audit.length, 3);
  });
});
