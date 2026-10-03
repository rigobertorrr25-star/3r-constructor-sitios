// Pruebas de integración de Textos con IA (sin llave: usa el cliente de prueba, que no llama a nadie).
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
delete process.env.ANTHROPIC_API_KEY;
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');
const { FakeAiClient } = await import('../dist/ai/ai-client.js');
const { splitOptions } = await import('../dist/ai-content/ai-content.service.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `tx.owner.${stamp}@example.com`,
  sup: `tx.sup.${stamp}@example.com`,
  emp: `tx.emp.${stamp}@example.com`,
  staff: `tx.staff.${stamp}@example.com`,
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

describe('textos con IA', () => {
  const t = () => `/companies/${company.id}/ai-content`;

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
    company = (await as('owner')('POST', '/companies', { name: `Textos ${stamp}`, city: 'Cartagena', industry: 'Restaurante' })).body;
    for (const [k, role] of [
      ['sup', 'supervisor'],
      ['emp', 'employee'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['ai_content'] });
  });

  after(async () => {
    await prisma?.company.deleteMany({ where: { id: company?.id } });
    await prisma?.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await app?.close();
  });

  it('separa las opciones que escribe la IA', () => {
    assert.deepEqual(splitOptions('Opción 1: Hola\n---\nChao\n\n---\n Tercera '), ['Hola', 'Chao', 'Tercera']);
  });

  it('escribe tres opciones con los datos del negocio', async () => {
    const r = await as('sup')('POST', t(), { kind: 'social', tone: 'divertido', topic: '2x1 en café los viernes' });
    assert.equal(r.status, 201);
    assert.equal(r.body.options.length, 3);
    const sent = FakeAiClient.requests.at(-1);
    assert.match(sent.system, /Restaurante, Cartagena/);
    assert.match(sent.system, /No inventes precios/);
    assert.match(sent.messages[0].content, /Instagram/);
    assert.match(sent.messages[0].content, /alegre y divertido/);
    assert.match(sent.messages[0].content, /<tema>\n2x1 en café los viernes\n<\/tema>/);
  });

  it('valida el pedido y los permisos', async () => {
    assert.equal((await as('sup')('POST', t(), { kind: 'poema', topic: 'algo' })).status, 400);
    assert.equal((await as('sup')('POST', t(), { kind: 'email', topic: 'x' })).status, 400);
    assert.equal((await as('emp')('POST', t(), { kind: 'email', topic: 'Promoción de octubre' })).status, 403);
  });

  it('guarda el historial de la empresa', async () => {
    await as('owner')('POST', t(), { kind: 'product', topic: 'Torta de zanahoria con queso crema' });
    const o = await as('owner')('GET', t());
    assert.equal(o.body.enabled, true);
    assert.equal(o.body.history.length, 2);
    assert.equal(o.body.history[0].kind, 'product');
    assert.equal(o.body.history[0].tone, 'cercano');
    assert.equal(o.body.usage.today, 2);
    assert.ok(o.body.kinds.some((k) => k.key === 'seo'));
  });
});
