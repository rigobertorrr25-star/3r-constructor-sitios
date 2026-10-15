// Pruebas de integración del constructor web de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const publishDir = mkdtempSync(join(tmpdir(), '3r-web-test-'));
process.env.PUBLISH_DIR = publishDir;
process.env.SITES_ROOT_HOST = 'localhost';
process.env.SITES_URL_TEMPLATE = 'http://{label}.localhost:3000';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `web.owner.${stamp}@example.com`,
  emp: `web.emp.${stamp}@example.com`,
  emp2: `web.emp2.${stamp}@example.com`,
  sup: `web.sup.${stamp}@example.com`,
  hr: `web.hr.${stamp}@example.com`,
  staff: `web.staff.${stamp}@example.com`,
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

const findFiles = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? findFiles(join(dir, f)) : [join(dir, f)]));
const doc = () => ({
  version: 1,
  sections: [
    {
      id: 'hero',
      type: 'hero',
      styles: { background: '#000103' },
      components: [
        { id: 'h1', type: 'heading', content: 'Café La Prueba', styles: { fontSize: { desktop: 52, mobile: 34 }, color: '#ffffff' } },
        { id: 't1', type: 'text', content: 'Abrimos de 7 a 7.' },
        { id: 'b1', type: 'button', content: 'Pedir', props: { href: 'https://wa.me/573005551234' } },
        { id: 'sp', type: 'spacer', styles: { height: 24 } },
      ],
    },
    {
      id: 'about',
      type: 'content',
      components: [
        { id: 'img', type: 'image', props: { src: 'https://example.com/a.jpg', alt: 'Local' }, styles: { width: 80 } },
        { id: 'box', type: 'container', components: [{ id: 't2', type: 'text', content: 'Dentro de una caja' }] },
        { id: 'map', type: 'map', props: { address: 'Calle 1, Cartagena' } },
      ],
    },
    { id: 'empty', type: 'blank', components: [{ id: 'd', type: 'divider' }] },
  ],
});

