// Pruebas de integración del cotizaciones de la plataforma empresarial.
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
  owner: `quo.owner.${stamp}@example.com`,
  emp: `quo.emp.${stamp}@example.com`,
  emp2: `quo.emp2.${stamp}@example.com`,
  sup: `quo.sup.${stamp}@example.com`,
  out: `quo.out.${stamp}@example.com`,
  staff: `quo.staff.${stamp}@example.com`,
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

const tokenFrom = (url) => url.split('/cotizacion/')[1];
const pub = (method, path, body) => call(method, `/public/quotes/${path}`, { body });

describe('cotizaciones', () => {
  let q;
  let quote;
  let contact;
  let token;

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
    company = (await as('owner')('POST', '/companies', { name: `Ventas ${stamp}`, city: 'Cartagena', taxId: '900111222-3' })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    q = `/companies/${company.id}/quotes`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'quo.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa', async () => {
    assert.equal((await as('emp')('GET', q)).status, 403);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['quotes', 'crm', 'alerts'] })).status, 200);
    assert.equal((await as('emp')('GET', q)).status, 200);
    assert.equal((await as('out')('GET', q)).status, 404);
  });

  it('calcula subtotal, descuento e IVA en pesos y numera COT-1, COT-2', async () => {
    contact = (await as('emp')('POST', `/companies/${company.id}/crm/contacts`, { name: 'Andrea Molina', organization: 'Hotel Las Américas', email: 'andrea@example.com' })).body;
    const res = await as('emp')('POST', q, {
      contactId: contact.id,
      clientName: 'Andrea Molina',
      clientCompany: 'Hotel Las Américas',
      clientEmail: 'andrea@example.com',
      title: 'Café para el desayuno del hotel',
      items: [
        { description: 'Café de origen, bolsa de 1 kg', quantity: 10, unitPrice: 45000 },
        { description: 'Capacitación a meseros', quantity: 1, unitPrice: 150000 },
      ],
      discount: 50000,
      taxRate: 19,
      validUntil: '2099-12-31',
      notes: 'Entrega en 3 días hábiles.',
    });
    assert.equal(res.status, 201);
    quote = res.body;
    assert.equal(quote.code, 'COT-1');
    assert.equal(quote.subtotal, 600000);
    assert.equal(quote.tax, 104500);
    assert.equal(quote.total, 654500);
    assert.equal(quote.status, 'draft');
    const second = (await as('emp2')('POST', q, { clientName: 'Pedro', title: 'Prueba', items: [{ description: 'Algo', quantity: 1, unitPrice: 1 }] })).body;
    assert.equal(second.code, 'COT-2');
    assert.equal((await as('emp')('POST', q, { clientName: 'X Y', title: 'Sin ítems', items: [] })).status, 400);
    assert.equal((await as('emp')('POST', q, { clientName: 'X Y', title: 'Mal IVA', items: [{ description: 'a', quantity: 1, unitPrice: 1 }], taxRate: 16 })).status, 400);
    assert.equal((await as('emp')('POST', q, { clientName: 'X Y', title: 'Descuento', items: [{ description: 'a', quantity: 1, unitPrice: 10 }], discount: 20 })).status, 400);
    // Valores grandes: más de 2.100 millones no rompen.
    const big = await as('emp')('POST', q, { clientName: 'Constructora', title: 'Obra', items: [{ description: 'Edificio', quantity: 3, unitPrice: 2000000000 }] });
    assert.equal(big.body.total, 6000000000);
  });

  it('el PDF sale bien', async () => {
    const res = await fetch(`${base}${q}/${quote.id}/pdf`, { headers: { authorization: `Bearer ${tokens.emp}` } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  });

  it('enviar: correo al cliente con enlace, y el cliente del CRM pasa a «Cotización»', async () => {
    const res = await as('emp')('POST', `${q}/${quote.id}/send`, { email: true });
    assert.equal(res.status, 200);
    token = tokenFrom(res.body.url);
    const mail = [...sentEmails].reverse().find((m) => m.to === 'andrea@example.com');
    assert.ok(mail);
    assert.match(mail.subject, /Cotización COT-1 de Ventas/);
    assert.equal(mail.replyTo, emails.emp, 'si responde, le llega a quien la mandó');
    assert.ok(mail.text.includes(token));
    const c = (await as('emp')('GET', `/companies/${company.id}/crm/contacts/${contact.id}`)).body;
    assert.equal(c.stage, 'quote');
    assert.ok(c.activities.some((a) => a.body.startsWith('Cotización COT-1 enviada')));
    assert.equal((await as('emp')('PUT', `${q}/${quote.id}`, { clientName: 'Andrea', title: 'Otro', items: [{ description: 'a', quantity: 1, unitPrice: 1 }] })).status, 400, 'enviada no se edita');
  });

  it('el cliente la ve con el enlace (sin sesión) y descarga el PDF; un enlace falso no sirve', async () => {
    const view = await pub('GET', token);
    assert.equal(view.status, 200);
    assert.equal(view.body.total, 654500);
    assert.equal(view.body.company.name, `Ventas ${stamp}`);
    assert.equal('clientEmail' in view.body, false);
    assert.ok((await as('emp')('GET', `${q}/${quote.id}`)).body.viewedAt, 'queda que la abrió');
    const pdf = await fetch(`${base}/public/quotes/${token}/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal((await pub('GET', 'x'.repeat(32))).status, 404);
  });

  it('pedir cambios exige mensaje; luego se edita y se reenvía con enlace nuevo', async () => {
    assert.equal((await pub('POST', `${token}/respond`, { action: 'changes', name: 'Andrea' })).status, 400);
    const res = await pub('POST', `${token}/respond`, { action: 'changes', name: 'Andrea Molina', message: 'Necesito 15 bolsas' });
    assert.equal(res.body.status, 'changes_requested');
    assert.equal((await pub('POST', `${token}/respond`, { action: 'accept', name: 'Andrea' })).status, 400, 'ya respondió');
    const owner = await prisma.companyMember.findFirst({ where: { companyId: company.id, user: { email: emails.emp } } });
    assert.ok(await prisma.notification.findFirst({ where: { memberId: owner.id, title: { contains: 'pidió cambios en la cotización COT-1' } } }));
    assert.ok(sentEmails.some((m) => m.to === emails.emp && m.subject.includes('pidió cambios en la cotización COT-1')));
    const edited = await as('emp')('PUT', `${q}/${quote.id}`, {
      contactId: contact.id,
      clientName: 'Andrea Molina',
      clientEmail: 'andrea@example.com',
      title: 'Café para el desayuno del hotel',
      items: [{ description: 'Café de origen, bolsa de 1 kg', quantity: 15, unitPrice: 45000 }],
      taxRate: 19,
      validUntil: '2099-12-31',
    });
    assert.equal(edited.body.total, 803250);
    const resent = await as('emp')('POST', `${q}/${quote.id}/send`, { email: false });
    const newToken = tokenFrom(resent.body.url);
    assert.notEqual(newToken, token);
    assert.equal((await pub('GET', token)).status, 404, 'el enlace viejo ya no sirve');
    token = newToken;
  });

  it('aceptar: queda aceptada, el cliente del CRM pasa a «Ganado»', async () => {
    const res = await pub('POST', `${token}/respond`, { action: 'accept', name: 'Andrea Molina' });
    assert.equal(res.body.status, 'accepted');
    const c = (await as('emp')('GET', `/companies/${company.id}/crm/contacts/${contact.id}`)).body;
    assert.equal(c.stage, 'won');
    const summary = (await as('emp')('GET', `${q}/summary`)).body;
    assert.equal(summary.accepted, 1);
    assert.equal(summary.acceptedValue, 803250);
  });

  it('una cotización vencida no se acepta', async () => {
    const old = (await as('emp')('POST', q, { clientName: 'Cliente viejo', title: 'Vieja', items: [{ description: 'a', quantity: 1, unitPrice: 1000 }], validUntil: '2020-01-01' })).body;
    const t = tokenFrom((await as('emp')('POST', `${q}/${old.id}/send`, {})).body.url);
    assert.equal((await pub('GET', t)).body.expired, true);
    assert.equal((await pub('POST', `${t}/respond`, { action: 'accept', name: 'Cliente' })).status, 400);
  });

  it('solo un administrador borra', async () => {
    assert.equal((await as('emp')('DELETE', `${q}/${quote.id}`)).status, 403);
    assert.equal((await as('owner')('DELETE', `${q}/${quote.id}`)).status, 204);
  });
});
