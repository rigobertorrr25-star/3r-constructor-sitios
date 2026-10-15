// Impresión de comandas contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Ticket, comanda, plain, wrap } from '../lib/escpos';

const url = process.env.TEST_DATABASE_URL;

describe('tickets para impresora térmica', () => {
  it('parte renglones sin cortar palabras y cambia lo que la impresora no dibuja', () => {
    assert.deepEqual(wrap('Hamburguesa doble con tocineta y queso', 16), ['Hamburguesa', 'doble con', 'tocineta y queso']);
    assert.equal(plain('2 × Mojito — $18.000 −10 %'), '2 x Mojito - $18.000 -10 %');
  });

  it('las tildes y eñes salen en la página de códigos de la impresora; corta el papel al final', () => {
    const { data, preview } = new Ticket(32).line('Piña ñoña ¿sí?').finish();
    assert.deepEqual([...data.subarray(0, 5)], [0x1b, 0x40, 0x1b, 0x74, 0x02], 'inicia e indica PC850');
    assert.ok(data.includes(0xa4) && data.includes(0xa1) && data.includes(0xa8), 'ñ, í y ¿ en PC850');
    assert.deepEqual([...data.subarray(-4)], [0x1d, 0x56, 0x42, 0x03], 'corte de papel');
    assert.equal(preview, 'Piña ñoña ¿sí?');
    assert.equal(new Ticket(32).line('x').finish(2).data.length, new Ticket(32).line('x').finish().data.length * 2, 'dos copias');
  });

  it('la comanda trae estación, mesa, ronda, mesero y las notas', () => {
    const { preview } = comanda(48, {
      station: 'kitchen',
      table: '4',
      zone: 'Terraza',
      round: 2,
      sentBy: 'Beto',
      time: '9:04 p. m.',
      items: [{ quantity: 2, name: 'Punta de anca', notes: 'Término medio' }],
    }).finish();
    for (const s of ['COCINA', 'MESA 4', 'Terraza · Ronda 2', 'Beto · 9:04 p. m.', '2 X PUNTA DE ANCA', '>> Término medio']) assert.ok(preview.includes(s), s);
  });
});

