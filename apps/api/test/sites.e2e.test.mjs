// Pruebas de integración de sitios, páginas, versiones y límites del plan.
// Requieren: npm run dev:db, npm run db:seed y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emailA = `sites.a.${stamp}@example.com`;
const emailB = `sites.b.${stamp}@example.com`;

let app;
let prisma;
let base;
let tokenA;
let tokenB;

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const signup = async (email) => {
  await call('POST', '/auth/register', { body: { email, password, acceptPrivacy: true } });
  return (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
};

const doc = (headingText) => ({
  version: 1,
  sections: [
    {
      id: 's1',
      type: 'hero',
      components: [{ id: 'h1', type: 'heading', content: headingText, styles: { fontSize: { desktop: 52 } } }],
    },
  ],
});

describe('sites y pages', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    tokenA = await signup(emailA);
    tokenB = await signup(emailB);
  });

  after(async () => {
    try {
      // Las suscripciones/facturas no se borran en cascada (registros de facturación): se limpian aparte.
      const owned = { user: { email: { startsWith: 'sites.' } } };
      await prisma.invoice.deleteMany({ where: owned });
      await prisma.subscription.deleteMany({ where: owned });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'sites.' } } });
    } finally {
      await app.close();
    }
  });

  let site;
  let homePage;

  it('exige autenticación', async () => {
    assert.equal((await call('GET', '/sites')).status, 401);
    assert.equal((await call('GET', '/templates')).status, 401);
  });

  it('lista las plantillas del seed', async () => {
    const res = await call('GET', '/templates', { token: tokenA });
    assert.equal(res.status, 200);
    const slugs = res.body.map((t) => t.slug);
    for (const s of ['blank', 'restaurant-caribbean', 'portfolio']) assert.ok(slugs.includes(s), s);
    assert.ok(!('content' in res.body[0]), 'el listado no debe traer el contenido');
  });

  it('crea un sitio desde plantilla: página Inicio con la versión 1 clonada', async () => {
    const res = await call('POST', '/sites', {
      token: tokenA,
      body: { name: 'Restaurante Caribe', templateSlug: 'restaurant-caribbean' },
    });
    assert.equal(res.status, 201);
    site = res.body;
    assert.equal(site.slug, 'restaurante-caribe');
    assert.equal(site.status, 'draft');
    assert.equal(site._count.pages, 1);

    const detail = (await call('GET', `/sites/${site.id}`, { token: tokenA })).body;
    homePage = detail.pages[0];
    assert.equal(homePage.isHomepage, true);
    assert.equal(homePage.slug, 'inicio');

    const content = (await call('GET', `/pages/${homePage.id}/content`, { token: tokenA })).body;
    assert.equal(content.versionNumber, 1);
    assert.equal(content.content.sections[0].type, 'hero');
  });

  it('la plantilla original no cambia al editar el sitio', async () => {
    const before = await prisma.template.findUnique({ where: { slug: 'restaurant-caribbean' } });
    await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: doc('Cambiado') } });
    const after = await prisma.template.findUnique({ where: { slug: 'restaurant-caribbean' } });
    assert.deepEqual(after.content, before.content);
  });

  it('el plan gratis permite un solo sitio (403 PLAN_LIMIT) y uno de pago amplía el límite', async () => {
    const blocked = await call('POST', '/sites', { token: tokenA, body: { name: 'Segundo sitio' } });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'PLAN_LIMIT');

    const user = await prisma.user.findUnique({ where: { email: emailA } });
    const business = await prisma.plan.findUnique({ where: { name: 'Business' } });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: business.id,
        stripeCustomerId: `cus_test_${stamp}`,
        stripeSubscriptionId: `sub_test_${stamp}`,
        status: 'active',
      },
    });
    const ok = await call('POST', '/sites', { token: tokenA, body: { name: 'Restaurante Caribe' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.slug, 'restaurante-caribe-2', 'el slug repetido recibe sufijo');
  });

  it('otro usuario no ve ni toca los sitios ni las páginas ajenas (404)', async () => {
    assert.deepEqual((await call('GET', '/sites', { token: tokenB })).body, []);
    assert.equal((await call('GET', `/sites/${site.id}`, { token: tokenB })).status, 404);
    assert.equal((await call('PATCH', `/sites/${site.id}`, { token: tokenB, body: { name: 'Hackeado' } })).status, 404);
    assert.equal((await call('DELETE', `/sites/${site.id}`, { token: tokenB })).status, 404);
    assert.equal((await call('GET', `/pages/${homePage.id}/content`, { token: tokenB })).status, 404);
    assert.equal((await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenB, body: { content: doc('x') } })).status, 404);
    assert.equal((await call('POST', `/sites/${site.id}/pages`, { token: tokenB, body: { title: 'Intruso' } })).status, 404);
  });

  it('crea páginas con slug automático, rechaza slugs repetidos y protege el inicio', async () => {
    const about = await call('POST', `/sites/${site.id}/pages`, { token: tokenA, body: { title: 'Nosotros' } });
    assert.equal(about.status, 201);
    assert.equal(about.body.slug, 'nosotros');

    const dup = await call('POST', `/sites/${site.id}/pages`, { token: tokenA, body: { title: 'Otra', slug: 'nosotros' } });
    assert.equal(dup.status, 409);

    const bad = await call('POST', `/sites/${site.id}/pages`, { token: tokenA, body: { title: 'Mala', slug: 'Con Espacios' } });
    assert.equal(bad.status, 400);

    const patched = await call('PATCH', `/pages/${about.body.id}`, { token: tokenA, body: { seoTitle: 'Sobre nosotros' } });
    assert.equal(patched.body.seoTitle, 'Sobre nosotros');

    assert.equal((await call('DELETE', `/pages/${homePage.id}`, { token: tokenA })).status, 400);
    assert.equal((await call('DELETE', `/pages/${about.body.id}`, { token: tokenA })).status, 204);
  });

  it('rechaza documentos del editor inválidos (400)', async () => {
    const send = (content) => call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content } });
    assert.equal((await send({ version: 2, sections: [] })).status, 400);
    assert.equal((await send({ version: 1, sections: 'no' })).status, 400);
    assert.equal((await send({ version: 1, sections: [{ id: 'a', type: 'hero', components: [{ id: 'b', type: 'script' }] }] })).status, 400);
    assert.equal((await send({ version: 1, sections: [{ id: 'dup', type: 'hero' }, { id: 'dup', type: 'hero' }] })).status, 400);
    assert.equal((await send({ version: 1, sections: [{ id: 'mal id!', type: 'hero' }] })).status, 400);
  });

  it('autosave actualiza en el lugar; guardar versión y restaurar crean versiones nuevas', async () => {
    const a = await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: doc('Uno') } });
    assert.equal(a.status, 200);
    const b = await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: doc('Dos') } });
    assert.equal(b.body.versionNumber, a.body.versionNumber, 'sin publicar no se acumulan versiones');

    const snap = await call('POST', `/pages/${homePage.id}/versions`, { token: tokenA, body: {} });
    assert.equal(snap.status, 201);
    assert.equal(snap.body.versionNumber, a.body.versionNumber + 1);

    await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: doc('Tres') } });
    const versions = (await call('GET', `/pages/${homePage.id}/versions`, { token: tokenA })).body;
    assert.equal(versions[0].versionNumber, snap.body.versionNumber);
    assert.ok(!('content' in versions[0]));

    const restored = await call('POST', `/pages/${homePage.id}/versions/${snap.body.versionId}/restore`, { token: tokenA });
    assert.equal(restored.status, 201);
    const now = (await call('GET', `/pages/${homePage.id}/content`, { token: tokenA })).body;
    assert.equal(now.versionNumber, restored.body.versionNumber);
    assert.equal(now.content.sections[0].components[0].content, 'Tres');
  });

  it('si la versión ya está publicada, autosave abre una nueva sin tocarla', async () => {
    const latest = (await call('GET', `/pages/${homePage.id}/content`, { token: tokenA })).body;
    await prisma.publication.create({
      data: { siteId: site.id, versionId: latest.versionId, status: 'published', publishedAt: new Date() },
    });
    const saved = await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: doc('Nuevo borrador') } });
    assert.equal(saved.body.versionNumber, latest.versionNumber + 1);
    const untouched = await prisma.pageVersion.findUnique({ where: { id: latest.versionId } });
    assert.equal(untouched.content.sections[0].components[0].content, 'Tres');
  });

  it('acepta documentos grandes (más de 100 KB) y rechaza más de 1 MB', async () => {
    const big = (n) => ({
      version: 1,
      sections: [{
        id: 's', type: 'generic',
        components: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, type: 'text', content: 'x'.repeat(200) })),
      }],
    });
    assert.equal((await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: big(700) } })).status, 200);
    assert.equal((await call('POST', `/pages/${homePage.id}/autosave`, { token: tokenA, body: { content: big(4900) } })).status, 400);
  });

  it('eliminar el sitio borra sus páginas y versiones', async () => {
    assert.equal((await call('DELETE', `/sites/${site.id}`, { token: tokenA })).status, 204);
    assert.equal(await prisma.page.count({ where: { siteId: site.id } }), 0);
    assert.equal(await prisma.pageVersion.count({ where: { pageId: homePage.id } }), 0);
    assert.equal((await call('GET', `/sites/${site.id}`, { token: tokenA })).status, 404);
  });
});
