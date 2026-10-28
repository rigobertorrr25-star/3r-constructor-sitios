// Cambiar de estación una categoría (una sola o varias de una vez): sus productos se van con ella.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('estación de las categorías', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let imp: typeof import('../lib/menu-import');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, waiter: Actor;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const stations = async (category: string) =>
    (
      await db.query<{ name: string; station: string }>(
        `SELECT p.name, p.station FROM menu_products p JOIN menu_categories c ON c.id = p.category_id WHERE c.business_id = $1 AND c.name = $2 ORDER BY p.name`,
        [owner.businessId, category],
      )
    ).map((r) => `${r.name}:${r.station}`);

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    imp = await import('../lib/menu-import');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Estaciones`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Paola', role: 'waiter', locationId: null, pin: '4826' });
    waiter = await login('0002', '4826');
    // Toda la carta entró a barra, como cuando se importa.
    await imp.importMenu(owner, 'Platos\nGriot 38000\nPescado 52000\n\nDesayunos\nHuevos 15000\n\nCócteles\nMojito 27000', 'bar');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('varias de una vez: las de comida pasan a cocina con sus productos; un producto con su propia estación se queda', async () => {
    const menu = await orders.getMenu(owner.businessId);
    const id = (name: string) => menu.categories.find((c) => c.name === name)!.id;
    const pescado = menu.products.find((p) => p.name === 'Pescado')!;
    // Un producto marcado a mano para otra estación (aquí ya está en barra; se pone en cocina y luego se vuelve a barra a mano).
    await orders.saveProduct(owner, { id: pescado.id, categoryId: id('Platos'), name: 'Pescado', price: 52000, station: 'kitchen' });
    await assert.rejects(orders.setCategoryStations(waiter, [{ id: id('Platos'), station: 'kitchen' }]), { code: 'FORBIDDEN' });
    await assert.rejects(orders.setCategoryStations(owner, [{ id: id('Platos'), station: 'sala' }]), { code: 'INVALID' });
    const moved = await orders.setCategoryStations(owner, [
      { id: id('Platos'), station: 'kitchen' },
      { id: id('Desayunos'), station: 'kitchen' },
      { id: id('Cócteles'), station: 'bar' },
    ]);
    assert.equal(moved, 2, 'Cócteles ya estaba en barra');
    assert.deepEqual(await stations('Platos'), ['Griot:kitchen', 'Pescado:kitchen']);
    assert.deepEqual(await stations('Desayunos'), ['Huevos:kitchen']);
    assert.deepEqual(await stations('Cócteles'), ['Mojito:bar']);
  });

  it('si la categoría ya decía cocina pero sus productos seguían en barra, guardar cocina los pasa', async () => {
    const menu = await orders.getMenu(owner.businessId);
    const cat = menu.categories.find((c) => c.name === 'Platos')!;
    // Como quedó la carta de Azul: la categoría en cocina y sus productos todavía en barra.
    await db.query(`UPDATE menu_products SET station = 'bar' WHERE category_id = $1`, [cat.id]);
    assert.equal(await orders.setCategoryStations(owner, [{ id: cat.id, station: 'kitchen' }]), 1);
    assert.deepEqual(await stations('Platos'), ['Griot:kitchen', 'Pescado:kitchen']);
    assert.equal(await orders.setCategoryStations(owner, [{ id: cat.id, station: 'kitchen' }]), 0, 'ya no hay nada que cambiar');
  });

  it('editar una sola categoría también arrastra sus productos', async () => {
    const menu = await orders.getMenu(owner.businessId);
    const cat = menu.categories.find((c) => c.name === 'Desayunos')!;
    await orders.saveCategory(owner, { id: cat.id, name: 'Desayunos', station: 'bar' });
    assert.deepEqual(await stations('Desayunos'), ['Huevos:bar']);
    // Como «Desayuno» en Azul: la categoría ya en cocina y los productos en barra; guardarla sin cambiar nada los alinea.
    await db.query(`UPDATE menu_categories SET station = 'kitchen' WHERE id = $1`, [cat.id]);
    await orders.saveCategory(owner, { id: cat.id, name: 'Desayunos', station: 'kitchen' });
    assert.deepEqual(await stations('Desayunos'), ['Huevos:kitchen']);
  });

  it('un producto que se pasa a otra categoría con «La de su categoría» se va a la estación de la nueva', async () => {
    const bar = await orders.saveCategory(owner, { name: 'Cócteles de paso', station: 'bar' });
    const kitchen = await orders.saveCategory(owner, { name: 'Combos', station: 'kitchen' });
    const id = await orders.saveProduct(owner, { categoryId: bar, name: 'Combo Hamburguesa', price: 30000 });
    assert.equal((await orders.getMenu(owner.businessId)).products.find((p) => p.id === id)!.station, 'bar');
    await orders.saveProduct(owner, { id, categoryId: kitchen, name: 'Combo Hamburguesa', price: 30000, station: '' });
    assert.equal((await orders.getMenu(owner.businessId)).products.find((p) => p.id === id)!.station, 'kitchen');
  });
});