describe('cola de impresión', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let printing: typeof import('../lib/printing');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor;
  let sessionId: string;
  let burger: string, beer: string;
  let kitchenP: string, barP: string, cashP: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const base = {
    host: '192.168.1.50',
    port: 9100,
    width: 48,
    printsKitchen: false,
    printsBar: false,
    printsCashier: false,
    copies: 1,
    isActive: true,
  };

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const jobs = () =>
    db.query<{ id: string; kind: string; printerId: string; status: string; preview: string; attempts: number }>(
      `SELECT id, kind, printer_id AS "printerId", status, preview, attempts FROM print_jobs WHERE location_id = $1 ORDER BY created_at, kind`,
      [owner.locationId],
    );

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    printing = await import('../lib/printing');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Impresión`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login(a.slug, '0002', '1357');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    const drinks = await orders.saveCategory(owner, { name: 'Bebidas', station: 'bar' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 30000 });
    beer = await orders.saveProduct(owner, { categoryId: drinks, name: 'Cerveza', price: 8000 });
    const table = await store.createTable(owner, { zone: 'Salón', number: '7', capacity: 4, shape: 'square' });
    sessionId = await store.openTable(waiter, table, { guests: 2 });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('sin impresoras no se encola nada (las comandas siguen en pantalla)', async () => {
    await orders.sendOrder(waiter, sessionId, [{ productId: burger, quantity: 1 }], randomUUID());
    assert.equal((await jobs()).length, 0);
    await assert.rejects(printing.printBill(waiter, sessionId), { code: 'CONFLICT' });
  });

  it('solo dueño y administrador manejan impresoras; la IP se valida', async () => {
    await assert.rejects(printing.savePrinter(waiter, null, { ...base, name: 'Cocina', printsKitchen: true }), { code: 'FORBIDDEN' });
    await assert.rejects(printing.savePrinter(owner, null, { ...base, name: 'Cocina', host: 'http://x y' }), { code: 'INVALID' });
    kitchenP = await printing.savePrinter(owner, null, { ...base, name: 'Cocina', printsKitchen: true });
    barP = await printing.savePrinter(owner, null, { ...base, name: 'Barra', host: '192.168.1.51', printsBar: true, width: 32 });
    cashP = await printing.savePrinter(owner, null, { ...base, name: 'Caja', host: '192.168.1.52', printsCashier: true, copies: 2 });
    assert.equal((await printing.listPrinters(owner)).length, 3);
    assert.equal(await printing.hasPrinter(waiter, 'cashier'), true);
  });

  it('cada estación recibe solo lo suyo al enviar el pedido, y la anulación le llega a la estación', async () => {
    await orders.sendOrder(
      waiter,
      sessionId,
      [
        { productId: burger, quantity: 2, notes: 'Sin cebolla' },
        { productId: beer, quantity: 3 },
      ],
      randomUUID(),
    );
    const all = await jobs();
    const kitchen = all.filter((j) => j.printerId === kitchenP);
    const bar = all.filter((j) => j.printerId === barP);
    assert.equal(kitchen.length, 1);
    assert.equal(bar.length, 1);
    assert.ok(kitchen[0].preview.includes('2 X HAMBURGUESA') && kitchen[0].preview.includes('>> Sin cebolla') && !kitchen[0].preview.includes('CERVEZA'));
    assert.ok(bar[0].preview.includes('3 X CERVEZA') && !bar[0].preview.includes('HAMBURGUESA'));
    assert.ok(bar[0].preview.split('\n').every((l) => l.length <= 32), 'papel de 58 mm');
    assert.equal(all.filter((j) => j.printerId === cashP).length, 0, 'la caja no recibe comandas');

    const order = await orders.getSessionOrder(owner, sessionId);
    const beerItem = order!.rounds.at(-1)!.items.find((i) => i.name === 'Cerveza')!;
    await orders.voidItem(owner, beerItem.id, 'Se equivocó de mesa');
    const voids = (await jobs()).filter((j) => j.kind === 'anulacion');
    assert.equal(voids.length, 1);
    assert.equal(voids[0].printerId, barP);
    assert.ok(voids[0].preview.includes('ANULADO') && voids[0].preview.includes('Se equivocó de mesa'));
  });

  it('la precuenta sale en la impresora de caja', async () => {
    await printing.printBill(waiter, sessionId);
    const bill = (await jobs()).filter((j) => j.kind === 'precuenta');
    assert.equal(bill.length, 1);
    assert.equal(bill[0].printerId, cashP);
    assert.ok(bill[0].preview.includes('PRECUENTA · Mesa 7') && bill[0].preview.includes('$90.000'), bill[0].preview);
  });

  it('el programa del local pide los trabajos con su código y avisa si salieron', async () => {
    assert.equal(await printing.claimJobs('rc_inventado_inventado_inventado'), null);
    const code = await printing.createAgentCode(owner);
    const first = await printing.claimJobs(code);
    assert.ok(first && first.length === 4, 'comanda cocina, comanda barra, anulación y precuenta');
    const k = first.find((j) => j.host === '192.168.1.50')!;
    assert.equal(k.port, 9100);
    assert.equal(Buffer.from(k.data, 'base64')[0], 0x1b);
    assert.deepEqual(await printing.claimJobs(code), [], 'no entrega dos veces lo que ya está imprimiendo');
    assert.ok((await printing.agentStatus(owner)).seenAt);

    for (const j of first.filter((j) => j.id !== k.id)) assert.equal(await printing.finishJob(code, j.id, true), true);
    // La de cocina falla: vuelve a la cola, y a los 5 intentos queda como «no salió».
    assert.equal(await printing.finishJob(code, k.id, false, 'No se pudo conectar'), true);
    for (let i = 0; i < 4; i++) {
      const again = await printing.claimJobs(code);
      assert.equal(again![0].id, k.id);
      await printing.finishJob(code, k.id, false, 'No se pudo conectar');
    }
    const states = await jobs();
    assert.equal(states.find((j) => j.id === k.id)!.status, 'failed');
    assert.equal(states.filter((j) => j.status === 'done').length, 3);
    assert.deepEqual(await printing.claimJobs(code), []);

    // Reimprimir crea un trabajo nuevo; el código viejo deja de servir al crear otro.
    await printing.reprint(owner, k.id);
    const fresh = await printing.createAgentCode(owner);
    assert.equal(await printing.claimJobs(code), null);
    assert.equal((await printing.claimJobs(fresh))!.length, 1);
  });

  it('lo que lleva horas en cola se descarta en vez de imprimir comandas viejas', async () => {
    await printing.printBill(owner, sessionId);
    await db.query(`UPDATE print_jobs SET created_at = now() - interval '7 hours' WHERE status = 'pending' AND location_id = $1`, [owner.locationId]);
    const code = await printing.createAgentCode(owner);
    assert.deepEqual(await printing.claimJobs(code), []);
    assert.ok((await jobs()).some((j) => j.status === 'failed' && j.kind === 'precuenta'));
  });

  it('al cerrar la caja sale el resumen en la impresora de caja', async () => {
    await cash.openShift(owner, 100000);
    await cash.pay(owner, sessionId, { method: 'cash', amount: 60000, clientKey: randomUUID() });
    const { shiftId } = await cash.closeShift(owner, 160000);
    assert.equal(await printing.enqueueClosing(owner, shiftId), 1);
    const closing = (await jobs()).filter((j) => j.kind === 'cierre');
    assert.equal(closing.length, 1);
    assert.equal(closing[0].printerId, cashP);
    for (const s of ['CIERRE DE CAJA', 'Efectivo (1)', '$60.000', 'CUADRA']) assert.ok(closing[0].preview.includes(s), s);
  });

  it('el aviso de papeles atascados cuenta lo que no ha salido', async () => {
    await printing.printTest(owner, kitchenP);
    await db.query(`UPDATE print_jobs SET created_at = now() - interval '1 minute' WHERE kind = 'prueba' AND location_id = $1`, [owner.locationId]);
    assert.ok((await printing.stuckJobs(owner)) >= 1);
  });
});
