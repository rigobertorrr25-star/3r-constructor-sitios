// Opciones para armar un plato (PROMO ALMUERZO): se escriben en la carta y el mesero escoge al pedir.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { completeChoices, describeChoices, optionGroupsText, parseOptionGroups } from '../lib/product-options';

const url = process.env.TEST_DATABASE_URL;

const PROMO = 'Sopa\nArroz: Arroz de coco, Arroz de frijol\nAcompañante: Papa francesa, Papas casco, Patacón\nProteína: Pechuga, Carne en bistec\nBebida: Limonada, Panelada';

describe('leer las opciones de un plato', () => {
  it('una línea por grupo; sin «:» es algo que va siempre', () => {
    const { groups, error } = parseOptionGroups(PROMO);
    assert.equal(error, undefined);
    assert.deepEqual(groups[0], { name: 'Sopa', choose: 1, options: ['Sopa'] });
    assert.deepEqual(groups[2], { name: 'Acompañante', choose: 1, options: ['Papa francesa', 'Papas casco', 'Patacón'] });
    assert.equal(optionGroupsText(groups), PROMO);
    assert.deepEqual(parseOptionGroups('Salsas (elige 2): Rosada, Tártara, Piña').groups[0].choose, 2);
    assert.match(parseOptionGroups('Arroz: coco, coco').error!, /repetida/);
    assert.match(parseOptionGroups('Salsas (elige 3): Rosada, Piña').error!, /no se pueden escoger 3 de 2/);
    assert.deepEqual(parseOptionGroups('  \n ').groups, []);
  });

  it('lo escogido se revisa contra la carta y sale en la comanda', () => {
    const { groups } = parseOptionGroups(PROMO);
    const picked = completeChoices(groups, [[], ['arroz de coco'], ['Patacón'], ['Pechuga'], ['Limonada']]);
    assert.deepEqual(picked, [['Sopa'], ['Arroz de coco'], ['Patacón'], ['Pechuga'], ['Limonada']]);
    assert.equal(describeChoices(groups, picked!), 'Sopa · Arroz: Arroz de coco · Acompañante: Patacón · Proteína: Pechuga · Bebida: Limonada');
    assert.equal(completeChoices(groups, [[], ['Arroz de coco'], [], ['Pechuga'], ['Limonada']]), null, 'falta el acompañante');
    assert.equal(completeChoices(groups, [[], ['Arroz de coco', 'Arroz de frijol'], ['Patacón'], ['Pechuga'], ['Limonada']]), null, 'sobra un arroz');
    assert.equal(completeChoices(groups, [[], ['Arroz chino'], ['Patacón'], ['Pechuga'], ['Limonada']]), null, 'no está en la carta');
  });
});

describe('pedir un plato con opciones', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, waiter: Actor;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Opciones`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Paola', role: 'waiter', locationId: owner.locationId, pin: '4826' });
    waiter = await login('0002', '4826');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('la carta guarda las opciones; sin escoger no se envía; lo escogido va en la comanda de cocina', async () => {
    const cat = await orders.saveCategory(owner, { name: 'Almuerzos', station: 'kitchen' });
    await assert.rejects(orders.saveProduct(owner, { categoryId: cat, name: 'PROMO ALMUERZO', price: 18000, options: 'Arroz: coco, coco' }), { code: 'INVALID' });
    const id = await orders.saveProduct(owner, { categoryId: cat, name: 'PROMO ALMUERZO', price: 18000, options: PROMO });
    const product = (await orders.getMenu(owner.businessId)).products.find((p) => p.id === id)!;
    assert.equal(product.optionGroups?.length, 5);
    // Editar sin el campo de opciones no las borra.
    await orders.saveProduct(owner, { id, categoryId: cat, name: 'PROMO ALMUERZO', price: 19000 });
    assert.equal((await orders.getMenu(owner.businessId)).products.find((p) => p.id === id)!.optionGroups?.length, 5);

    const table = await store.createTable(owner, { zone: 'Salón', number: '7', capacity: 4, shape: 'square' });
    const session = await store.openTable(waiter, table, { guests: 1 });
    await assert.rejects(orders.sendOrder(waiter, session, [{ productId: id, quantity: 1 }], randomUUID()), /Escoge las opciones de PROMO ALMUERZO/);
    await orders.sendOrder(
      waiter,
      session,
      [{ productId: id, quantity: 2, notes: 'sin cebolla', choices: [[], ['Arroz de frijol'], ['Papas casco'], ['Carne en bistec'], ['Panelada']] }],
      randomUUID(),
    );
    const items = await db.query<{ notes: string; station: string }>(
      `SELECT i.notes, t.station FROM order_items i JOIN station_tickets t ON t.id = i.ticket_id WHERE i.session_id = $1`,
      [session],
    );
    assert.deepEqual(items, [
      { notes: 'Sopa · Arroz: Arroz de frijol · Acompañante: Papas casco · Proteína: Carne en bistec · Bebida: Panelada — sin cebolla', station: 'kitchen' },
    ]);
    // Quitar las opciones de la carta.
    await orders.saveProduct(owner, { id, categoryId: cat, name: 'PROMO ALMUERZO', price: 19000, options: '' });
    assert.equal((await orders.getMenu(owner.businessId)).products.find((p) => p.id === id)!.optionGroups, null);
  });
});
