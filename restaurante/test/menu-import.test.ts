// Importar la carta pegada en texto (como la carta impresa de DELIRIUM).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('importar la carta', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let imp: typeof import('../lib/menu-import');
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
    orders = await import('../lib/orders');
    imp = await import('../lib/menu-import');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Carta`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    slug = a.slug;
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Paola', role: 'waiter', locationId: null, pin: '4826' });
    waiter = await login('0002', '4826');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('lee la carta como viene impresa: puntos, $ y precios con punto de mil', () => {
    const menu = imp.parseMenuText(`Cervezas
Corona ............ $ 12.000
Águila negra  8000

Tequila:
Don Julio 70 .......... $ 580.000
Vinos y Champagne
Vino Chandon ..... $ 1.000.000`);
    assert.deepEqual(menu.categories, [
      { name: 'Cervezas', products: [{ name: 'Corona', price: 12000 }, { name: 'Águila negra', price: 8000 }] },
      { name: 'Tequila', products: [{ name: 'Don Julio 70', price: 580000 }] },
      { name: 'Vinos y Champagne', products: [{ name: 'Vino Chandon', price: 1000000 }] },
    ]);
    assert.throws(() => imp.parseMenuText('Corona $ 12.000'), /primero el nombre de la categoría/);
    assert.throws(() => imp.parseMenuText('Cervezas\nOtros'), /No encontramos productos/);
  });

  it('crea categorías y productos, no repite y actualiza el precio que cambió', async () => {
    const first = await imp.importMenu(owner, 'Cervezas\nCorona $ 12.000\nStella $ 15.000\nCócteles\nMojito $ 27.000');
    assert.deepEqual(first, { categories: 2, products: 3, prices: 0, same: 0 });
    // La segunda vez: Corona sube, Stella igual, Mojito igual y una cerveza nueva.
    const second = await imp.importMenu(owner, 'cervezas\nCorona $ 13.000\nStella $ 15.000\nBudweiser $ 8.000\nCócteles\nMojito 27000');
    assert.deepEqual(second, { categories: 0, products: 1, prices: 1, same: 2 });
    const menu = await orders.getMenu(owner.businessId);
    assert.deepEqual(
      menu.categories.map((c) => [c.name, c.station]),
      [
        ['Cervezas', 'bar'],
        ['Cócteles', 'bar'],
      ],
    );
    assert.equal(menu.products.find((p) => p.name === 'Corona')!.price, 13000);
    assert.equal(menu.products.length, 4);
    await assert.rejects(imp.importMenu(waiter, 'Cervezas\nCorona 12000'), /permiso/);
  });
});
