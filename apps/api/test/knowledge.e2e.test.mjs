// Pruebas de integración del centro de conocimiento de la plataforma empresarial.
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
  owner: `kno.owner.${stamp}@example.com`,
  emp: `kno.emp.${stamp}@example.com`,
  emp2: `kno.emp2.${stamp}@example.com`,
  sup: `kno.sup.${stamp}@example.com`,
  hr: `kno.hr.${stamp}@example.com`,
  staff: `kno.staff.${stamp}@example.com`,
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

const pub = (method, path, body) => call(method, `/public/help/${path}`, { body });

describe('centro de conocimiento', () => {
  let k;
  let manual;
  let faq;

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
    company = (await as('owner')('POST', '/companies', { name: `Conocimiento ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['emp2', 'employee'],
      ['sup', 'supervisor'],
      ['hr', 'hr'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    k = `/companies/${company.id}/knowledge`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'kno.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; escribir es de supervisor en adelante', async () => {
    assert.equal((await as('emp')('GET', k)).status, 403);
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['knowledge'] });
    assert.equal((await as('emp')('GET', k)).status, 200);
    const art = { title: 'Cómo abrir la caja', body: 'Pasos para abrir la caja en la mañana.', audience: 'team', status: 'published' };
    assert.equal((await as('emp')('POST', k, art)).status, 403);
    assert.equal((await as('sup')('POST', k, { ...art, body: 'corto' })).status, 400);
  });

  it('borradores ocultos, búsqueda, categorías, vistas y votos de una persona', async () => {
    manual = (
      await as('sup')('POST', k, {
        title: 'Cómo abrir la caja',
        body: '## Antes de abrir\n- Cuenta la base de $200.000\n- Revisa el datáfono\n\nAnota todo en el cuaderno.',
        category: 'Caja',
        audience: 'team',
        status: 'published',
        pinned: true,
      })
    ).body;
    const draft = (
      await as('sup')('POST', k, {
        title: 'Cierre de caja',
        body: 'Pendiente por escribir bien.',
        category: 'Caja',
        audience: 'team',
        status: 'draft',
      })
    ).body;
    faq = (
      await as('sup')('POST', k, {
        title: '¿Tienen domicilios?',
        body: 'Sí, de 11 a.m. a 9 p.m. en todo el centro.',
        category: 'Pedidos',
        audience: 'public',
        status: 'published',
      })
    ).body;
    const list = (await as('emp')('GET', k)).body;
    assert.equal(list.manage, false);
    assert.deepEqual(
      list.articles.map((a) => a.title),
      ['Cómo abrir la caja', '¿Tienen domicilios?'],
      'fijado primero; sin borradores',
    );
    assert.equal(list.articles[0].excerpt.startsWith('Antes de abrir. Cuenta la base de $200.000. Revisa'), true);
    assert.deepEqual(list.categories, [
      { name: 'Caja', count: 1 },
      { name: 'Pedidos', count: 1 },
    ]);
    assert.equal((await as('emp')('GET', `${k}/${draft.id}`)).status, 404);
    assert.equal((await as('sup')('GET', k)).body.articles.length, 3);
    assert.deepEqual(
      (await as('emp')('GET', `${k}?q=DATÁFONO`)).body.articles.map((a) => a.id),
      [manual.id],
      'busca en el texto, sin importar mayúsculas',
    );
    assert.deepEqual(
      (await as('emp')('GET', `${k}?q=datafono`)).body.articles.map((a) => a.id),
      [manual.id],
      'ni tildes',
    );
    assert.equal((await as('emp')('GET', `${k}?q=100%25`)).body.articles.length, 0, 'el % se busca tal cual');
    assert.deepEqual(
      (await as('emp')('GET', `${k}?category=Pedidos`)).body.articles.map((a) => a.id),
      [faq.id],
    );
    await as('emp')('GET', `${k}/${manual.id}`);
    await as('emp2')('GET', `${k}/${manual.id}`);
    await as('sup')('GET', `${k}/${manual.id}`);
    assert.equal((await prisma.knowledgeArticle.findUnique({ where: { id: manual.id } })).views, 2, 'quien lo escribió no suma vistas');
    await as('emp')('POST', `${k}/${manual.id}/vote`, { helpful: false });
    await as('emp')('POST', `${k}/${manual.id}/vote`, { helpful: true });
    await as('emp2')('POST', `${k}/${manual.id}/vote`, { helpful: true });
    const a = (await as('emp')('GET', `${k}/${manual.id}`)).body;
    assert.equal(a.myVote, true);
    assert.equal(a.helpful, undefined, 'el equipo no ve los conteos');
    const m = (await as('sup')('GET', `${k}/${manual.id}`)).body;
    assert.equal(m.helpful, 2, 'un voto por persona: cambiarlo no suma');
    assert.equal(m.notHelpful, 0);
    assert.deepEqual(m.related, [{ id: draft.id, title: 'Cierre de caja' }]);
    assert.equal(a.related.length, 0, 'el equipo no ve el borrador relacionado');
  });

  it('centro de ayuda público: solo lo de clientes; administradores lo prenden y apagan', async () => {
    assert.equal((await as('sup')('POST', `${k}/public-link`)).status, 403);
    const { helpToken } = (await as('owner')('POST', `${k}/public-link`)).body;
    assert.match(helpToken, /^[A-Za-z0-9_-]{16}$/);
    const page = (await pub('GET', helpToken)).body;
    assert.equal(page.company.name, `Conocimiento ${stamp}`);
    assert.deepEqual(
      page.articles.map((a) => a.id),
      [faq.id],
      'nada interno',
    );
    assert.equal((await pub('GET', `${helpToken}/${manual.id}`)).status, 404);
    assert.equal((await pub('GET', `${helpToken}/${faq.id}`)).body.title, '¿Tienen domicilios?');
    assert.equal((await pub('POST', `${helpToken}/${faq.id}/vote`, { helpful: true })).status, 200);
    assert.equal((await as('sup')('GET', `${k}/${faq.id}`)).body.helpful, 1);
    assert.equal((await pub('GET', `${helpToken}?q=domicilio`)).body.articles.length, 1);
    await as('owner')('DELETE', `${k}/public-link`);
    assert.equal((await pub('GET', helpToken)).status, 404, 'apagado deja de servir');
  });

  it('editar y borrar', async () => {
    assert.equal(
      (
        await as('sup')('PUT', `${k}/${faq.id}`, {
          title: '¿Hacen domicilios?',
          body: 'Sí, de 11 a.m. a 10 p.m.',
          audience: 'public',
          status: 'published',
        })
      ).status,
      200,
    );
    const a = (await as('emp')('GET', `${k}/${faq.id}`)).body;
    assert.equal(a.title, '¿Hacen domicilios?');
    assert.equal(a.category, null);
    assert.equal((await as('emp')('DELETE', `${k}/${faq.id}`)).status, 403);
    assert.equal((await as('sup')('DELETE', `${k}/${faq.id}`)).status, 204);
    assert.equal((await as('emp')('GET', `${k}/${faq.id}`)).status, 404);
  });
});
