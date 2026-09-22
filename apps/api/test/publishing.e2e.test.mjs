// Pruebas de integración de la publicación: publicar, servir, actualizar, despublicar y aislamiento.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
// Los archivos publicados de las pruebas van a una carpeta temporal, no a la real.
const publishDir = mkdtempSync(join(tmpdir(), '3r-publish-test-'));
process.env.PUBLISH_DIR = publishDir;
process.env.SITES_ROOT_HOST = 'localhost';
process.env.SITES_URL_TEMPLATE = 'http://{label}.localhost:3000';

const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = { owner: `publish.o.${stamp}@example.com`, other: `publish.x.${stamp}@example.com` };
let app, prisma, base;
const tokens = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta HTML o texto */
  }
  return { status: res.status, body: json, text, headers: res.headers };
};
const owner = (method, path, body) => call(method, path, { token: tokens.owner, body });
const live = (label, path = '') => call('GET', `/public/sites/${label}${path}`);

const doc = (heading, extra = []) => ({
  version: 1,
  sections: [
    {
      id: 'hero',
      type: 'hero',
      styles: { background: '#000103', paddingTop: { desktop: 96, mobile: 56 } },
      components: [
        { id: 'h1', type: 'heading', content: heading, styles: { fontSize: { desktop: 52, mobile: 34 } } },
        ...extra,
      ],
    },
  ],
});

