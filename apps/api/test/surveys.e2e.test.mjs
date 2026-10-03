// Pruebas de integración del encuestas de la plataforma empresarial.
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
  owner: `srv.owner.${stamp}@example.com`,
  emp: `srv.emp.${stamp}@example.com`,
  emp2: `srv.emp2.${stamp}@example.com`,
  sup: `srv.sup.${stamp}@example.com`,
  out: `srv.out.${stamp}@example.com`,
  staff: `srv.staff.${stamp}@example.com`,
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

const pub = (method, path, body) => call(method, `/public/surveys/${path}`, { body });

describe('encuestas', () => {
  let s;
  let clima;
  let clientes;

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
    company = (await as('owner')('POST', '/companies', { name: `Encuestas ${stamp}` })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'supervisor']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    s = `/companies/${company.id}/surveys`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'srv.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; solo supervisor en adelante crea', async () => {
    assert.equal((await as('emp')('GET', s)).status, 403);
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['surveys', 'alerts'] });
    assert.equal((await as('emp')('GET', s)).status, 200);
    assert.equal((await as('emp')('POST', s, { title: 'Mía', audience: 'team', questions: [{ kind: 'text', text: 'Hola?' }] })).status, 403);
    assert.equal((await as('sup')('POST', s, { title: 'Sin opciones', audience: 'team', questions: [{ kind: 'choice', text: '¿Cuál?', options: ['Una'] }] })).status, 400);
  });

  it('encuesta de clima anónima: se abre, avisa al equipo y cada uno responde una sola vez', async () => {
    const res = await as('sup')('POST', s, {
      title: 'Clima laboral de octubre',
      audience: 'team',
      anonymous: true,
      questions: [
        { kind: 'rating', text: '¿Qué tan a gusto estás en el trabajo?' },
        { kind: 'choice', text: '¿Cómo te parecen los turnos?', options: ['Bien', 'Regular', 'Mal'] },
        { kind: 'text', text: '¿Qué mejorarías?', required: false },
      ],
    });
    assert.equal(res.status, 201);
    clima = res.body;
    assert.equal((await as('emp')('GET', `${s}/${clima.id}`)).status, 404, 'en borrador el equipo no la ve');
    assert.equal((await as('sup')('POST', `${s}/${clima.id}/open`)).body.open, true);
    const emp = await prisma.companyMember.findFirst({ where: { companyId: company.id, user: { email: emails.emp } } });
    assert.ok(await prisma.notification.findFirst({ where: { memberId: emp.id, title: 'Nueva encuesta: Clima laboral de octubre' } }));
    assert.equal((await as('emp')('GET', `${s}/summary`)).body.pendingToAnswer, 1);
    const [q1, q2, q3] = clima.questions;
    assert.equal((await as('emp')('POST', `${s}/${clima.id}/responses`, { answers: { [q2.id]: 'Bien' } })).status, 400, 'falta la obligatoria');
    assert.equal((await as('emp')('POST', `${s}/${clima.id}/responses`, { answers: { [q1.id]: 7, [q2.id]: 'Bien' } })).status, 400, 'fuera de rango');
    assert.equal((await as('emp')('POST', `${s}/${clima.id}/responses`, { answers: { [q1.id]: 4, [q2.id]: 'Otra' } })).status, 400, 'opción que no existe');
    assert.equal((await as('emp')('POST', `${s}/${clima.id}/responses`, { answers: { [q1.id]: 4, [q2.id]: 'Bien', [q3.id]: 'Más ventiladores' } })).status, 201);
    assert.equal((await as('emp')('POST', `${s}/${clima.id}/responses`, { answers: { [q1.id]: 5, [q2.id]: 'Bien' } })).status, 400, 'una sola vez');
    assert.equal((await as('emp2')('POST', `${s}/${clima.id}/responses`, { answers: { [q1.id]: 2, [q2.id]: 'Mal' } })).status, 201);
    assert.equal((await as('emp')('GET', `${s}/summary`)).body.pendingToAnswer, 0);
    const stored = await prisma.surveyResponse.findMany({ where: { surveyId: clima.id } });
    assert.ok(stored.every((r) => r.memberId === null), 'anónima: no se guarda quién');
  });

  it('resultados: promedio, conteos y textos; sin nombres en la anónima; empleados no los ven', async () => {
    assert.equal((await as('emp')('GET', `${s}/${clima.id}/results`)).status, 403);
    const r = (await as('sup')('GET', `${s}/${clima.id}/results`)).body;
    assert.equal(r.total, 2);
    assert.equal(r.questions[0].average, 3);
    assert.deepEqual(r.questions[1].counts, [{ option: 'Bien', count: 1 }, { option: 'Regular', count: 0 }, { option: 'Mal', count: 1 }]);
    assert.deepEqual(r.questions[2].texts, ['Más ventiladores']);
    assert.equal(r.participation.members, 4);
    assert.equal(r.participation.pending, undefined);
    assert.equal((await as('sup')('PUT', `${s}/${clima.id}`, { title: 'Otra', audience: 'team', questions: [{ kind: 'text', text: 'Cambio' }] })).status, 400, 'con respuestas no se cambian las preguntas');
  });

  it('encuesta para clientes con enlace público y NPS; cerrada ya no recibe', async () => {
    clientes = (await as('sup')('POST', s, {
      title: '¿Cómo te atendimos?',
      audience: 'public',
      questions: [
        { kind: 'nps', text: '¿Nos recomendarías?' },
        { kind: 'multi', text: '¿Qué te gustó?', options: ['Café', 'Atención', 'Precio'], required: false },
      ],
    })).body;
    const opened = (await as('sup')('POST', `${s}/${clientes.id}/open`)).body;
    assert.ok(opened.publicToken);
    const token = opened.publicToken;
    const view = await pub('GET', token);
    assert.equal(view.status, 200);
    assert.equal(view.body.company, `Encuestas ${stamp}`);
    const [nps, multi] = view.body.questions;
    for (const n of [10, 9, 8, 3]) assert.equal((await pub('POST', `${token}/responses`, { answers: { [nps.id]: n, [multi.id]: ['Café'] } })).status, 201);
    assert.equal((await pub('POST', `${token}/responses`, { answers: { [nps.id]: 11 } })).status, 400);
    const r = (await as('sup')('GET', `${s}/${clientes.id}/results`)).body;
    assert.equal(r.questions[0].nps, 25, '2 promotores − 1 detractor de 4');
    assert.equal(r.questions[1].counts[0].count, 4);
    await as('sup')('POST', `${s}/${clientes.id}/close`);
    assert.equal((await pub('POST', `${token}/responses`, { answers: { [nps.id]: 10 } })).status, 400);
    assert.equal((await pub('GET', 'x'.repeat(24))).status, 404);
  });

  it('en una del equipo con nombre, se sabe quién falta', async () => {
    const named = (await as('sup')('POST', s, { title: 'Uniformes', audience: 'team', questions: [{ kind: 'choice', text: '¿Talla?', options: ['S', 'M', 'L'] }] })).body;
    await as('sup')('POST', `${s}/${named.id}/open`);
    await as('emp')('POST', `${s}/${named.id}/responses`, { answers: { [named.questions[0].id]: 'M' } });
    const r = (await as('sup')('GET', `${s}/${named.id}/results`)).body;
    assert.equal(r.participation.pending.length, 3);
    assert.equal((await as('sup')('DELETE', `${s}/${named.id}`)).status, 204);
  });
});
