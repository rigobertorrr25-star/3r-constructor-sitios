// Pruebas de integración del módulo de comunicados de la plataforma empresarial.
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
  hr: `ann.hr.${stamp}@example.com`,
  owner: `ann.owner.${stamp}@example.com`,
  emp: `ann.emp.${stamp}@example.com`,
  emp2: `ann.emp2.${stamp}@example.com`,
  sup: `ann.sup.${stamp}@example.com`,
  out: `ann.out.${stamp}@example.com`,
  staff: `ann.staff.${stamp}@example.com`,
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

describe('módulo de comunicados', () => {
  let a;
  let first;

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
    company = (await as('owner')('POST', '/companies', { name: `Avisos ${stamp}` })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'supervisor'], ['hr', 'hr']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    a = `/companies/${company.id}/announcements`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'ann.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('emp')('GET', a)).status, 403);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['announcements'] })).status, 200);
    assert.equal((await as('emp')('GET', a)).status, 200);
    assert.equal((await as('out')('GET', a)).status, 404);
  });

  it('solo RR. HH. en adelante publica; con aviso le llega el correo a todo el equipo', async () => {
    assert.equal((await as('sup')('POST', a, { title: 'Hola equipo', body: 'Mensaje de prueba' })).status, 403);
    const res = await as('hr')('POST', a, { kind: 'notice', title: 'Nuevo horario de diciembre', body: 'Desde el 1 de diciembre abrimos a las 7 a. m.', notify: true });
    assert.equal(res.status, 201);
    first = res.body;
    for (const k of ['owner', 'emp', 'emp2', 'sup']) assert.ok(sentEmails.some((m) => m.to === emails[k] && m.subject.startsWith('Nuevo horario de diciembre')), k);
    assert.equal(sentEmails.some((m) => m.to === emails.hr && m.subject.startsWith('Nuevo horario')), false, 'a quien publica no');
    assert.equal(sentEmails.some((m) => m.to === emails.out && m.subject.startsWith('Nuevo horario')), false);
    const ev = await as('owner')('POST', a, {
      kind: 'event',
      title: 'Fiesta de fin de año',
      body: 'Cena para todo el equipo.',
      eventAt: new Date(Date.now() + 20 * 86400000).toISOString(),
      eventPlace: 'Terraza',
      pinned: true,
    });
    assert.equal(ev.status, 201);
    assert.equal((await as('hr')('POST', a, { kind: 'event', title: 'Mala fecha', body: 'Texto', eventAt: 'mañana' })).status, 400);
  });

  it('la lista pone lo fijado arriba y marca lo que no he leído; abrirlo lo marca leído', async () => {
    let list = (await as('emp')('GET', a)).body;
    assert.deepEqual(list.map((x) => x.title), ['Fiesta de fin de año', 'Nuevo horario de diciembre']);
    assert.deepEqual(list.map((x) => x.read), [false, false]);
    assert.equal((await as('emp')('GET', `${a}/summary`)).body.unread, 2);
    const detail = (await as('emp')('GET', `${a}/${first.id}`)).body;
    assert.equal(detail.body, 'Desde el 1 de diciembre abrimos a las 7 a. m.');
    assert.equal(detail.readers, undefined, 'un empleado no ve quién leyó');
    assert.equal(detail.can.manage, false);
    list = (await as('emp')('GET', a)).body;
    assert.equal(list.find((x) => x.id === first.id).read, true);
    const summary = (await as('emp')('GET', `${a}/summary`)).body;
    assert.equal(summary.unread, 1);
    assert.equal(summary.upcoming[0].title, 'Fiesta de fin de año');
  });

  it('RR. HH. ve quién lo leyó y quién no', async () => {
    const detail = (await as('hr')('GET', `${a}/${first.id}`)).body;
    assert.equal(detail.readers.length, 2, 'quien publicó y el empleado');
    assert.equal(detail.pending.length, 3);
  });

  it('RR. HH. edita y borra; un empleado no', async () => {
    assert.equal((await as('emp')('PATCH', `${a}/${first.id}`, { pinned: true })).status, 403);
    const res = await as('hr')('PATCH', `${a}/${first.id}`, { title: 'Nuevo horario desde diciembre', pinned: true });
    assert.equal(res.body.title, 'Nuevo horario desde diciembre');
    assert.equal((await as('emp')('DELETE', `${a}/${first.id}`)).status, 403);
    assert.equal((await as('hr')('DELETE', `${a}/${first.id}`)).status, 204);
    assert.equal((await as('emp')('GET', `${a}/${first.id}`)).status, 404);
  });
});