describe('constructor web', () => {
  let w;
  let site;
  let home;
  let other;

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
    company = (await as('owner')('POST', '/companies', { name: `Web ${stamp}` })).body;
    other = (await as('emp2')('POST', '/companies', { name: `Otra ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['hr', 'hr'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    // La página la arma el equipo de 3R, como con un pedido.
    site = (await as('staff')('POST', '/sites', { name: `Café La Prueba ${stamp}`, templateSlug: 'blank' })).body;
    home = (await as('staff')('GET', `/sites/${site.id}/pages`)).body[0];
    await as('staff')('POST', `/pages/${home.id}/autosave`, { content: doc() });
    w = `/companies/${company.id}/web`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: { in: [company.id, other.id] } } });
      await prisma.site.deleteMany({ where: { id: site.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'web.' } } });
    } finally {
      await app.close();
      rmSync(publishDir, { recursive: true, force: true });
    }
  });

  it('el equipo de 3R vincula la página con la empresa (una página, una empresa)', async () => {
    assert.equal((await as('owner')('GET', w)).status, 403, 'sin el módulo');
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['web'] });
    assert.equal((await as('owner')('GET', w)).body.site, null);
    assert.equal((await as('owner')('PUT', `/admin/companies/${company.id}/site`, { siteId: site.id })).status, 403, 'solo el equipo de 3R');
    const opts = (await as('staff')('GET', `/admin/companies/${company.id}/site`)).body;
    assert.ok(opts.options.some((o) => o.id === site.id));
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/site`, { siteId: site.id })).body.siteId, site.id);
    assert.equal((await as('staff')('PUT', `/admin/companies/${other.id}/site`, { siteId: site.id })).status, 400, 'ya está vinculada');
    const o = (await as('emp')('GET', w)).body;
    assert.equal(o.canEdit, false);
    assert.equal(o.site.pages[0].id, home.id);
    assert.equal(o.site.publication.published, false);
  });

  it('muestra solo textos, botones, fotos y mapas, por sección; el equipo no edita', async () => {
    assert.equal((await as('hr')('GET', `${w}/pages/${home.id}`)).status, 403, 'RR. HH. no es administrador');
    const f = (await as('owner')('GET', `${w}/pages/${home.id}`)).body;
    assert.deepEqual(
      f.sections.map((s) => s.label),
      ['Portada 1', 'Contenido 2'],
    );
    assert.deepEqual(
      f.sections[0].fields.map((x) => x.kind),
      ['heading', 'text', 'button'],
    );
    assert.deepEqual(
      f.sections[1].fields.map((x) => [x.kind, x.nodeId]),
      [
        ['image', 'img'],
        ['text', 't2'],
        ['map', 'map'],
      ],
    );
    assert.equal(f.sections[0].fields[2].href, 'https://wa.me/573005551234');
    assert.equal((await as('owner')('GET', `/companies/${other.id}/web/pages/${home.id}`)).status, 404, 'otra empresa no la ve');
  });

  it('guarda los cambios sin tocar el diseño; rechaza enlaces raros y versiones viejas', async () => {
    const f = (await as('owner')('GET', `${w}/pages/${home.id}`)).body;
    const put = (changes, baseVersionId = f.versionId) => as('owner')('PUT', `${w}/pages/${home.id}`, { baseVersionId, changes });
    assert.equal((await put([{ nodeId: 'b1', href: 'javascript:alert(1)' }])).status, 400);
    assert.equal((await put([{ nodeId: 'h1', content: '   ' }])).status, 400);
    assert.equal((await put([{ nodeId: 'img', src: 'ftp://x/y.jpg' }])).status, 400);
    assert.equal((await put([{ nodeId: 'sp', content: 'hola' }])).status, 400, 'el espaciador no se edita');
    assert.equal((await put([{ nodeId: 'nope', content: 'x' }])).status, 400);
    assert.equal(
      (await as('emp')('PUT', `${w}/pages/${home.id}`, { baseVersionId: f.versionId, changes: [{ nodeId: 't1', content: 'x' }] })).status,
      403,
    );
    const ok = await put([
      { nodeId: 'h1', content: 'Café La Prueba — Centro' },
      { nodeId: 't1', content: 'Abrimos de 6 a 8.' },
      { nodeId: 'b1', content: 'Pide por WhatsApp' },
      { nodeId: 'img', src: 'https://example.com/b.jpg', alt: 'Barra del café' },
      { nodeId: 't2', content: 'Texto nuevo en la caja' },
    ]);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.changed, 5);
    assert.equal((await put([{ nodeId: 't1', content: 'otra' }])).status, 409, 'se editó sobre una versión vieja');
    const content = (await as('staff')('GET', `/pages/${home.id}/content`)).body;
    const json = JSON.stringify(content);
    assert.ok(json.includes('Café La Prueba — Centro') && json.includes('Barra del café') && json.includes('Texto nuevo en la caja'));
    const sections = (content.content ?? content).sections;
    assert.deepEqual(sections[0].components[0].styles, { fontSize: { desktop: 52, mobile: 34 }, color: '#ffffff' }, 'el diseño queda igual');
    assert.equal(sections[1].components[0].styles.width, 80);
  });

  it('publica desde la empresa y la página en vivo cambia', async () => {
    assert.equal((await as('emp')('POST', `${w}/publish`)).status, 403);
    const res = await as('owner')('POST', `${w}/publish`);
    assert.equal(res.status, 200);
    assert.ok(res.body.url);
    const html = findFiles(publishDir)
      .filter((p) => p.endsWith('index.html'))
      .map((p) => readFileSync(p, 'utf8'))
      .join('');
    assert.ok(html.includes('Café La Prueba — Centro'));
    assert.ok(html.includes('Abrimos de 6 a 8.'));
    const o = (await as('owner')('GET', w)).body;
    assert.equal(o.site.publication.published, true);
    assert.equal(o.site.publication.hasUnpublishedChanges, false);
  });
});
