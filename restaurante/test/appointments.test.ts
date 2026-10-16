// Módulo 13 (servicios y citas) contra una base real. Necesita TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('módulo 13: servicios y citas', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let appt: typeof import('../lib/appointments');
  let cash: typeof import('../lib/cash');
  let fin: typeof import('../lib/finance');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').Actor;
  let owner: Actor, barber: Actor, cut: string, beard: string;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const tz = 'America/Bogota';
  let tomorrow: string;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    appt = await import('../lib/appointments');
    cash = await import('../lib/cash');
    fin = await import('../lib/finance');
    tomorrow = fin.addDays(fin.todayIn(tz), 1);
    const a = await store.createBusiness({ name: `Prueba ${stamp} Barbería`, locationName: 'Centro', ownerName: 'Dueño', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Juan Barbero', role: 'pro', locationId: null, pin: '1357' });
    barber = await login('0002', '1357');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('servicios con precio, duración y comisión', async () => {
    cut = await appt.saveService(owner, { name: 'Corte de cabello', price: 25000, duration: 40, commission: 40 });
    beard = await appt.saveService(owner, { name: 'Arreglo de barba', price: 15000, duration: 20, commission: 50 });
    await assert.rejects(appt.saveService(owner, { name: 'Corte de cabello', price: 1, duration: 10, commission: 0 }), { code: 'CONFLICT' });
    await assert.rejects(appt.saveService(barber, { name: 'Tinte', price: 1, duration: 10, commission: 0 }), { code: 'FORBIDDEN' });
    assert.equal((await appt.listServices(owner.businessId)).length, 2);
    assert.deepEqual(await appt.listProfessionals(owner), [{ id: barber.id, name: 'Juan Barbero' }]);
  });

  it('la agenda no deja cruzar citas del mismo profesional', async () => {
    await appt.createAppointment(owner, { name: 'Andrés', phone: '3001112233', serviceId: cut, staffId: barber.id, date: tomorrow, time: '10:00' });
    await assert.rejects(appt.createAppointment(owner, { name: 'Felipe', phone: '3001112244', serviceId: beard, staffId: barber.id, date: tomorrow, time: '10:30' }), { code: 'CONFLICT' });
    await appt.createAppointment(owner, { name: 'Felipe', phone: '3001112244', serviceId: beard, staffId: barber.id, date: tomorrow, time: '10:40' });
    await assert.rejects(appt.createAppointment(barber, { name: 'Yo', phone: '3001112255', serviceId: beard, staffId: barber.id, date: tomorrow, time: '12:00' }), { code: 'FORBIDDEN' });
    const day = await appt.listAgenda(barber, tomorrow);
    assert.deepEqual(day.map((a) => [a.customerName, a.serviceName, a.price]), [
      ['Andrés', 'Corte de cabello', 25000],
      ['Felipe', 'Arreglo de barba', 15000],
    ]);
  });

  it('se atiende, se cobra en la caja y queda la comisión', async () => {
    const [andres, felipe] = await appt.listAgenda(owner, tomorrow);
    await appt.setAppointmentStatus(barber, andres.id, 'done');
    await assert.rejects(appt.setAppointmentStatus(barber, felipe.id, 'cancelled'), { code: 'FORBIDDEN' });
    await assert.rejects(appt.payAppointment(owner, andres.id, { method: 'cash', clientKey: randomUUID() }), { code: 'CONFLICT' }, 'sin caja abierta');
    await cash.openShift(owner, 50000);
    const key = randomUUID();
    const p = await appt.payAppointment(owner, andres.id, { method: 'cash', tip: 5000, received: 40000, clientKey: key });
    assert.equal(p.change, 10000);
    assert.equal((await appt.payAppointment(owner, andres.id, { method: 'cash', clientKey: key })).duplicate, true);
    await assert.rejects(appt.payAppointment(owner, andres.id, { method: 'card', clientKey: randomUUID() }), { code: 'CONFLICT' });
    await appt.payAppointment(owner, felipe.id, { method: 'card', clientKey: randomUUID() });

    const shift = (await cash.getOpenShift(owner))!;
    const s = (await cash.shiftSummary(owner, shift.id))!;
    assert.equal(s.sales, 40000);
    assert.equal(s.expectedCash, 50000 + 25000 + 5000);

    const all = await appt.commissions(owner, { from: tomorrow, to: tomorrow }, tz);
    assert.deepEqual(all.map((c) => [c.name, c.services, c.sales, c.commission, c.tips]), [['Juan Barbero', 2, 40000, 25000 * 0.4 + 15000 * 0.5, 5000]]);
    assert.equal((await appt.commissions(barber, { from: tomorrow, to: tomorrow }, tz)).length, 1);

    // Reversar el pago de la cita la deja por cobrar otra vez.
    await cash.reversePayment(owner, p.paymentId, 'Se cobró a la persona equivocada');
    assert.equal((await appt.listAgenda(owner, tomorrow))[0].status, 'done');
  });
});
