// Foto de cada producto de la carta. Necesita TEST_DATABASE_URL (una base vacía, solo para pruebas).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('fotos de los productos', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let db: typeof import('../lib/db');
  let orders: typeof import('../lib/orders');
  let photos: typeof import('../lib/product-photos');
  let reservations: typeof import('../lib/reservations');
  type Actor = import('../lib/store').Actor;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  let owner: Actor, waiter: Actor, other: Actor;
  let slug: string;
  let ceviche: string;

  const login = async (s: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug: s, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    photos = await import('../lib/product-photos');
    reservations = await import('../lib/reservations');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Fotos`, locationName: 'Centro', ownerName: 'Ana Dueña', ownerPin: '2580' });
    slug = a.slug;
    owner = await login(slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Beto Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login(slug, '0002', '1357');
    const b = await store.createBusiness({ name: `Prueba ${stamp} Otro`, locationName: 'Centro', ownerName: 'Otra Dueña', ownerPin: '2580' });
    other = await login(b.slug, '0001', '2580');
    const food = await orders.saveCategory(owner, { name: 'Entradas', station: 'kitchen' });
    ceviche = await orders.saveProduct(owner, { categoryId: food, name: 'Ceviche', price: 28000 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('solo quien edita la carta la cambia, y solo en su propio restaurante', async () => {
    await assert.rejects(photos.saveProductPhoto(waiter, ceviche, JPG), { code: 'FORBIDDEN' });
    await assert.rejects(photos.saveProductPhoto(other, ceviche, JPG), { code: 'NOT_FOUND' });
    await assert.rejects(photos.saveProductPhoto(owner, ceviche, new TextEncoder().encode('<svg onload=alert(1)>')), { code: 'INVALID' });
    await assert.rejects(photos.saveProductPhoto(owner, ceviche, new Uint8Array(photos.PRODUCT_PHOTO_MAX_BYTES + 1).fill(0xff)), { code: 'INVALID' });
    await photos.removeProductPhoto(other, ceviche);
    assert.equal((await orders.getMenu(owner.businessId)).products[0].photo, null);
  });

  it('se ve en la carta del mesero y en la carta QR; al cambiarla cambia la dirección', async () => {
    await photos.saveProductPhoto(owner, ceviche, JPG);
    const v1 = (await orders.getMenu(owner.businessId)).products[0].photo;
    assert.equal(typeof v1, 'number');
    assert.deepEqual(new Uint8Array((await photos.getProductPhoto(ceviche))!.image), JPG);
    assert.equal((await reservations.publicMenu(slug))!.products[0].photo, v1);

    await photos.saveProductPhoto(owner, ceviche, PNG);
    const v2 = (await orders.getMenu(owner.businessId)).products[0].photo!;
    assert.ok(v2 > v1!);
    assert.equal((await photos.getProductPhoto(ceviche))?.mime, 'image/png');

    // Un restaurante apagado no muestra fotos.
    await db.query(`UPDATE businesses SET is_active = false WHERE id = $1`, [owner.businessId]);
    assert.equal(await photos.getProductPhoto(ceviche), null);
    await db.query(`UPDATE businesses SET is_active = true WHERE id = $1`, [owner.businessId]);

    await photos.removeProductPhoto(owner, ceviche);
    assert.equal(await photos.getProductPhoto(ceviche), null);
    assert.equal(await photos.getProductPhoto('no-es-un-id'), null);
    const audit = await db.query<{ summary: string }>(`SELECT summary FROM audit_events WHERE business_id = $1 AND action = 'menu.photo' ORDER BY created_at`, [owner.businessId]);
    assert.deepEqual(
      audit.map((a) => a.summary),
      ['Cambió la foto de Ceviche', 'Cambió la foto de Ceviche', 'Quitó la foto de Ceviche'],
    );
  });
});
