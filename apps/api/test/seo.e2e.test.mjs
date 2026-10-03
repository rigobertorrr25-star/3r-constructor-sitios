// Pruebas de integración del SEO de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const publishDir = mkdtempSync(join(tmpdir(), '3r-seo-test-'));
process.env.PUBLISH_DIR = publishDir;
process.env.SITES_ROOT_HOST = 'localhost';
process.env.SITES_URL_TEMPLATE = 'http://{label}.localhost:3000';
process.env.CRON_SECRET = 'clave-de-prueba-analitica';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `seo.owner.${stamp}@example.com`,
  emp: `seo.emp.${stamp}@example.com`,
  emp2: `seo.emp2.${stamp}@example.com`,
  sup: `seo.sup.${stamp}@example.com`,
  hr: `seo.hr.${stamp}@example.com`,
  staff: `seo.staff.${stamp}@example.com`,
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
const weak = () => ({
  version: 1,
  sections: [
    {
      id: 'hero',
      type: 'hero',
      components: [
        { id: 'h1', type: 'heading', content: 'Café La Prueba' },
        { id: 't1', type: 'text', content: 'Café rico.' },
        { id: 'b1', type: 'button', content: 'Ver más', props: { href: '#' } },
        { id: 'img', type: 'image', props: { src: 'https://example.com/a.jpg', alt: '' } },
      ],
    },
  ],
});
const good = () => {
  const long = 'Somos un café de especialidad en el Centro de Cartagena. '.repeat(16);
  return {
    version: 1,
    sections: [
      {
        id: 'hero',
        type: 'hero',
        components: [
          { id: 'h1', type: 'heading', content: 'Café La Prueba' },
          { id: 't1', type: 'text', content: long },
          { id: 'b1', type: 'button', content: 'Escríbenos', props: { href: 'https://wa.me/573005551234' } },
          { id: 'img', type: 'image', props: { src: 'https://example.com/a.jpg', alt: 'Barra del café' } },
          { id: 'map', type: 'map', props: { address: 'Calle 10 # 5-20, Cartagena' } },
        ],
      },
    ],
  };
};

describe('SEO', () => {
  let site;
  let home;
  const report = (who = 'sup') => as(who)('GET', `/companies/${company.id}/seo`);

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
    company = (await as('owner')('POST', '/companies', { name: `SEO ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['sup', 'supervisor'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    site = (await as('staff')('POST', '/sites', { name: `Café La Prueba ${stamp}`, templateSlug: 'blank' })).body;
    home = (await as('staff')('GET', `/sites/${site.id}/pages`)).body[0];
    await as('staff')('POST', `/pages/${home.id}/autosave`, { content: weak() });
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.site.deleteMany({ where: { id: site.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'seo.' } } });
    } finally {
      await app.close();
      rmSync(publishDir, { recursive: true, force: true });
    }
  });

  it('sin el módulo no se usa; sin página vinculada lo dice; el empleado no la ve', async () => {
    assert.equal((await report()).status, 403);
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['seo'] });
    assert.equal((await report('emp')).status, 403);
    assert.equal((await report()).body.site, null);
    await as('staff')('PUT', `/admin/companies/${company.id}/site`, { siteId: site.id });
  });

  it('una página floja: encuentra lo que falta y la nota es baja', async () => {
    const r = (await report()).body;
    const ids = (lvl) =>
      r.checks
        .filter((c) => c.level === lvl)
        .map((c) => c.id.split(':')[0])
        .sort();
    assert.deepEqual(ids('bad'), ['contact', 'desc', 'published']);
    assert.deepEqual(ids('warn'), ['alt', 'domain', 'links', 'place', 'title', 'words']);
    assert.equal(r.checks[0].level, 'bad', 'lo grave primero');
    assert.ok(r.score < 40, `nota ${r.score}`);
    assert.equal(r.pages[0].googleTitle, `Café La Prueba ${stamp}`, 'sin título propio, Google ve el nombre del sitio');
    assert.equal(r.canEdit, false);
  });

  it('el administrador escribe título y descripción; con la página arreglada y publicada sube la nota', async () => {
    const meta = {
      seoTitle: 'Café de especialidad en Cartagena | Café La Prueba',
      seoDescription: 'Café de origen, postres caseros y desayunos en el Centro de Cartagena. Pide por WhatsApp o visítanos.',
    };
    assert.equal((await as('sup')('PUT', `/companies/${company.id}/seo/pages/${home.id}`, meta)).status, 403);
    assert.equal((await as('owner')('PUT', `/companies/${company.id}/seo/pages/${home.id}`, { seoTitle: 'x'.repeat(130) })).status, 400);
    assert.equal((await as('owner')('PUT', `/companies/${company.id}/seo/pages/${home.id}`, meta)).status, 200);
    await as('staff')('POST', `/pages/${home.id}/autosave`, { content: good() });
    await as('staff')('POST', `/sites/${site.id}/publish`);
    const r = (await report('owner')).body;
    assert.equal(r.canEdit, true);
    assert.deepEqual(
      r.checks.filter((c) => c.level !== 'ok').map((c) => c.id),
      ['domain'],
      'solo falta el dominio propio',
    );
    assert.ok(r.score >= 90, `nota ${r.score}`);
    assert.equal(r.pages[0].googleTitle, meta.seoTitle);
    const html = findFiles(publishDir)
      .filter((p) => p.endsWith('index.html'))
      .map((p) => readFileSync(p, 'utf8'))
      .join('');
    assert.ok(html.includes(meta.seoDescription), 'la descripción sale en la página publicada');
  });
});
