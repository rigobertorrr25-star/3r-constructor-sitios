// Pruebas de integración del asistente con IA (sin llave: usa el cliente de prueba, que no llama a nadie).
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

process.loadEnvFile('.env');
delete process.env.ANTHROPIC_API_KEY;
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');
const { FakeAiClient } = await import('../dist/ai/ai-client.js');
const { chunks, terms } = await import('../dist/assistant/text.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `ia.owner.${stamp}@example.com`,
  hr: `ia.hr.${stamp}@example.com`,
  emp: `ia.emp.${stamp}@example.com`,
  staff: `ia.staff.${stamp}@example.com`,
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
const makePdf = async (lines) => {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  const p = d.addPage();
  lines.forEach((l, i) => p.drawText(l, { x: 50, y: 750 - i * 20, size: 11, font: f }));
  return Buffer.from(await d.save());
};

describe('asistente con IA', () => {
  const a = () => `/companies/${company.id}/assistant`;
  const docs = {};
  const upload = async (meta, file, contentType = 'application/pdf') => {
    const d = `/companies/${company.id}/documents`;
    const res = await as('hr')('POST', `${d}/uploads`, { contentType, size: file.length, ...meta });
    await fetch(res.body.upload.url, { method: 'PUT', headers: res.body.upload.headers, body: file });
    await as('hr')('POST', `${d}/${res.body.documentId}/confirm`);
    return res.body.documentId;
  };

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
    company = (await as('owner')('POST', '/companies', { name: `Asistente ${stamp}` })).body;
    for (const [k, role] of [
      ['hr', 'hr'],
      ['emp', 'employee'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['documents', 'knowledge', 'ai_assistant'] });
    await as('owner')('POST', `/companies/${company.id}/knowledge`, {
      title: 'Horario de la tienda',
      body: 'Abrimos de lunes a sábado de 8 de la mañana a 6 de la tarde. Los domingos está cerrado.',
      audience: 'team',
      status: 'published',
    });
    await as('owner')('POST', `/companies/${company.id}/knowledge`, {
      title: 'Borrador secreto',
      body: 'Este borrador habla del horario nocturno que aún no existe.',
      audience: 'team',
      status: 'draft',
    });
    docs.policy = await upload(
      { title: 'Reglamento interno', category: 'policy', fileName: 'reglamento.pdf' },
      await makePdf(['Vacaciones: cada empleado tiene 15 dias habiles de vacaciones al ano.', 'Se piden con 15 dias de anticipacion.']),
    );
    docs.payroll = await upload(
      { title: 'Escala salarial', category: 'policy', fileName: 'salarios.pdf', audience: 'hr' },
      await makePdf(['Escala salarial: el salario del cargo de cajero es 1.800.000 pesos.']),
    );
    docs.image = await upload({ title: 'Foto del local', category: 'other', fileName: 'local.png' }, Buffer.from('png'), 'image/png');
  });

  after(async () => {
    await prisma?.company.deleteMany({ where: { id: company?.id } });
    await prisma?.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await app?.close();
  });

  it('parte el texto y saca las palabras para buscar', () => {
    assert.deepEqual(terms('¿Cuántos días de vacaciones tengo?'), ['dias', 'vacacion']);
    const parts = chunks(`${'Uno. '.repeat(400)}\n\nDos.`);
    assert.ok(parts.length >= 2 && parts.every((p) => p.length <= 1600));
  });

  it('el administrador escoge qué documentos lee', async () => {
    const o = await as('owner')('GET', a());
    assert.equal(o.status, 200);
    assert.equal(o.body.enabled, true);
    assert.equal(o.body.articles, 1, 'solo los publicados');
    assert.equal(o.body.documents.length, 3);
    assert.equal(o.body.documents.find((d) => d.id === docs.image).readable, false);
    assert.equal((await as('emp')('PUT', `${a()}/documents/${docs.policy}`, { enabled: true })).status, 403);
    const r = await as('owner')('PUT', `${a()}/documents/${docs.policy}`, { enabled: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.aiStatus, 'ready');
    assert.ok(r.body.parts >= 1);
    await as('owner')('PUT', `${a()}/documents/${docs.payroll}`, { enabled: true });
    assert.equal((await as('owner')('PUT', `${a()}/documents/${docs.image}`, { enabled: true })).status, 400);
    const e = await as('emp')('GET', a());
    assert.equal(e.body.canManage, false);
    assert.equal(e.body.documents, undefined, 'el empleado no ve la configuración');
  });

  it('responde con los documentos y dice de dónde lo sacó', async () => {
    const r = await as('emp')('POST', `${a()}/ask`, { question: '¿Cuántos días de vacaciones tengo?' });
    assert.equal(r.status, 201);
    assert.equal(r.body.answered, true);
    assert.match(r.body.answer, /15 dias habiles/);
    assert.deepEqual(
      r.body.sources.map((s) => s.title),
      ['Reglamento interno'],
    );
    const sent = FakeAiClient.requests.at(-1);
    assert.match(sent.system, /Responde SOLO con la información de las fuentes/);
    assert.ok(!sent.messages.at(-1).content.includes('Escala salarial'), 'al empleado no le llega lo que es solo de RR. HH.');
  });

  it('respeta quién puede ver cada documento', async () => {
    await as('emp')('POST', `${a()}/ask`, { question: '¿Cuál es el salario del cajero según la escala salarial?' });
    assert.ok(!FakeAiClient.requests.at(-1)?.messages.at(-1).content.includes('1.800.000'));
    const hr = await as('hr')('POST', `${a()}/ask`, { question: '¿Cuál es el salario del cajero según la escala salarial?' });
    assert.match(hr.body.answer, /1\.800\.000/);
  });

  it('los borradores no cuentan; si no encuentra nada, no gasta una llamada', async () => {
    const before = FakeAiClient.requests.length;
    const r = await as('emp')('POST', `${a()}/ask`, { question: '¿Hay parqueadero para motos?' });
    assert.equal(r.body.answered, false);
    assert.equal(FakeAiClient.requests.length, before);
    const n = await as('emp')('POST', `${a()}/ask`, { question: 'horario nocturno' });
    assert.ok(!FakeAiClient.requests.at(-1).messages.at(-1).content.includes('Borrador secreto'));
    assert.ok(n.body.sources.every((s) => s.title !== 'Borrador secreto'));
  });

  it('guarda el historial, la opinión y lo que no supo responder', async () => {
    const mine = (await as('emp')('GET', a())).body.history;
    assert.equal(mine.length, 4);
    assert.equal((await as('hr')('POST', `${a()}/questions/${mine[0].id}/feedback`, { helpful: true })).status, 404, 'solo quien preguntó');
    assert.equal((await as('emp')('POST', `${a()}/questions/${mine[0].id}/feedback`, { helpful: false })).status, 204);
    const o = (await as('owner')('GET', a())).body;
    assert.ok(o.unanswered.some((q) => q.question === '¿Hay parqueadero para motos?'));
    assert.equal(o.month.notHelpful, 1);
  });

  it('apagar un documento borra su texto', async () => {
    await as('owner')('PUT', `${a()}/documents/${docs.policy}`, { enabled: false });
    assert.equal(await prisma.documentChunk.count({ where: { documentId: docs.policy } }), 0);
    const r = await as('emp')('POST', `${a()}/ask`, { question: '¿Cuántos días de vacaciones tengo?' });
    assert.equal(r.body.answered, false);
  });

  it('sin el módulo no entra nadie', async () => {
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['documents'] });
    assert.equal((await as('owner')('GET', a())).status, 403);
  });
});
