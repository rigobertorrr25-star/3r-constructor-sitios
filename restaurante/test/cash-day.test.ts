// Dos cuadres de caja al día (uno por turno de cajera) y el cuadre del día. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('dos turnos de caja al día', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let orders: typeof import('../lib/orders');
  let cash: typeof import('../lib/cash');
  let day: typeof import('../lib/cash-day');
  let printing: typeof import('../lib/printing');
  let finance: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, waiter: Actor, ana: Actor, lina: Actor;
  let burger: string, t1: string, t2: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  const login = async (slug: string, code: string, pin: string) => {
    const r = await store.loginStaff({ slug, code, pin });
    if (r.kind !== 'ok') throw new Error('sin sesión');
    return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
  };
  const order = async (table: string, quantity: number) => {
    const sessionId = await store.openTable(waiter, table, { guests: 2 });
    await orders.sendOrder(waiter, sessionId, [{ productId: burger, quantity }], randomUUID());
    return sessionId;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    orders = await import('../lib/orders');
    cash = await import('../lib/cash');
    day = await import('../lib/cash-day');
    printing = await import('../lib/printing');
    finance = await import('../lib/finance');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Turnos`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    owner = await login(a.slug, '0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    await store.createStaff(owner, { name: 'Ana', role: 'cashier', locationId: null, pin: '2468' });
    await store.createStaff(owner, { name: 'Lina', role: 'cashier', locationId: null, pin: '8642' });
    waiter = await login(a.slug, '0002', '1357');
    ana = await login(a.slug, '0003', '2468');
    lina = await login(a.slug, '0004', '8642');
    const food = await orders.saveCategory(owner, { name: 'Platos', station: 'kitchen' });
    burger = await orders.saveProduct(owner, { categoryId: food, name: 'Hamburguesa', price: 25000 });
    t1 = await store.createTable(owner, { zone: 'Salón', number: '1', capacity: 4, shape: 'square' });
    t2 = await store.createTable(owner, { zone: 'Salón', number: '2', capacity: 4, shape: 'square' });
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('turno 1 y turno 2 con su cuadre; la base del 2 es lo que dejó el 1; el día suma los dos', async () => {
    assert.equal(await cash.drawerLeftByLastShift(ana), null);
    // Turno 1 (Ana): base 100.000, cobra 50.000 en efectivo, cierra con 150.000 y guarda 50.000 en la caja fuerte.
    await cash.openShift(ana, 100000);
    const s1 = await order(t1, 2);
    await cash.pay(ana, s1, { method: 'cash', amount: 50000, received: 50000, clientKey: randomUUID() });
    const shift1 = (await cash.getOpenShift(ana))!;
    assert.equal(shift1.dayNumber, 1);
    await cash.closeShift(ana, 150000, '', { safeAmount: 50000 });

    const left = await cash.drawerLeftByLastShift(lina);
    assert.equal(left?.amount, 100000, 'contado − caja fuerte');
    assert.equal(left?.closedBy, 'Ana');

    // Turno 2 (Lina): recibe 100.000, cobra 25.000 por datáfono y 25.000 en efectivo, saca 5.000 y le faltan 5.000.
    await cash.openShift(lina, left!.amount);
    const shift2 = (await cash.getOpenShift(lina))!;
    assert.equal(shift2.dayNumber, 2);
    assert.equal(shift2.day, shift1.day);
    const s2 = await order(t2, 2);
    await cash.pay(lina, s2, { method: 'card', amount: 25000, tip: 2500, clientKey: randomUUID() });
    await cash.pay(lina, s2, { method: 'cash', amount: 25000, received: 25000, clientKey: randomUUID() });
    await cash.addMovement(lina, { kind: 'out', amount: 5000, reason: 'Pago: hielo' });
    const today = finance.todayIn('America/Bogota');
    let shifts = await cash.dayShifts(lina, today);
    assert.equal(day.dayTotals(shifts).open, 1, 'el turno 2 sigue abierto');
    // Esperado al contar (9 nov 2026, con la propina adentro): 100.000 + 25.000 en efectivo − 5.000 = 120.000 (la propina
    // del datáfono todavía no ha salido; se saca después de contar).
    await cash.closeShift(lina, 115000, 'Faltaron 5.000');

    shifts = await cash.dayShifts(lina, today);
    assert.deepEqual(shifts.map((s) => [s.shift.dayNumber, s.shift.openedBy, day.shiftDifference(s)]), [
      [1, 'Ana', 0],
      [2, 'Lina', -5000],
    ]);
    const totals = day.dayTotals(shifts);
    assert.equal(totals.sales, 100000);
    assert.equal(totals.tips, 2500);
    assert.deepEqual([totals.byMethod.cash.amount, totals.byMethod.card.amount], [75000, 25000]);
    assert.equal(totals.movementsOut, 5000);
    assert.equal(totals.safeAmount, 50000);
    assert.equal(totals.difference, -5000);
    assert.equal(totals.open, 0);
    assert.equal(totals.tablesClosed, 2);
    assert.deepEqual(await cash.dayShifts(lina, '2020-01-01'), []);
    await assert.rejects(cash.dayShifts(waiter, today), { code: 'FORBIDDEN' });

    // El papel del cuadre del día y el del cierre dicen el turno.
    assert.equal(await printing.enqueueDayClosing(lina, today), 0, 'sin impresora de caja no se encola');
    const base = { host: '192.168.1.52', port: 9100, width: 48, printsKitchen: false, printsBar: false, printsCashier: true, printsOrders: false, copies: 1, isActive: true };
    await printing.savePrinter(owner, null, { ...base, name: 'Caja' });
    assert.equal(await printing.enqueueDayClosing(lina, today), 1);
    await printing.enqueueClosing(lina, shift2.id);
    const jobs = await db.query<{ kind: string; preview: string }>(`SELECT kind, preview FROM print_jobs WHERE location_id = $1 ORDER BY created_at`, [lina.locationId]);
    const dia = jobs.find((j) => j.kind === 'dia')!.preview.replace(/\s+/g, ' ');
    for (const s of ['CUADRE DEL DIA', 'Turno 1: Ana', 'Turno 2: Lina', 'CUADRA', 'FALTAN $5.000', 'TOTAL DEL DIA', 'Caja fuerte $50.000']) assert.ok(dia.includes(s), s);
    assert.ok(jobs.find((j) => j.kind === 'cierre')!.preview.includes('TURNO 2'));
    await assert.rejects(printing.enqueueDayClosing(lina, '2020-01-01'), { code: 'NOT_FOUND' });

    // El cierre completo del día en PDF (4 nov 2026): los dos turnos juntos.
    const report = await import('../lib/day-report');
    const who = { ...lina, businessName: 'Prueba', locationName: 'Centro', timezone: 'America/Bogota' };
    const r = (await report.dayReport(who, today))!;
    assert.equal(r.shifts.length, 2);
    assert.deepEqual(r.categories.map((c) => [c.category, c.quantity, c.total]), [['Platos', 4, 100000]], 'los dos turnos sumados');
    assert.deepEqual(r.categories[0].products, [{ name: 'Hamburguesa', quantity: 4, total: 100000 }]);
    assert.equal(r.tables.length, 2);
    assert.deepEqual(r.form.withoutInvoice.map((x) => x.amount), [5000]);
    const pdf = await report.dayReportPdf(r);
    assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), '%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
    // En Excel (5 nov 2026): una hoja por parte.
    const { dayReportXlsx } = await import('../lib/day-report-xlsx');
    const ExcelJS = (await import('exceljs')).default;
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await dayReportXlsx(r)) as never);
    assert.deepEqual(book.worksheets.map((w) => w.name), ['Resumen', 'Turnos', 'Ventas por producto', 'Mesas cobradas', 'Gastos', 'Por pagar', 'Pérdidas', 'Descuentos']);
    assert.deepEqual([book.getWorksheet('Turnos')!.getCell('B4').value, book.getWorksheet('Turnos')!.getCell('C4').value], ['Turno 1', 'Turno 2'], 'una columna por turno');
    assert.equal(book.getWorksheet('Ventas por producto')!.getCell('D5').value, 100000);
    assert.equal(await report.dayReport(who, '2020-01-01'), null);
    await assert.rejects(report.dayReport({ ...waiter, businessName: '', locationName: '', timezone: 'America/Bogota' }, today), { code: 'FORBIDDEN' });
  });

  it('el dueño corrige un cierre en el que faltó contar plata; la cajera no puede', async () => {
    const today = finance.todayIn('America/Bogota');
    const [, second] = await cash.dayShifts(lina, today);
    assert.equal(day.shiftDifference(second), -5000);
    await assert.rejects(cash.correctClosing(lina, second.shift.id, { countedCash: 120000, reason: 'Faltó contar' }), { code: 'FORBIDDEN' });
    await assert.rejects(cash.correctClosing(owner, second.shift.id, { countedCash: 120000, reason: '' }), { code: 'INVALID' }, 'siempre con motivo');
    await assert.rejects(cash.correctClosing(owner, second.shift.id, { countedCash: 120000, reason: 'Faltó contar', safeAmount: 130000 }), { code: 'INVALID' });
    await assert.rejects(cash.correctClosing(owner, second.shift.id, { countedCash: 120000, reason: 'Faltó contar', cashCount: { b100000: 1 } }), { code: 'INVALID' });
    await cash.correctClosing(owner, second.shift.id, { countedCash: 120000, reason: 'Faltó contar el cajón de abajo', cashCount: { b100000: 1, b10000: 2 } });
    const after = (await cash.shiftSummary(owner, second.shift.id))!;
    assert.equal(after.shift.countedCash, 120000);
    assert.equal(day.shiftDifference(after), 0, 'ahora cuadra (lo esperado no cambió)');
    assert.equal(after.shift.correctedBy, 'Dueña');
    assert.equal(after.shift.correctionReason, 'Faltó contar el cajón de abajo');
    assert.deepEqual(after.shift.cashCount, { b100000: 1, b10000: 2 });
    const audit = await store.listAudit(owner, { action: 'cash.correct' });
    assert.match(audit[0].summary, /\$115\.000 → \$120\.000 \(cuadra\)/);
    // Corregir o eliminar una salida de un cierre ya hecho (6 nov 2026).
    const ice = after.movements.find((m) => m.reason === 'Pago: hielo')!;
    await assert.rejects(cash.correctMovement(lina, ice.id, { amount: 2000, reason: 'Era menos' }), { code: 'FORBIDDEN' });
    await assert.rejects(cash.correctMovement(owner, ice.id, { amount: 2000, reason: '' }), { code: 'INVALID' });
    await cash.correctMovement(owner, ice.id, { amount: 2000, reason: 'Era menos' });
    let fixed = (await cash.shiftSummary(owner, second.shift.id))!;
    assert.equal(fixed.shift.expectedCash, 123000, 'el esperado sube 3.000');
    assert.equal(fixed.movementsOut, 2000);
    await cash.correctMovement(owner, ice.id, { amount: 0, reason: 'No pasó' });
    fixed = (await cash.shiftSummary(owner, second.shift.id))!;
    assert.equal(fixed.shift.expectedCash, 125000);
    assert.equal(fixed.movements.length, 0, 'eliminada: ya no sale');
    await assert.rejects(cash.correctMovement(owner, ice.id, { amount: 0, reason: 'Otra vez' }), { code: 'CONFLICT' });
    assert.match((await store.listAudit(owner, { action: 'cash.movement.correct' }))[0].summary, /Eliminó la salida de efectivo «Pago: hielo»/);
    // Una caja abierta no se corrige.
    await cash.openShift(ana, 0);
    const open = (await cash.getOpenShift(ana))!;
    await assert.rejects(cash.correctClosing(owner, open.id, { countedCash: 0, reason: 'Prueba' }), { code: 'CONFLICT' });
  });
});
