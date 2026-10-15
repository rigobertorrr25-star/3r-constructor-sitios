// Pruebas de integración del alertas de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { AlertsDailyService } = await import('../dist/alerts/alerts-daily.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  hr: `alr.hr.${stamp}@example.com`,
  owner: `alr.owner.${stamp}@example.com`,
  emp: `alr.emp.${stamp}@example.com`,
  emp2: `alr.emp2.${stamp}@example.com`,
  sup: `alr.sup.${stamp}@example.com`,
  out: `alr.out.${stamp}@example.com`,
  staff: `alr.staff.${stamp}@example.com`,
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

describe('alertas', () => {
  let al;
  const member = {};
  const alertsOf = async (who) => (await as(who)('GET', al)).body;

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
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      member[Object.keys(emails).find((x) => emails[x] === m.user.email)] = m.id;
    }
    al = `/companies/${company.id}/alerts`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'alr.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo de alertas no se crean avisos', async () => {
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['tickets'] });
    const t = (await as('emp')('POST', `/companies/${company.id}/tickets`, { title: 'Sin luz en caja', description: 'Se fue la luz', category: 'maintenance', priority: 'urgent' })).body;
    await as('sup')('PATCH', `/companies/${company.id}/tickets/${t.id}`, { assigneeMemberId: member.emp2 });
    assert.equal(await prisma.notification.count({ where: { companyId: company.id } }), 0);
    assert.equal((await as('emp')('GET', al)).status, 403);
  });

  it('con alertas, cada módulo avisa a quien le toca', async () => {
    const keys = ['alerts', 'tickets', 'requests', 'announcements', 'employees', 'documents'];
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys })).status, 200);
    const t = (await as('emp')('POST', `/companies/${company.id}/tickets`, { title: 'Nevera dañada', description: 'No enfría nada', category: 'maintenance', priority: 'urgent' })).body;
    assert.ok((await alertsOf('sup')).items.some((i) => i.title.startsWith('Nuevo ticket urgente')));
    assert.equal((await alertsOf('emp')).items.length, 0, 'a quien lo creó no');
    await as('sup')('PATCH', `/companies/${company.id}/tickets/${t.id}`, { assigneeMemberId: member.emp2 });
    const emp2 = await alertsOf('emp2');
    assert.equal(emp2.items[0].title, `Te asignaron el ticket #${t.number}`);
    assert.equal(emp2.items[0].href, `tickets/${t.id}`);
    await as('emp2')('POST', `/companies/${company.id}/tickets/${t.id}/comments`, { body: 'Voy en camino' });
    assert.ok((await alertsOf('emp')).items.some((i) => i.title.startsWith('Nuevo comentario')));
    assert.equal((await alertsOf('emp2')).items.some((i) => i.title.startsWith('Nuevo comentario')), false);

    const r = (await as('emp')('POST', `/companies/${company.id}/requests`, { type: 'permission', startDate: '2026-12-01', reason: 'Cita médica' })).body;
    assert.ok((await alertsOf('sup')).items.some((i) => i.href === `solicitudes/${r.id}`));
    await as('hr')('POST', `/companies/${company.id}/requests/${r.id}/decision`, { decision: 'approve', note: 'Listo' });
    assert.ok((await alertsOf('emp')).items.some((i) => i.title.includes('quedó aprobada')));

    await as('hr')('POST', `/companies/${company.id}/announcements`, { title: 'Nuevo horario', body: 'Abrimos a las 7' });
    for (const k of ['owner', 'emp', 'emp2', 'sup']) assert.ok((await alertsOf(k)).items.some((i) => i.title === 'Noticia: Nuevo horario'), k);
    assert.equal((await alertsOf('hr')).items.some((i) => i.title === 'Noticia: Nuevo horario'), false);
  });

  it('marcar leído uno o todos; nadie lee los avisos de otro', async () => {
    const list = await alertsOf('emp');
    assert.ok(list.unread >= 3);
    assert.equal((await as('emp2')('POST', `${al}/${list.items[0].id}/read`)).status, 404);
    const res = await as('emp')('POST', `${al}/${list.items[0].id}/read`);
    assert.equal(res.status, 200);
    assert.equal(res.body.href, list.items[0].href);
    assert.equal((await as('emp')('GET', `${al}/count`)).body.unread, list.unread - 1);
    await as('emp')('POST', `${al}/read-all`);
    assert.equal((await as('emp')('GET', `${al}/count`)).body.unread, 0);
  });

  it('la revisión diaria avisa cumpleaños, vencimientos y solicitudes sin respuesta, sin repetir, y manda un resumen', async () => {
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const inDays = (n) => new Date(new Date(`${todayIso}T00:00:00Z`).getTime() + n * 86400000);
    await prisma.employeeProfile.create({ data: { memberId: member.emp, companyId: company.id, birthDate: new Date(`1995-${todayIso.slice(5)}T00:00:00Z`), contractEnd: inDays(7) } });
    await prisma.companyDocument.create({
      data: { companyId: company.id, category: 'policy', title: 'Póliza de seguro', fileName: 'p.pdf', contentType: 'application/pdf', storageKey: `x-${stamp}.pdf`, status: 'ready', expiresOn: inDays(30) },
    });
    const stale = await prisma.leaveRequest.create({
      data: { companyId: company.id, memberId: member.emp2, type: 'vacation', startDate: inDays(20), endDate: inDays(22), days: 3, reason: 'Viaje', status: 'pending' },
    });
    await prisma.leaveRequest.update({ where: { id: stale.id }, data: { updatedAt: new Date(Date.now() - 3 * 86400000) } });
    const daily = app.get(AlertsDailyService);
    const before = sentEmails.length;
    const first = await daily.run();
    assert.ok(first.created >= 4);
    const sup = (await alertsOf('sup')).items.map((i) => i.title);
    assert.ok(sup.some((t) => t.startsWith('Hoy cumple años')));
    assert.ok(sup.some((t) => t.includes('lleva más de 2 días sin respuesta')));
    const hr = (await alertsOf('hr')).items.map((i) => i.title);
    assert.ok(hr.some((t) => t.includes('vence en 7 días')), 'contrato');
    assert.ok(hr.some((t) => t === 'Póliza de seguro vence en 30 días'));
    assert.equal((await alertsOf('emp')).items.some((i) => i.title.startsWith('Hoy cumple años')), false, 'al cumpleañero no');
    const digest = sentEmails.slice(before).find((m) => m.to === emails.hr);
    assert.ok(digest, 'resumen por correo');
    assert.match(digest.subject, /avisos? nuevos? en Avisos/);
    const second = await daily.run();
    assert.equal(second.created, 0, 'no repite');
    assert.equal(sentEmails.slice(before).filter((m) => m.to === emails.hr).length, 1, 'el resumen no se repite');
  });

  it('el endpoint interno exige la clave del cron', async () => {
    assert.ok([401, 503].includes((await call('POST', '/internal/alerts/run')).status));
  });
});
