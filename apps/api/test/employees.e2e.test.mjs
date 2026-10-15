// Pruebas de integración del portal del empleado de la plataforma empresarial.
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
  owner: `emp.owner.${stamp}@example.com`,
  emp: `emp.emp.${stamp}@example.com`,
  emp2: `emp.emp2.${stamp}@example.com`,
  sup: `emp.sup.${stamp}@example.com`,
  out: `emp.out.${stamp}@example.com`,
  staff: `emp.staff.${stamp}@example.com`,
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

describe('portal del empleado', () => {
  let e;
  const member = {};

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const [k, mail] of Object.entries(emails)) tokens[k] = await signup(mail);
    const staff = await prisma.user.findUnique({ where: { email: emails.staff } });
    await prisma.userRole.create({ data: { userId: staff.id, role: 'ADMIN' } });
    tokens.staff = (await call('POST', '/auth/login', { body: { email: emails.staff, password } })).body.accessToken;
    company = (await as('owner')('POST', '/companies', { name: `Personal ${stamp}` })).body;
    // `sup` hace de RR. HH. en estas pruebas.
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'hr']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      member[Object.keys(emails).find((x) => emails[x] === m.user.email)] = m.id;
    }
    e = `/companies/${company.id}/employees`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'emp.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('emp')('GET', e)).status, 403);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['employees'] })).status, 200);
    assert.equal((await as('emp')('GET', e)).status, 200);
    assert.equal((await as('out')('GET', e)).status, 404);
  });

  it('el empleado llena su ficha pero no su contrato', async () => {
    const res = await as('emp')('PATCH', `${e}/${member.emp}`, {
      documentType: 'CC',
      documentNumber: ' 1047000111 ',
      phone: '300 111 2233',
      birthDate: '1995-10-20',
      emergencyName: 'María Gómez',
      emergencyPhone: '301 444 5566',
      emergencyRelation: 'Mamá',
      eps: 'Sura',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.personal.documentNumber, '1047000111');
    assert.equal(res.body.personal.birthDate, '1995-10-20');
    assert.equal(res.body.can.work, false);
    assert.equal(res.body.work.hrNotes, undefined, 'no ve las notas de RR. HH.');
    assert.equal((await as('emp')('PATCH', `${e}/${member.emp}`, { salary: 9000000 })).status, 403);
    assert.equal((await as('emp')('PATCH', `${e}/${member.emp}`, { birthDate: '1995-02-31' })).status, 400);
    assert.equal((await as('emp')('PATCH', `${e}/${member.emp}`, { documentType: 'XX' })).status, 400);
  });

  it('un empleado no ve la ficha de otro', async () => {
    assert.equal((await as('emp2')('GET', `${e}/${member.emp}`)).status, 404);
    assert.equal((await as('emp2')('PATCH', `${e}/${member.emp}`, { phone: '1' })).status, 404);
  });

  it('RR. HH. ve todo y pone el contrato; queda constancia sin el valor', async () => {
    const res = await as('sup')('PATCH', `${e}/${member.emp}`, {
      contractType: 'fixed',
      contractEnd: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      salary: 1600000,
      schedule: 'Lunes a sábado, 8 a. m. a 4 p. m.',
      hrNotes: 'Pidió cambio de turno en diciembre.',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.work.salary, 1600000);
    assert.equal(res.body.work.hrNotes, 'Pidió cambio de turno en diciembre.');
    const own = (await as('emp')('GET', `${e}/${member.emp}`)).body;
    assert.equal(own.work.salary, 1600000, 'el empleado ve su salario');
    assert.equal(own.work.contractType, 'fixed');
    const log = await prisma.auditLog.findFirst({ where: { action: 'EMPLOYEE_WORK_UPDATED', entityId: company.id } });
    assert.ok(log);
    assert.equal(JSON.stringify(log.metadata).includes('1600000'), false);
    // RR. HH. no edita a alguien de su rango o mayor, ni su propio contrato.
    assert.equal((await as('sup')('GET', `${e}/${member.owner}`)).status, 404);
    assert.equal((await as('sup')('PATCH', `${e}/${member.sup}`, { salary: 99000000 })).status, 403);
    assert.equal((await as('sup')('PATCH', `${e}/${member.sup}`, { phone: '302 000 0000' })).status, 200);
  });

  it('el directorio no muestra datos privados; el teléfono solo si la persona quiere', async () => {
    let dir = (await as('emp2')('GET', e)).body;
    let row = dir.find((m) => m.id === member.emp);
    assert.equal(row.birthday, '10-20', 'cumpleaños sin año');
    assert.equal(row.phone, null);
    assert.equal(row.canView, false);
    for (const k of ['personal', 'work', 'documentNumber', 'salary']) assert.equal(k in row, false);
    await as('emp')('PATCH', `${e}/${member.emp}`, { showPhone: true });
    dir = (await as('emp2')('GET', e)).body;
    row = dir.find((m) => m.id === member.emp);
    assert.equal(row.phone, '300 111 2233');
    assert.equal((await as('sup')('GET', e)).body.find((m) => m.id === member.emp).canView, true);
  });

  it('las cifras: cumpleaños del mes para todos; fichas incompletas y contratos por vencer para RR. HH.', async () => {
    const emp = (await as('emp2')('GET', `${e}/summary`)).body;
    assert.equal(emp.people, 4);
    assert.equal('incompleteProfiles' in emp, false);
    const hr = (await as('sup')('GET', `${e}/summary`)).body;
    assert.equal(hr.incompleteProfiles, 3);
    assert.equal(hr.contractsEnding, 1);
  });

  it('si la persona sale de la empresa, su ficha se borra con ella', async () => {
    assert.equal((await as('owner')('DELETE', `/companies/${company.id}/members/${member.emp}`)).status, 204);
    assert.equal(await prisma.employeeProfile.count({ where: { memberId: member.emp } }), 0);
  });
});
