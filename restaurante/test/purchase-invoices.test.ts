// Facturas de compra: la cajera toma la foto de la factura, la IA redacta el gasto y se guarda con la foto.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

// JPG mínimo válido (cabecera FF D8 FF): basta para reconocer el tipo.
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

describe('leer la respuesta de la IA sobre una factura', () => {
  it('toma proveedor, total, fecha, tipo y qué se compró; lo raro queda vacío', async () => {
    const { receiptReading } = await import('../lib/ai-read');
    assert.deepEqual(
      receiptReading('Aquí va: {"proveedor":"Surtifruver La Sexta","total":"$84.500","fecha":"2026-10-23","tipo":"suppliers","descripcion":"Compra de 10 kg de limón y 5 kg de tomate"}'),
      { supplier: 'Surtifruver La Sexta', total: 84500, date: '2026-10-23', category: 'suppliers', description: 'Compra de 10 kg de limón y 5 kg de tomate', lines: [] },
    );
    assert.deepEqual(receiptReading('{"proveedor":null,"total":null,"fecha":"23/10/2026","tipo":"comida","descripcion":"Hielo"}'), {
      supplier: '',
      total: null,
      date: null,
      category: 'other',
      description: 'Hielo',
      lines: [],
    });
    assert.equal(receiptReading('{"proveedor":null,"total":null,"fecha":null,"tipo":null,"descripcion":""}'), null, 'no era una factura');
    assert.equal(receiptReading('no sé'), null);
    const withLines = receiptReading(
      '{"proveedor":"Makro","total":250000,"fecha":"2026-10-23","tipo":"suppliers","descripcion":"Cerveza y limón","productos":[{"nombre":"Club Colombia","cantidad":24,"unidad":"und","total":"$96.000"},{"nombre":"Limón","cantidad":"2,5","unidad":"kg","total":10000},{"nombre":"Limón","cantidad":2500,"unidad":"g","total":10000},{"nombre":"x","cantidad":1,"unidad":"und"}]}',
    );
    assert.deepEqual(withLines?.lines, [
      { name: 'Club Colombia', quantity: 24, unit: 'und', total: 96000 },
      { name: 'Limón', quantity: 2500, unit: 'g', total: 10000 },
    ], 'kg no es una unidad válida y el nombre muy corto se descarta');
  });
});

describe('facturas de compra con foto', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let cash: typeof import('../lib/cash');
  let fin: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, cashier: Actor, waiter: Actor, northCashier: Actor;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  let today: string;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    cash = await import('../lib/cash');
    fin = await import('../lib/finance');
    today = fin.todayIn('America/Bogota');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Compras`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión ' + code);
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    const north = await store.createLocation(owner, { name: 'Norte' });
    await store.createStaff(owner, { name: 'Cajera', role: 'cashier', locationId: owner.locationId, pin: '2468' });
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: owner.locationId, pin: '1357' });
    await store.createStaff(owner, { name: 'Cajera Norte', role: 'cashier', locationId: north, pin: '8642' });
    cashier = await login('0002', '2468');
    waiter = await login('0003', '1357');
    northCashier = await login('0004', '8642');
    await cash.openShift(cashier, 200000);
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('los productos de la factura entran al inventario: a un insumo que existe y a uno nuevo', async () => {
    const inv = await import('../lib/inventory');
    const beer = await inv.saveItem(owner, { name: 'Club Colombia', unit: 'und', minStock: 0 });
    await inv.registerPurchase(owner, { itemId: beer, quantity: 24, total: 72000 }); // 3.000 c/u
    const items = await inv.itemsForPurchase(cashier);
    assert.ok(items.some((i) => i.name === 'Club Colombia'));
    await assert.rejects(inv.itemsForPurchase(waiter), { code: 'FORBIDDEN' });
    const base = { category: 'suppliers', description: 'Cerveza y limones', supplier: 'Makro', amount: 106000, spentOn: today, paidFromCash: false };
    await assert.rejects(fin.addExpense(cashier, { ...base, lines: [{ newName: 'Limón', newUnit: 'kg', quantity: 2, total: 10000 }] }), { code: 'INVALID' });
    await assert.rejects(fin.addExpense(cashier, { ...base, lines: [{ itemId: beer, quantity: 0, total: 1 }] }), { code: 'INVALID' });
    // Un insumo nuevo con el nombre de uno que existe en otra unidad no se crea a escondidas.
    await assert.rejects(fin.addExpense(cashier, { ...base, lines: [{ newName: 'club colombia', newUnit: 'ml', quantity: 2, total: 1 }] }), { code: 'CONFLICT' });
    await fin.addExpense(cashier, {
      ...base,
      lines: [
        { itemId: beer, quantity: 24, total: 96000 }, // 4.000 c/u: el promedio queda en 3.500
        { newName: 'Limón', newUnit: 'g', quantity: 2500, total: 10000 },
      ],
    });
    const beerNow = (await inv.getItem(owner, beer))!;
    assert.equal(beerNow.stock, 48);
    assert.equal(beerNow.unitCost, 3500);
    const lemon = (await inv.listItems(owner)).find((i) => i.name === 'Limón')!;
    assert.equal(lemon.stock, 2500);
    assert.equal(lemon.unitCost, 4);
    const moves = await db.query<{ reason: string; by: string }>(
      `SELECT m.reason, s.name AS by FROM inventory_movements m JOIN staff s ON s.id = m.created_by WHERE m.item_id = $1 AND m.kind = 'purchase' ORDER BY m.created_at DESC LIMIT 1`,
      [beer],
    );
    assert.equal(moves[0].by, 'Cajera');
    assert.match(moves[0].reason, /Factura de compra de Makro/);
  });

  it('la cajera registra el gasto con la foto y pagado de la caja; el mesero no puede', async () => {
    const input = { category: 'suppliers', description: 'Compra de 10 kg de limón', supplier: 'Surtifruver', amount: 84500, spentOn: today, paidFromCash: true, photo: JPG };
    await assert.rejects(fin.addExpense(waiter, input), { code: 'FORBIDDEN' });
    await assert.rejects(fin.addExpense(cashier, { ...input, photo: new Uint8Array([1, 2, 3]) }), { code: 'INVALID' }, 'no es una foto');
    const id = await fin.addExpense(cashier, input);
    const list = (await fin.listPurchaseInvoices(cashier, { from: today, to: today })).filter((e) => e.id === id);
    assert.equal(list.length, 1);
    assert.equal(list[0].hasPhoto, true);
    assert.equal(list[0].paidFromCash, true);
    assert.equal(list[0].createdBy, 'Cajera');
    const photo = await fin.getExpensePhoto(cashier, id);
    assert.equal(photo?.mime, 'image/jpeg');
    assert.equal(Buffer.compare(photo!.image, Buffer.from(JPG)), 0);
    // La dueña la ve; la cajera de otra sede no; el mesero no entra.
    assert.ok(await fin.getExpensePhoto(owner, id));
    assert.equal(await fin.getExpensePhoto(northCashier, id), null);
    await assert.rejects(fin.getExpensePhoto(waiter, id), { code: 'FORBIDDEN' });
    assert.equal((await fin.listPurchaseInvoices(northCashier, { from: today, to: today })).length, 0);
    // Salió de la caja.
    const out = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM cash_movements WHERE business_id = $1 AND kind = 'out' AND amount = 84500`, [owner.businessId]);
    assert.equal(out[0].n, 1);
    // En Finanzas se ve que tiene foto.
    const finance = await fin.listExpenses(owner, { from: today, to: today, locationId: null });
    assert.equal(finance.find((e) => e.id === id)?.hasPhoto, true);
  });
});
