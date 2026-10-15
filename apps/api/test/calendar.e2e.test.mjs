// Pruebas de integración del calendario de la plataforma empresarial.
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
  hr: `cal.hr.${stamp}@example.com`,
  owner: `cal.owner.${stamp}@example.com`,
  emp: `cal.emp.${stamp}@example.com`,
  emp2: `cal.emp2.${stamp}@example.com`,
  sup: `cal.sup.${stamp}@example.com`,
  out: `cal.out.${stamp}@example.com`,
  staff: `cal.staff.${stamp}@example.com`,
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

describe('calendario', () => {
  let c;
  const member = {};
  let meeting;

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
    company = (await as('owner')('POST', '/companies', { name: `Agenda ${stamp}` })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'supervisor'], ['hr', 'hr']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      member[Object.keys(emails).find((x) => emails[x] === m.user.email)] = m.id;
    }
    c = `/companies/${company.id}/calendar`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'cal.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('emp')('GET', `${c}?from=2026-12-01&to=2026-12-31`)).status, 403);
    const keys = ['calendar', 'requests', 'employees', 'announcements', 'documents'];
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys })).status, 200);
    assert.equal((await as('emp')('GET', `${c}?from=2026-12-01&to=2026-12-31`)).status, 200);
    assert.equal((await as('emp')('GET', `${c}?from=2026-01-01&to=2026-12-31`)).status, 400, 'máximo 62 días');
    assert.equal((await as('emp')('GET', `${c}?from=ayer&to=hoy`)).status, 400);
  });

  it('el supervisor crea eventos del equipo; el empleado solo recordatorios personales', async () => {
    const res = await as('sup')('POST', `${c}/events`, { kind: 'meeting', title: 'Reunión de turnos', startsAt: '2026-12-02T15:00:00-05:00', endsAt: '2026-12-02T16:00:00-05:00', location: 'Cocina' });
    assert.equal(res.status, 201);
    meeting = res.body;
    assert.equal((await as('emp')('POST', `${c}/events`, { title: 'Fiesta', startsAt: '2026-12-05T20:00:00-05:00' })).status, 403);
    assert.equal((await as('emp')('POST', `${c}/events`, { title: 'Pagar la EPS', startsAt: '2026-12-04T00:00:00-05:00', allDay: true, personal: true })).status, 201);
    assert.equal((await as('sup')('POST', `${c}/events`, { title: 'Al revés', startsAt: '2026-12-02T15:00:00-05:00', endsAt: '2026-12-02T14:00:00-05:00' })).status, 400);
  });

  it('junta eventos, vacaciones, cumpleaños, comunicados y vencimientos según quién mira', async () => {
    await prisma.employeeProfile.create({ data: { memberId: member.emp, companyId: company.id, birthDate: new Date('1996-12-10T00:00:00Z'), contractEnd: new Date('2026-12-31T00:00:00Z') } });
    await prisma.leaveRequest.createMany({
      data: [
        { companyId: company.id, memberId: member.emp, type: 'vacation', startDate: new Date('2026-12-14T00:00:00Z'), endDate: new Date('2026-12-20T00:00:00Z'), days: 6, reason: 'Viaje', status: 'approved' },
        { companyId: company.id, memberId: member.emp, type: 'sick_leave', startDate: new Date('2026-12-07T00:00:00Z'), endDate: new Date('2026-12-08T00:00:00Z'), days: 2, reason: 'Gripa', status: 'approved' },
        { companyId: company.id, memberId: member.emp, type: 'vacation', startDate: new Date('2026-12-22T00:00:00Z'), endDate: new Date('2026-12-23T00:00:00Z'), days: 2, reason: 'Sin aprobar', status: 'pending' },
      ],
    });
    await as('hr')('POST', `/companies/${company.id}/announcements`, { kind: 'event', title: 'Cena de fin de año', body: 'Todos invitados', eventAt: '2026-12-19T19:00:00-05:00' });
    const sources = (who) => as(who)('GET', `${c}?from=2026-12-01&to=2026-12-31`).then((r) => r.body.map((i) => `${i.source}:${i.title}`));
    const emp2 = await sources('emp2');
    assert.ok(emp2.includes('event:Reunión de turnos'));
    assert.ok(emp2.some((x) => x.startsWith('leave:Vacaciones')), 'las vacaciones las ve todo el equipo');
    assert.equal(emp2.some((x) => x.startsWith('leave:Incapacidad')), false, 'la incapacidad de otro no');
    assert.equal(emp2.some((x) => x.includes('Pagar la EPS')), false, 'el recordatorio personal de otro no');
    assert.ok(emp2.some((x) => x.startsWith('birthday:Cumpleaños')));
    assert.ok(emp2.includes('announcement:Cena de fin de año'));
    assert.equal(emp2.some((x) => x.startsWith('contract:')), false);
    assert.equal(emp2.some((x) => x.includes('Sin aprobar')), false);
    const emp = await sources('emp');
    assert.ok(emp.some((x) => x.startsWith('leave:Incapacidad')), 'la propia sí');
    assert.ok(emp.some((x) => x.includes('Pagar la EPS')));
    const hr = await sources('hr');
    assert.ok(hr.some((x) => x.startsWith('leave:Incapacidad')));
    assert.ok(hr.some((x) => x.startsWith('contract:Vence el contrato')));
    const items = (await as('emp')('GET', `${c}?from=2026-12-01&to=2026-12-31`)).body;
    assert.deepEqual(items.map((i) => i.start.slice(0, 10)), [...items.map((i) => i.start.slice(0, 10))].sort(), 'en orden de fecha');
  });

  it('cumpleaños del 29 de febrero sale el 28 en año no bisiesto', async () => {
    await prisma.employeeProfile.create({ data: { memberId: member.emp2, companyId: company.id, birthDate: new Date('2000-02-29T00:00:00Z') } });
    const items = (await as('emp')('GET', `${c}?from=2027-02-01&to=2027-02-28`)).body;
    assert.ok(items.some((i) => i.source === 'birthday' && i.start === '2027-02-28'));
  });

  it('solo quien lo creó o un administrador cambia y borra', async () => {
    assert.equal((await as('emp')('PATCH', `${c}/events/${meeting.id}`, { title: 'Otra' })).status, 403);
    assert.equal((await as('sup')('PATCH', `${c}/events/${meeting.id}`, { title: 'Reunión de turnos de diciembre' })).status, 200);
    assert.equal((await as('hr')('DELETE', `${c}/events/${meeting.id}`)).status, 403, 'RR. HH. no es administrador');
    assert.equal((await as('owner')('DELETE', `${c}/events/${meeting.id}`)).status, 204);
  });

  it('próximos días para el inicio', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await as('sup')('POST', `${c}/events`, { title: 'Inventario mensual', startsAt: `${tomorrow}T00:00:00-05:00`, allDay: true });
    const up = (await as('emp')('GET', `${c}/upcoming`)).body;
    assert.ok(up.some((i) => i.title === 'Inventario mensual'));
  });
});
