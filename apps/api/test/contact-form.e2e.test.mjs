// Pruebas de integración del formulario de contacto de un sitio publicado:
// POST /public/sites/:label/contact — guarda el mensaje y avisa por correo (ver render.ts, caso 'form').
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
assert.equal(process.env.RESEND_API_KEY ?? '', '', 'estas pruebas exigen modo de prueba (sin RESEND_API_KEY)');

const publishDir = mkdtempSync(join(tmpdir(), '3r-contact-test-'));
process.env.PUBLISH_DIR = publishDir;
process.env.SITES_ROOT_HOST = 'localhost';
process.env.SITES_URL_TEMPLATE = 'http://{label}.localhost:3000';

const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const email = `contact.o.${stamp}@example.com`;
const adminEmail = process.env.ADMIN_EMAIL;

let app, prisma, base, token, site, label;

const call = async (method, path, { body, tok } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* no era JSON */
  }
  return { status: res.status, body: json };
};

const lastTo = (to) => [...sentEmails].reverse().find((m) => m.to === to);

describe('formulario de contacto', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);

    await call('POST', '/auth/register', { body: { email, password } });
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.userRole.create({ data: { userId: user.id, role: 'ADMIN' } });
    token = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;

    const created = await call('POST', '/sites', { tok: token, body: { name: 'Panadería Contacto', templateSlug: 'blank' } });
    site = created.body;
    const pages = (await call('GET', `/sites/${site.id}`, { tok: token })).body.pages;
    await call('POST', `/pages/${pages[0].id}/autosave`, {
      tok: token,
      body: {
        content: {
          version: 1,
          sections: [{ id: 's1', type: 'hero', components: [{ id: 'f1', type: 'form', props: { title: 'Escríbenos' } }] }],
        },
      },
    });
    const published = await call('POST', `/sites/${site.id}/publish`, { tok: token });
    assert.equal(published.status, 200);
    label = 'panaderia-contacto';
  });

  after(async () => {
    const mine = { email: { startsWith: 'contact.' } };
    await prisma.order.deleteMany({ where: { user: mine } });
    await prisma.domain.deleteMany({ where: { site: { user: mine } } });
    await prisma.user.deleteMany({ where: mine });
    await app.close();
    rmSync(publishDir, { recursive: true, force: true });
  });

  it('el formulario queda en la página publicada, apuntando a /s/{label}/contact', async () => {
    const res = await fetch(`${base}/public/sites/${label}`);
    const html = await res.text();
    assert.ok(html.includes(`action="/s/${label}/contact"`));
    assert.ok(html.includes('name="website"'), 'debe traer el honeypot oculto');
  });

  it('un mensaje válido se guarda y, sin pedido asociado, avisa al administrador', async () => {
    if (!adminEmail) return; // sin ADMIN_EMAIL configurado, no hay a quién avisar: nada que comprobar aquí.
    const before = sentEmails.length;
    const res = await call('POST', `/public/sites/${label}/contact`, {
      body: { name: 'Ana Cliente', email: 'ana@example.com', phone: '3001234567', message: 'Quiero un pastel para el sábado.' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const saved = await prisma.formSubmission.findFirst({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' } });
    assert.ok(saved, 'debe quedar guardado en form_submissions');
    assert.equal(saved.name, 'Ana Cliente');
    assert.equal(saved.email, 'ana@example.com');
    assert.equal(saved.message, 'Quiero un pastel para el sábado.');

    assert.ok(sentEmails.length >= before + 1);
    const mail = lastTo(adminEmail);
    assert.ok(mail, 'debe avisar al administrador (el sitio no tiene un pedido dueño)');
    assert.ok(mail.html.includes('Ana Cliente') && mail.html.includes('Quiero un pastel'));
    assert.equal(mail.replyTo, 'ana@example.com', 'responder el aviso debe llegarle al visitante');

    const autoReply = lastTo('ana@example.com');
    assert.ok(autoReply, 'el visitante debe recibir la confirmación automática');
    assert.match(autoReply.subject, /Ya recibimos tu mensaje/);
    assert.ok(autoReply.html.includes(site.name));
    assert.equal(autoReply.replyTo, adminEmail, 'si el visitante responde, le llega a quien puede atenderlo');
  });

  it('el pedido dueño del sitio recibe el aviso en vez del administrador', async () => {
    const pkg = await prisma.package.findFirst();
    const order = await prisma.order.create({
      data: {
        userId: (await prisma.user.findUnique({ where: { email } })).id,
        packageId: pkg.id,
        priceCents: pkg.priceCents,
        currency: pkg.currency,
        brief: { businessName: 'Panadería Contacto', businessType: 'Panadería', description: 'Una descripción de al menos diez letras.' },
        siteId: site.id,
      },
    });

    const res = await call('POST', `/public/sites/${label}/contact`, {
      body: { name: 'Beto Visitante', email: 'beto@example.com', message: 'Hola, ¿hacen domicilios?' },
    });
    assert.equal(res.status, 200);

    const mail = lastTo(email);
    assert.ok(mail, 'debe avisarle al dueño del pedido, no al administrador');
    assert.ok(mail.html.includes('Beto Visitante'));
    assert.equal(mail.replyTo, 'beto@example.com');

    const autoReply = lastTo('beto@example.com');
    assert.ok(autoReply, 'el visitante debe recibir la confirmación automática aunque el aviso vaya al dueño del pedido');
    assert.equal(autoReply.replyTo, email, 'si el visitante responde, le llega al dueño del pedido');

    await prisma.order.delete({ where: { id: order.id } });
  });

  it('el honeypot lleno responde "listo" pero no guarda ni avisa nada', async () => {
    const before = await prisma.formSubmission.count({ where: { siteId: site.id } });
    const beforeMails = sentEmails.length;
    const res = await call('POST', `/public/sites/${label}/contact`, {
      body: { name: 'Bot', email: 'bot@example.com', message: 'x', website: 'https://spam.example' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(await prisma.formSubmission.count({ where: { siteId: site.id } }), before);
    assert.equal(sentEmails.length, beforeMails);
  });

  it('valida los campos: correo inválido o mensaje vacío se rechazan', async () => {
    assert.equal((await call('POST', `/public/sites/${label}/contact`, { body: { name: 'A', email: 'no-es-correo', message: 'hola' } })).status, 400);
    assert.equal((await call('POST', `/public/sites/${label}/contact`, { body: { name: 'A', email: 'a@b.com', message: '' } })).status, 400);
  });

  it('un sitio que no existe o no está publicado responde "listo" sin filtrar nada', async () => {
    const res = await call('POST', '/public/sites/no-existe-jamas/contact', { body: { name: 'A', email: 'a@b.com', message: 'hola' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    await call('POST', `/sites/${site.id}/unpublish`, { tok: token });
    const off = await call('POST', `/public/sites/${label}/contact`, { body: { name: 'A', email: 'a@b.com', message: 'hola' } });
    assert.equal(off.status, 200);
    assert.equal(off.body.ok, true);
  });
});
