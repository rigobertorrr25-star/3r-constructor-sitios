// Pruebas de integración del módulo de tickets de la plataforma empresarial.
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
  owner: `tk.owner.${stamp}@example.com`,
  emp: `tk.emp.${stamp}@example.com`,
  emp2: `tk.emp2.${stamp}@example.com`,
  sup: `tk.sup.${stamp}@example.com`,
  out: `tk.out.${stamp}@example.com`,
  staff: `tk.staff.${stamp}@example.com`,
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

describe('módulo de tickets', () => {
  let t;
  let ticket;
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
    company = (await as('owner')('POST', '/companies', { name: `Soporte ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['emp2', 'employee'],
      ['sup', 'supervisor'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      const k = Object.keys(emails).find((x) => emails[x] === m.user.email);
      member[k] = m.id;
    }
    t = `/companies/${company.id}/tickets`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'tk.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('emp')('GET', t)).status, 403);
    const res = await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['tickets'] });
    assert.equal(res.status, 200);
    assert.equal((await as('emp')('GET', t)).status, 200);
  });

  it('un empleado crea tickets numerados por empresa; quien no es de la empresa no entra', async () => {
    const res = await as('emp')('POST', t, {
      title: ' El computador de caja no prende ',
      description: 'Desde esta mañana no enciende.',
      category: 'support',
      priority: 'high',
    });
    assert.equal(res.status, 201);
    ticket = res.body;
    assert.equal(ticket.number, 1);
    assert.equal(ticket.title, 'El computador de caja no prende');
    assert.equal(ticket.status, 'open');
    assert.equal(ticket.requesterMemberId, member.emp);
    const second = await as('emp2')('POST', t, {
      title: 'Pedir resmas de papel',
      description: 'Se acabó el papel de la impresora.',
      category: 'purchases',
    });
    assert.equal(second.body.number, 2);
    assert.equal(second.body.priority, 'medium');
    assert.equal((await as('emp')('POST', t, { title: 'Algo', description: 'Algo pasa aquí', category: 'nada' })).status, 400);
    assert.equal((await as('out')('GET', t)).status, 404);
    assert.equal((await as('out')('POST', t, { title: 'Intruso aquí', description: 'No soy de la empresa', category: 'other' })).status, 404);
  });

  it('cada empleado ve solo los suyos; el supervisor ve todos', async () => {
    const mine = (await as('emp')('GET', t)).body;
    assert.deepEqual(
      mine.map((x) => x.number),
      [1],
    );
    assert.equal((await as('emp2')('GET', `${t}/${ticket.id}`)).status, 404);
    const all = (await as('sup')('GET', t)).body;
    assert.deepEqual(
      all.map((x) => x.number),
      [1, 2],
      'la prioridad alta va primero',
    );
    assert.deepEqual(
      (await as('sup')('GET', `${t}?q=%232`)).body.map((x) => x.number),
      [2],
    );
    assert.deepEqual(
      (await as('sup')('GET', `${t}?category=purchases`)).body.map((x) => x.number),
      [2],
    );
  });

  it('el empleado no asigna ni cambia prioridad; el supervisor asigna y llega el correo', async () => {
    assert.equal((await as('emp')('PATCH', `${t}/${ticket.id}`, { assigneeMemberId: member.emp })).status, 403);
    assert.equal((await as('emp')('PATCH', `${t}/${ticket.id}`, { status: 'resolved' })).status, 403);
    assert.equal(
      (await as('sup')('PATCH', `${t}/${ticket.id}`, { assigneeMemberId: member.out ?? '00000000-0000-4000-8000-000000000000' })).status,
      400,
    );
    const res = await as('sup')('PATCH', `${t}/${ticket.id}`, { assigneeMemberId: member.emp2, priority: 'urgent' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'assigned');
    assert.equal(res.body.assigneeMemberId, member.emp2);
    const mail = [...sentEmails].reverse().find((m) => m.to === emails.emp2 && m.subject.includes('Te asignaron el ticket #1'));
    assert.ok(mail, 'al responsable le llega el aviso');
    assert.match(mail.text, new RegExp(`/empresa/${company.id}/tickets/${ticket.id}`));
  });

  it('el responsable lo ve, lo trabaja y lo resuelve; a quien lo pidió le llega el correo', async () => {
    const detail = (await as('emp2')('GET', `${t}/${ticket.id}`)).body;
    assert.deepEqual(detail.can.statuses.sort(), ['in_progress', 'resolved']);
    assert.equal(detail.can.manage, false);
    assert.equal((await as('emp2')('PATCH', `${t}/${ticket.id}`, { status: 'closed' })).status, 403);
    assert.equal((await as('emp2')('PATCH', `${t}/${ticket.id}`, { status: 'in_progress' })).body.status, 'in_progress');
    assert.equal((await as('emp2')('POST', `${t}/${ticket.id}/comments`, { body: 'Era el cable de poder. Lo cambié.' })).status, 201);
    const res = await as('emp2')('PATCH', `${t}/${ticket.id}`, { status: 'resolved' });
    assert.equal(res.body.status, 'resolved');
    assert.ok(res.body.resolvedAt);
    assert.ok([...sentEmails].some((m) => m.to === emails.emp && m.subject.includes('Tu ticket #1 quedó resuelto')));
  });

  it('quien lo pidió lo reabre o lo cierra, y todo queda en el historial', async () => {
    let detail = (await as('emp')('GET', `${t}/${ticket.id}`)).body;
    assert.deepEqual(detail.can.statuses.sort(), ['closed', 'open']);
    const reopened = await as('emp')('PATCH', `${t}/${ticket.id}`, { status: 'open' });
    assert.equal(reopened.body.status, 'assigned', 'si tiene responsable vuelve a «Asignado»');
    assert.equal(reopened.body.resolvedAt, null);
    assert.equal((await as('emp')('PATCH', `${t}/${ticket.id}`, { status: 'closed' })).body.status, 'closed');
    detail = (await as('emp')('GET', `${t}/${ticket.id}`)).body;
    assert.deepEqual(
      detail.events.map((e) => e.kind),
      ['assign', 'status', 'priority', 'status', 'comment', 'status', 'status', 'status'],
    );
    assert.equal(detail.events[0].body.startsWith('Asignado a'), true);
    assert.equal(detail.events[4].body, 'Era el cable de poder. Lo cambié.');
    assert.equal(detail.events.at(-1).body, 'Asignado → Cerrado');
    assert.equal(detail.description, 'Desde esta mañana no enciende.');
  });

  it('las cifras cuentan pendientes, sin asignar y tiempo de solución', async () => {
    const sup = (await as('sup')('GET', `${t}/summary`)).body;
    assert.equal(sup.active, 1);
    assert.equal(sup.unassigned, 1);
    assert.equal(sup.byStatus.closed, 1);
    assert.equal(sup.resolved30d, 0, 'se reabrió, así que ya no cuenta como resuelto');
    const emp = (await as('emp2')('GET', `${t}/summary`)).body;
    assert.equal(emp.active, 1, 'solo el que pidió');
    assert.equal(emp.mine, 0);
  });

  it('solo un administrador borra', async () => {
    assert.equal((await as('sup')('DELETE', `${t}/${ticket.id}`)).status, 403);
    assert.equal((await as('owner')('DELETE', `${t}/${ticket.id}`)).status, 204);
    assert.equal((await as('owner')('GET', `${t}/${ticket.id}`)).status, 404);
  });
});
