// Pruebas de integración del módulo de permisos y vacaciones de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  hr: `req.hr.${stamp}@example.com`,
  owner: `req.owner.${stamp}@example.com`,
  emp: `req.emp.${stamp}@example.com`,
  emp2: `req.emp2.${stamp}@example.com`,
  sup: `req.sup.${stamp}@example.com`,
  out: `req.out.${stamp}@example.com`,
  staff: `req.staff.${stamp}@example.com`,
};
let app, prisma, base, company;
const tokens = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const as = (who) => (method, path, body) => call(method, path, { token: tokens[who], body });
const mailToken = (to, subject) => {
  const m = [...sentEmails].reverse().find((x) => x.to === to && x.subject.includes(subject));
  const r = m && /token=([^\s&"]+)/.exec(m.text);
  return r ? decodeURIComponent(r[1]) : null;
};
const signup = async (email) => {
  await call('POST', '/auth/register', { body: { email, password, firstName: 'Prueba', acceptPrivacy: true } });
  await call('POST', '/auth/verify-email', { body: { token: mailToken(email, 'confirma tu correo') } });
  return (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
};

const iso = (offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toISOString().slice(0, 10);
};

describe('módulo de permisos y vacaciones', () => {
  let r;
  let vac;
  const member = {};

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const [k, e] of Object.entries(emails)) tokens[k] = await signup(e);
    const staff = await prisma.user.findUnique({ where: { email: emails.staff } });
    await prisma.userRole.create({ data: { userId: staff.id, role: 'ADMIN' } });
    tokens.staff = (await call('POST', '/auth/login', { body: { email: emails.staff, password } })).body.accessToken;
    company = (await as('owner')('POST', '/companies', { name: `Permisos ${stamp}` })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'supervisor'], ['hr', 'hr']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      member[Object.keys(emails).find((x) => emails[x] === m.user.email)] = m.id;
    }
    r = `/companies/${company.id}/requests`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'req.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('emp')('GET', r)).status, 403);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['requests'] })).status, 200);
    assert.equal((await as('emp')('GET', r)).status, 200);
    assert.equal((await as('out')('GET', r)).status, 404);
  });

  it('el empleado pide vacaciones: se cuentan los días sin domingos y le llega al supervisor', async () => {
    // Del lunes 2 al domingo 15 de noviembre de 2026: 14 días, 2 domingos → 12.
    const res = await as('emp')('POST', r, { type: 'vacation', startDate: '2026-11-02', endDate: '2026-11-15', reason: 'Viaje familiar' });
    assert.equal(res.status, 201);
    vac = res.body;
    assert.equal(vac.days, 12);
    assert.equal(vac.status, 'pending');
    assert.ok(sentEmails.some((m) => m.to === emails.sup && m.subject.includes('Solicitud por revisar')));
    assert.equal(sentEmails.some((m) => m.to === emails.emp2 && m.subject.includes('Solicitud por revisar')), false);
    assert.equal((await as('emp')('POST', r, { type: 'vacation', startDate: '2026-11-15', endDate: '2026-11-02', reason: 'Al revés' })).status, 400);
    assert.equal((await as('emp')('POST', r, { type: 'permission', reason: 'Sin fecha' })).status, 400);
    assert.equal((await as('emp')('POST', r, { type: 'vacation', startDate: '2026-02-30', reason: 'No existe' })).status, 400);
  });

  it('otro empleado no la ve ni la decide; el empleado no aprueba la suya', async () => {
    assert.equal((await as('emp2')('GET', `${r}/${vac.id}`)).status, 404);
    assert.equal((await as('emp')('POST', `${r}/${vac.id}/decision`, { decision: 'approve' })).status, 403);
    assert.equal((await as('emp')('GET', `${r}/${vac.id}`)).body.can.decide, false);
  });

  it('el supervisor aprueba, pasa a RR. HH. y RR. HH. confirma; le llega el correo al empleado', async () => {
    assert.deepEqual((await as('sup')('GET', `${r}?view=to_decide`)).body.map((x) => x.id), [vac.id]);
    assert.equal((await as('hr')('GET', `${r}?view=to_decide`)).body.length, 1, 'RR. HH. también puede decidir el primer paso');
    let res = await as('sup')('POST', `${r}/${vac.id}/decision`, { decision: 'approve', note: 'Dejar turnos cubiertos' });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'supervisor_ok');
    assert.equal((await as('sup')('POST', `${r}/${vac.id}/decision`, { decision: 'approve' })).status, 403, 'el segundo paso no es del supervisor');
    assert.ok(sentEmails.some((m) => m.to === emails.hr && m.subject.includes('Solicitud por revisar')));
    res = await as('hr')('POST', `${r}/${vac.id}/decision`, { decision: 'approve' });
    assert.equal(res.body.status, 'approved');
    assert.ok(sentEmails.some((m) => m.to === emails.emp && m.subject.includes('quedó aprobada')));
    const detail = (await as('emp')('GET', `${r}/${vac.id}`)).body;
    assert.equal(detail.supervisorNote, 'Dejar turnos cubiertos');
    assert.equal(detail.supervisorBy, 'Prueba');
    assert.equal(detail.can.cancel, false);
  });

  it('RR. HH. que decide primero cierra los dos pasos; rechazar avisa al empleado', async () => {
    const p = (await as('emp2')('POST', r, { type: 'permission', startDate: iso(0), reason: 'Cita médica a las 10 a. m.' })).body;
    const res = await as('hr')('POST', `${r}/${p.id}/decision`, { decision: 'approve' });
    assert.equal(res.body.status, 'approved');
    const s = (await as('emp2')('POST', r, { type: 'other', startDate: iso(3), reason: 'Cambio de turno' })).body;
    const rej = await as('sup')('POST', `${r}/${s.id}/decision`, { decision: 'reject', note: 'Ese día no hay quién cubra' });
    assert.equal(rej.body.status, 'rejected');
    assert.ok(sentEmails.some((m) => m.to === emails.emp2 && m.subject.includes('no fue aprobada') && m.text.includes('Ese día no hay quién cubra')));
    assert.equal((await as('hr')('POST', `${r}/${s.id}/decision`, { decision: 'approve' })).status, 403, 'ya se cerró');
  });

  it('un certificado va directo a RR. HH.; el supervisor no lo ve por decidir', async () => {
    const c = (await as('emp')('POST', r, { type: 'certificate', reason: 'Para el banco' })).body;
    assert.equal(c.status, 'supervisor_ok');
    assert.equal(c.days, 0);
    assert.equal((await as('sup')('GET', `${r}?view=to_decide`)).body.length, 0);
    assert.equal((await as('hr')('GET', `${r}?view=to_decide`)).body.length, 1);
  });

  it('una solicitud del supervisor la decide alguien de mayor rango', async () => {
    const s = (await as('sup')('POST', r, { type: 'vacation', startDate: '2026-12-21', endDate: '2026-12-24', reason: 'Navidad' })).body;
    assert.equal((await as('sup')('POST', `${r}/${s.id}/decision`, { decision: 'approve' })).status, 403);
    assert.equal((await as('emp')('GET', `${r}/${s.id}`)).status, 404);
    assert.equal((await as('hr')('POST', `${r}/${s.id}/decision`, { decision: 'approve' })).body.status, 'approved');
  });

  it('quien pidió cancela mientras siga abierta', async () => {
    const o = (await as('emp')('POST', r, { type: 'permission', startDate: iso(5), reason: 'Diligencia' })).body;
    assert.equal(o.can.cancel, true);
    assert.equal((await as('emp2')('POST', `${r}/${o.id}/cancel`)).status, 404);
    assert.equal((await as('emp')('POST', `${r}/${o.id}/cancel`)).body.status, 'cancelled');
    assert.equal((await as('emp')('POST', `${r}/${vac.id}/cancel`)).status, 400, 'ya aprobada no se cancela');
  });

  it('las cifras: por decidir, ausentes hoy y vacaciones tomadas este año', async () => {
    const hr = (await as('hr')('GET', `${r}/summary`)).body;
    assert.equal(hr.toDecide, 1, 'el certificado');
    assert.deepEqual(hr.absentToday.map((a) => a.type), ['permission']);
    const emp = (await as('emp')('GET', `${r}/summary`)).body;
    assert.equal(emp.myVacationDaysThisYear, 12);
    assert.equal(emp.myOpen, 1);
    assert.equal(emp.toDecide, 0);
    assert.deepEqual(emp.absentToday, [], 'un empleado solo ve lo suyo');
  });
});