describe('publicación', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const email of Object.values(emails)) await call('POST', '/auth/register', { body: { email, password } });
    // El dueño es del equipo (sin límite de sitios), como quien construye páginas de clientes.
    const user = await prisma.user.findUnique({ where: { email: emails.owner } });
    await prisma.userRole.create({ data: { userId: user.id, role: 'ADMIN' } });
    for (const [key, email] of Object.entries(emails)) tokens[key] = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
  });

  after(async () => {
    try {
      const mine = { email: { startsWith: 'publish.' } };
      await prisma.domain.deleteMany({ where: { site: { user: mine } } });
      await prisma.user.deleteMany({ where: mine });
    } finally {
      await app.close();
      rmSync(publishDir, { recursive: true, force: true });
    }
  });

  let site, home, label;

  it('crear el sitio de un cliente y su portada', async () => {
    const res = await owner('POST', '/sites', { name: 'Restaurante Caribe', templateSlug: 'restaurant-caribbean' });
    assert.equal(res.status, 201);
    site = res.body;
    home = (await owner('GET', `/sites/${site.id}`)).body.pages[0];
  });

  it('publicar exige sesión y ser el dueño', async () => {
    assert.equal((await call('POST', `/sites/${site.id}/publish`)).status, 401);
    assert.equal((await call('POST', `/sites/${site.id}/publish`, { token: tokens.other })).status, 404);
    assert.equal((await call('GET', `/sites/${site.id}/publication`, { token: tokens.other })).status, 404);
    assert.equal((await call('POST', `/sites/${site.id}/unpublish`, { token: tokens.other })).status, 404);
  });

  it('antes de publicar, el sitio no existe para el público', async () => {
    assert.equal((await live('restaurante-caribe')).status, 404);
    const status = await owner('GET', `/sites/${site.id}/publication`);
    assert.equal(status.body.published, false);
    assert.equal(status.body.url, null);
  });

  it('publica y devuelve la dirección propia del cliente', async () => {
    const res = await owner('POST', `/sites/${site.id}/publish`);
    assert.equal(res.status, 200);
    assert.equal(res.body.url, 'http://restaurante-caribe.localhost:3000');
    assert.equal(res.body.pages, 1);
    label = 'restaurante-caribe';

    const stored = await prisma.site.findUnique({ where: { id: site.id } });
    assert.equal(stored.status, 'published');
    const domain = await prisma.domain.findFirst({ where: { siteId: site.id } });
    assert.equal(domain.domain, 'restaurante-caribe.localhost');
    assert.equal(domain.type, 'subdomain');
    const job = await prisma.deploymentJob.findFirst({ where: { siteId: site.id } });
    assert.equal(job.status, 'succeeded');
    assert.ok(job.finishedAt);
  });

  it('sirve la página publicada sin sesión, con cabeceras de seguridad', async () => {
    const res = await live(label);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.ok(res.text.includes('Sabor del Caribe'));
    assert.ok(res.text.includes('<title>Restaurante Caribe</title>'));
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp.includes("default-src 'none'") && csp.includes('sandbox') && !csp.includes('script-src'), csp);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(!/<script/i.test(res.text));
  });

  it('robots.txt y sitemap.xml apuntan a la dirección del cliente', async () => {
    const robots = await live(label, '/robots.txt');
    assert.equal(robots.status, 200);
    assert.ok(robots.text.includes('Sitemap: http://restaurante-caribe.localhost:3000/sitemap.xml'));
    const sitemap = await live(label, '/sitemap.xml');
    assert.match(sitemap.headers.get('content-type'), /xml/);
    assert.ok(sitemap.text.includes('<loc>http://restaurante-caribe.localhost:3000/</loc>'));
  });

  it('rutas inexistentes o maliciosas dan 404 sin filtrar archivos', async () => {
    for (const path of ['/no-existe', '/../manifest.json', '/%2e%2e/%2e%2e/etc/passwd', '/manifest.json', '/p-contacto', '/a/b/c', '/index.html.bak', '/inicio']) {
      const res = await live(label, path);
      assert.equal(res.status, 404, path);
      assert.ok(!res.text.includes('siteName'), `no debe filtrar el manifiesto en ${path}`);
    }
    assert.equal((await live('no-existe-nunca')).status, 404);
    assert.equal((await live('UPPER_case!')).status, 404);
  });

  it('varias páginas: menú, rutas y sitemap', async () => {
    const page = await owner('POST', `/sites/${site.id}/pages`, { title: 'Contacto' });
    assert.equal(page.status, 201);
    await owner('PATCH', `/pages/${page.body.id}`, { seoTitle: 'Contáctanos — Restaurante', seoDescription: 'Escríbenos para reservar' });
    await owner('POST', `/pages/${page.body.id}/autosave`, { content: doc('Escríbenos', [{ id: 'b1', type: 'button', content: 'WhatsApp', props: { href: 'https://wa.me/15550100' } }]) });

    const res = await owner('POST', `/sites/${site.id}/publish`);
    assert.equal(res.body.pages, 2);

    const index = await live(label);
    assert.ok(index.text.includes('class="top"') && index.text.includes('<a href="/contacto">Contacto</a>'));
    const contact = await live(label, '/contacto');
    assert.equal(contact.status, 200);
    assert.ok(contact.text.includes('Escríbenos') && contact.text.includes('<title>Contáctanos — Restaurante</title>'));
    assert.ok(contact.text.includes('<meta name="description" content="Escríbenos para reservar">'));
    assert.ok(contact.text.includes('target="_blank" rel="noopener noreferrer"'));
    assert.equal((await live(label, '/contacto/')).status, 200, 'con barra final');
    assert.equal((await live(label, '/contacto.html')).status, 200);
    assert.equal((await live(label, '/CONTACTO')).status, 200, 'sin distinguir mayúsculas');
    assert.ok((await live(label, '/sitemap.xml')).text.includes('/contacto'));
  });

  it('una página con slug "index" no pisa la portada', async () => {
    const extra = await owner('POST', `/sites/${site.id}/pages`, { title: 'Índice', slug: 'index' });
    await owner('POST', `/pages/${extra.body.id}/autosave`, { content: doc('PAGINA-INDEX') });
    await owner('POST', `/sites/${site.id}/publish`);
    assert.ok((await live(label)).text.includes('Sabor del Caribe'), 'la portada sigue siendo la portada');
    assert.ok((await live(label, '/index')).text.includes('PAGINA-INDEX'));
    await owner('DELETE', `/pages/${extra.body.id}`);
    await owner('POST', `/sites/${site.id}/publish`);
  });

  it('editar no cambia lo publicado hasta volver a publicar', async () => {
    await owner('POST', `/pages/${home.id}/autosave`, { content: doc('Título NUEVO') });
    assert.ok(!(await live(label)).text.includes('Título NUEVO'), 'lo publicado no cambia solo');
    assert.equal((await owner('GET', `/sites/${site.id}/publication`)).body.hasUnpublishedChanges, true);

    await owner('POST', `/sites/${site.id}/publish`);
    const html = (await live(label)).text;
    assert.ok(html.includes('Título NUEVO') && !html.includes('Sabor del Caribe'));
    assert.equal((await owner('GET', `/sites/${site.id}/publication`)).body.hasUnpublishedChanges, false);
  });

  it('el contenido malicioso del cliente se publica escapado', async () => {
    const evil = doc('<script>alert(document.cookie)</script>', [
      { id: 't', type: 'text', content: '<img src=x onerror=alert(1)>' },
      { id: 'b', type: 'button', content: 'x', props: { href: 'javascript:alert(1)' } },
    ]);
    await owner('POST', `/pages/${home.id}/autosave`, { content: evil });
    await owner('POST', `/sites/${site.id}/publish`);
    const html = (await live(label)).text;
    assert.ok(!/<script|onerror=alert|javascript:/i.test(html.replace(/&lt;[^]*?&gt;/g, '')), html.slice(0, 400));
    assert.ok(html.includes('&lt;script&gt;alert(document.cookie)&lt;/script&gt;'));
  });

  it('el estado indica publicado, dirección y fecha', async () => {
    const status = (await owner('GET', `/sites/${site.id}/publication`)).body;
    assert.equal(status.published, true);
    assert.equal(status.url, 'http://restaurante-caribe.localhost:3000');
    assert.ok(Date.parse(status.publishedAt) <= Date.now());
  });

  it('un documento dañado no se publica y lo que ya estaba en línea sigue igual', async () => {
    await owner('POST', `/pages/${home.id}/autosave`, { content: doc('Versión buena') });
    await owner('POST', `/sites/${site.id}/publish`);
    const bad = await prisma.pageVersion.create({ data: { pageId: home.id, versionNumber: 999, content: { version: 2, sections: 'roto' } } });

    const res = await owner('POST', `/sites/${site.id}/publish`);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /no se puede publicar/);
    assert.ok((await live(label)).text.includes('Versión buena'), 'sigue la versión anterior');
    const failed = await prisma.publication.count({ where: { siteId: site.id, status: 'failed' } });
    assert.ok(failed === 0, 'una validación fallida no crea publicaciones a medias');
    await prisma.pageVersion.delete({ where: { id: bad.id } });
  });

  it('despublicar retira el sitio y volver a publicar lo recupera en la misma dirección', async () => {
    const off = await owner('POST', `/sites/${site.id}/unpublish`);
    assert.equal(off.body.published, false);
    assert.equal((await live(label)).status, 404);
    assert.equal((await live(label, '/contacto')).status, 404);
    assert.equal((await live(label, '/robots.txt')).status, 404);

    const again = await owner('POST', `/sites/${site.id}/publish`);
    assert.equal(again.body.url, 'http://restaurante-caribe.localhost:3000');
    assert.equal((await live(label)).status, 200);
  });

  it('dos sitios con el mismo nombre reciben direcciones distintas', async () => {
    const second = await owner('POST', '/sites', { name: 'Restaurante Caribe', templateSlug: 'blank' });
    const res = await owner('POST', `/sites/${second.body.id}/publish`);
    assert.equal(res.body.url, 'http://restaurante-caribe-2.localhost:3000');
    assert.equal((await live('restaurante-caribe-2')).status, 200);
    assert.ok((await live('restaurante-caribe')).text.includes('Versión buena'), 'el primero no se pisa');
  });

  it('no entrega direcciones reservadas', async () => {
    for (const name of ['www', 'admin', 'api']) {
      const created = await owner('POST', '/sites', { name, templateSlug: 'blank' });
      const res = await owner('POST', `/sites/${created.body.id}/publish`);
      assert.equal(res.status, 200);
      assert.ok(!new RegExp(`//${name}\\.localhost`).test(res.body.url), res.body.url);
    }
  });

  it('conserva solo las últimas 5 publicaciones en disco', async () => {
    for (let i = 0; i < 6; i++) await owner('POST', `/sites/${site.id}/publish`);
    const dirs = readdirSync(join(publishDir, label));
    assert.ok(dirs.length <= 5, `hay ${dirs.length} carpetas`);
    assert.ok((await prisma.publication.count({ where: { siteId: site.id, status: 'archived' } })) >= 1);
    assert.equal((await live(label)).status, 200, 'la actual sigue sirviéndose');
  });

  it('borrar el sitio lo retira de internet', async () => {
    assert.equal((await owner('DELETE', `/sites/${site.id}`)).status, 204);
    assert.equal((await live(label)).status, 404);
  });
});
