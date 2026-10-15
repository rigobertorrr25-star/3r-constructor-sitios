// Pruebas de integración del analítica web de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const publishDir = mkdtempSync(join(tmpdir(), '3r-ana-test-'));
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
  owner: `ana.owner.${stamp}@example.com`,
  emp: `ana.emp.${stamp}@example.com`,
  emp2: `ana.emp2.${stamp}@example.com`,
  sup: `ana.sup.${stamp}@example.com`,
  hr: `ana.hr.${stamp}@example.com`,
  staff: `ana.staff.${stamp}@example.com`,
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

const doc = () => ({
  version: 1,
  sections: [{ id: 'hero', type: 'hero', components: [{ id: 'h1', type: 'heading', content: 'Hola' }] }],
});
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

describe('analítica web', () => {
  let site;
  let label;
  const visit = async (path, { ua = PHONE, referer = '', ip = '1.1.1.1', query = '', key = 'clave-de-prueba-analitica' } = {}) => {
    const res = await fetch(`${base}/public/sites/${label}${path}`, {
      headers: { 'x-3r-visit': key, 'x-3r-ua': ua, 'x-3r-referer': referer, 'x-3r-ip': ip, 'x-3r-query': query, 'x-3r-host': `${label}.localhost` },
    });
    await res.text();
    return res;
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
    company = (await as('owner')('POST', '/companies', { name: `Analitica ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['sup', 'supervisor'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    site = (await as('staff')('POST', '/sites', { name: `Analitica ${stamp}`, templateSlug: 'blank' })).body;
    const home = (await as('staff')('GET', `/sites/${site.id}/pages`)).body[0];
    await as('staff')('POST', `/pages/${home.id}/autosave`, { content: doc() });
    const extra = (await as('staff')('POST', `/sites/${site.id}/pages`, { title: 'Menú', slug: 'menu' })).body;
    await as('staff')('POST', `/pages/${extra.id}/autosave`, { content: doc() });
    const pub = (await as('staff')('POST', `/sites/${site.id}/publish`)).body;
    label = new URL(pub.url).hostname.split('.')[0];
    await as('staff')('PUT', `/admin/companies/${company.id}/site`, { siteId: site.id });
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.site.deleteMany({ where: { id: site.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'ana.' } } });
    } finally {
      await app.close();
      rmSync(publishDir, { recursive: true, force: true });
    }
  });

  it('cuenta visitas reales: sin robots, sin vistas previas y solo con la firma de la web', async () => {
    const first = await visit('', { referer: 'https://l.instagram.com/' });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'public, max-age=0, no-cache', 'las páginas no van a la caché compartida');
    await visit('/menu', { referer: `http://${label}.localhost/` }); // misma persona, navegando dentro
    await visit('', { ua: PC, ip: '2.2.2.2', referer: 'https://www.google.com/' });
    await visit('', { ip: '3.3.3.3', query: '?utm_source=wa' });
    await visit('', { ip: '4.4.4.4' });
    await visit('', { ua: 'WhatsApp/2.23.20 A', ip: '5.5.5.5' }); // vista previa del enlace
    await visit('', { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)', ip: '6.6.6.6' });
    await visit('', { ip: '7.7.7.7', key: 'otra-clave' }); // sin la firma correcta
    await fetch(`${base}/public/sites/${label}/robots.txt`);
    const rows = await prisma.pageView.findMany({ where: { siteId: site.id } });
    assert.equal(rows.length, 5);
    assert.ok(
      rows.every((r) => r.visitor.length === 16 && !r.visitor.includes('1.1.1.1')),
      'no se guarda la IP',
    );
  });

  it('el informe: visitas, personas, de dónde llegan, dispositivos y páginas; solo supervisor en adelante', async () => {
    const r0 = await as('sup')('GET', `/companies/${company.id}/analytics`);
    assert.equal(r0.status, 403, 'sin el módulo');
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['analytics'] });
    assert.equal((await as('emp')('GET', `/companies/${company.id}/analytics`)).status, 403);
    const r = (await as('sup')('GET', `/companies/${company.id}/analytics?days=7`)).body;
    assert.equal(r.days, 7);
    assert.equal(r.web.views, 5);
    assert.equal(r.web.visitors, 4);
    assert.equal(r.web.daily.length, 7);
    assert.equal(r.web.daily.at(-1).views, 5);
    assert.deepEqual(Object.fromEntries(r.web.sources.map((s) => [s.source, s.visitors])), { instagram: 1, google: 1, whatsapp: 1, direct: 1 });
    assert.deepEqual(r.web.devices, { mobile: 3, desktop: 1 });
    assert.deepEqual(r.web.pages, [
      { path: '/', views: 4 },
      { path: '/menu', views: 1 },
    ]);
    assert.equal(r.store, null);
    assert.equal((await as('sup')('GET', `/companies/${company.id}/analytics?days=13`)).body.days, 30, 'rangos fijos');
  });
});
