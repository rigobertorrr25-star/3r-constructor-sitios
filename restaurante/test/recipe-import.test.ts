// Importar recetas pegadas o leídas de un PDF, y la revisión de archivos antes de mandarlos a la IA.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('revisar archivos para leer con IA', () => {
  it('acepta PDF y fotos hasta 4 MB y rechaza lo demás', async () => {
    const { checkReadFiles } = await import('../lib/ai-read');
    const pdf = { type: 'application/pdf', size: 1000, data: Buffer.alloc(1000) };
    assert.equal(checkReadFiles([pdf, { type: 'image/jpeg', size: 0, data: Buffer.alloc(0) }]).length, 1);
    assert.throws(() => checkReadFiles([]), { code: 'INVALID' });
    assert.throws(() => checkReadFiles([{ type: 'application/zip', size: 10, data: Buffer.alloc(10) }]), { code: 'INVALID' });
    assert.throws(() => checkReadFiles([{ ...pdf, size: 5 * 1024 * 1024 }]), { code: 'INVALID' });
  });
});

describe('leer recetas en texto', () => {
  it('pasa onzas, kilos y litros a ml y g, y junta el mismo insumo', async () => {
    const { parseRecipesText } = await import('../lib/recipe-import');
    const r = parseRecipesText(`Mojito
- Ron blanco ...... 2 oz
Hierbabuena 8 g
Limón 1 und
Limón 1 und

Arroz de coco:
Arroz 0,15 kg
Leche de coco 0.2 l`);
    assert.deepEqual(r.products, [
      { name: 'Mojito', lines: [{ name: 'Ron blanco', quantity: 60, unit: 'ml' }, { name: 'Hierbabuena', quantity: 8, unit: 'g' }, { name: 'Limón', quantity: 2, unit: 'und' }] },
      { name: 'Arroz de coco', lines: [{ name: 'Arroz', quantity: 150, unit: 'g' }, { name: 'Leche de coco', quantity: 200, unit: 'ml' }] },
    ]);
    assert.throws(() => parseRecipesText('Ron 60 ml'), { code: 'INVALID' }, 'sin producto antes');
    assert.throws(() => parseRecipesText('Mojito\nRon blanco 60 ml\nRon blanco 1 und'), { code: 'INVALID' }, 'misma cosa en dos unidades');
    assert.throws(() => parseRecipesText('Solo títulos\nOtro título'), { code: 'INVALID' });
  });
});

describe('importar recetas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let inv: typeof import('../lib/inventory');
  let imp: typeof import('../lib/recipe-import');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, waiter: Actor;
  let mojito: string, rum: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    inv = await import('../lib/inventory');
    imp = await import('../lib/recipe-import');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Recetas`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Paola', role: 'waiter', locationId: null, pin: '4826' });
    waiter = await login('0002', '4826');
    const cat = await orders.saveCategory(owner, { name: 'Cócteles', station: 'bar' });
    mojito = await orders.saveProduct(owner, { categoryId: cat, name: 'Mojito', price: 27000 });
    rum = await inv.saveItem(owner, { name: 'Ron blanco', unit: 'ml', minStock: 0 });
    await inv.saveItem(owner, { name: 'Soda', unit: 'und', minStock: 0 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('crea los insumos que faltan, usa los que existen y avisa lo que no calza', async () => {
    await assert.rejects(imp.importRecipes(waiter, 'Mojito\nRon blanco 60 ml'), { code: 'FORBIDDEN' });
    const r = await imp.importRecipes(owner, `MOJITO
Ron blanco 2 oz
Hierbabuena 8 g
Soda 120 ml

Piña colada
Ron blanco 60 ml`);
    assert.deepEqual(r, { recipes: 1, items: 1, missing: ['Piña colada'], conflicts: ['Soda (MOJITO)'] });
    const lines = await db.query<{ item: string; quantity: string }>(
      `SELECT i.name AS item, r.quantity FROM recipe_lines r JOIN inventory_items i ON i.id = r.item_id WHERE r.product_id = $1 ORDER BY i.name`,
      [mojito],
    );
    assert.deepEqual(lines.map((l) => [l.item, Number(l.quantity)]), [['Hierbabuena', 8], ['Ron blanco', 60]]);
    assert.equal(lines.length, 2);
    assert.ok((await db.query(`SELECT 1 FROM recipe_lines WHERE item_id = $1`, [rum])).length);
    // Volver a importar reemplaza la receta, no la duplica.
    await imp.importRecipes(owner, 'Mojito\nRon blanco 45 ml');
    const again = await db.query<{ quantity: string }>(`SELECT quantity FROM recipe_lines WHERE product_id = $1`, [mojito]);
    assert.deepEqual(again.map((l) => Number(l.quantity)), [45]);
  });
});
