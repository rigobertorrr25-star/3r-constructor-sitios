// Módulo 10 (factura electrónica, parte sin proveedor) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { splitTax } from '../lib/invoices';

const url = process.env.TEST_DATABASE_URL;

describe('impuesto incluido en el precio', () => {
  it('separa base e impuesto', () => {
    assert.deepEqual(splitTax(108000, 8), { base: 100000, tax: 8000 });
    assert.deepEqual(splitTax(119000, 19), { base: 100000, tax: 19000 });
    assert.deepEqual(splitTax(50000, 0), { base: 50000, tax: 0 });
    const odd = splitTax(33333, 8);
    assert.equal(odd.base + odd.tax, 33333);
  });
});

describe('módulo 10: facturas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let inv: typeof import('../lib/invoices');
  let fin: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, sessionId: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const tz = 'America/Bogota';

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    inv = await import('../lib/invoices');
    fin = await import('../lib/finance');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Facturas`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login('0002', '1357');
    const cat = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    const dish = await orders.saveProduct(owner, { categoryId: cat, name: 'Bandeja', price: 54000 });
    const t = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    sessionId = await store.openTable(waiter, t, { guests: 2 });
    await orders.sendOrder(waiter, sessionId, [{ productId: dish, quantity: 2 }], randomUUID());
    await cash.openShift(owner, 0);
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('datos fiscales', async () => {
    await assert.rejects(inv.saveFiscal(owner, { legalName: 'Restaurante SAS', taxId: 'abc', taxKind: 'inc' }), { code: 'INVALID' });
    await assert.rejects(inv.saveFiscal(waiter, { legalName: 'Restaurante SAS', taxId: '900123456-7', taxKind: 'inc' }), { code: 'FORBIDDEN' });
    await inv.saveFiscal(owner, { legalName: 'Restaurante SAS', taxId: '900.123.456-7', taxKind: 'inc', resolution: 'Resolución DIAN 18764000000001 del 2026' });
    const f = await inv.getFiscal(owner.businessId);
    assert.equal(f.taxId, '900123456-7');
    assert.equal(f.provider, 'none');
  });

  it('cobrar la cuenta completa crea la factura (sin la propina), a nombre de consumidor final', async () => {
    await cash.pay(owner, sessionId, { method: 'card', amount: 50000, clientKey: randomUUID() });
    assert.equal(await inv.invoiceForSession(owner, sessionId), null, 'un abono parcial no factura');
    await cash.pay(owner, sessionId, { method: 'cash', amount: 58000, tip: 10800, clientKey: randomUUID() });
    const i = (await inv.invoiceForSession(owner, sessionId))!;
    assert.equal(i.total, 108000);
    assert.equal(i.base, 100000);
    assert.equal(i.tax, 8000);
    assert.equal(i.tip, 10800);
    assert.equal(i.docNumber, '222222222222');
    assert.equal(i.status, 'pending');
    await inv.setInvoiceCustomer(owner, i.id, { docType: 'NIT', docNumber: '901222333-1', name: 'Empresa Cliente SAS', email: 'facturas@cliente.co' });
    const today = fin.todayIn(tz);
    const list = await inv.listInvoices(owner, { from: today, to: today }, tz);
    assert.equal(list[0].customerName, 'Empresa Cliente SAS');
    const csv = inv.invoicesCsv(list, tz);
    assert.match(csv, /Empresa Cliente SAS;facturas@cliente\.co;100000;8;8000;108000;10800;Pendiente/);
  });

  it('reversar el pago que cerró la venta anula la factura y al volver a cobrar sale otra', async () => {
    const before = (await inv.invoiceForSession(owner, sessionId))!;
    const c = (await cash.getCheckout(owner, sessionId))!;
    const last = c.payments.find((p) => p.method === 'cash')!;
    await cash.reversePayment(owner, last.id, 'Se cobró mal');
    assert.equal(await inv.invoiceForSession(owner, sessionId), null);
    await cash.pay(owner, sessionId, { method: 'transfer', amount: 58000, clientKey: randomUUID() });
    const after = (await inv.invoiceForSession(owner, sessionId))!;
    assert.notEqual(after.id, before.id);
    assert.equal(after.sequence, before.sequence + 1);
    assert.equal(after.tip, 0);
  });
});
