// Pruebas de integración del módulo Marketing (campañas de correo) de la plataforma empresarial.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
process.env.MARKETING_SEND_DELAY_MS = '0';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `mkt.owner.${stamp}@example.com`,
  sup: `mkt.sup.${stamp}@example.com`,
  emp: `mkt.emp.${stamp}@example.com`,
  staff: `mkt.staff.${stamp}@example.com`,
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
const waitSent = async (campaignId) => {
  for (let i = 0; i < 50; i++) {
    const c = (await as('owner')('GET', `/companies/${company.id}/marketing/campaigns/${campaignId}`)).body;
    if (c.status === 'sent') return c;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('La campaña no terminó');
};

describe('marketing', () => {
  const m = () => `/companies/${company.id}/marketing`;
  const client = (n) => `cliente${n}.${stamp}@example.com`;
  let draft;

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
    company = (await as('owner')('POST', '/companies', { name: `Marketing ${stamp}`, city: 'Cartagena' })).body;
    for (const [k, role] of [
      ['sup', 'supervisor'],
      ['emp', 'employee'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['crm', 'marketing'] });
    const crm = (body) => as('owner')('POST', `/companies/${company.id}/crm/contacts`, body);
    // 1 y 2 aceptaron (2 es VIP), 3 no aceptó, 4 aceptó pero no tiene correo, 5 repite el correo de 1.
    await crm({ name: 'Uno', email: client(1), marketingOptIn: true, stage: 'won' });
    await crm({ name: 'Dos', email: client(2), marketingOptIn: true, tags: ['VIP', 'vip ', 'eventos'] });
    await crm({ name: 'Tres', email: client(3) });
    await crm({ name: 'Cuatro', phone: '300 000 0000', marketingOptIn: true });
    await crm({ name: 'Uno repetido', email: client(1).toUpperCase(), marketingOptIn: true });
  });

  after(async () => {
    await prisma?.company.deleteMany({ where: { id: company?.id } });
    await prisma?.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await app?.close();
  });

  it('las etiquetas del CRM se guardan en minúscula y sin repetir', async () => {
    const c = await prisma.crmContact.findFirst({ where: { companyId: company.id, name: 'Dos' } });
    assert.deepEqual(c.tags, ['vip', 'eventos']);
    assert.ok(c.marketingOptInAt, 'guarda la fecha del permiso');
  });

  it('el resumen cuenta solo a quien aceptó y tiene correo', async () => {
    const r = await as('sup')('GET', m());
    assert.equal(r.status, 200);
    assert.equal(r.body.audience.eligible, 3);
    assert.equal(r.body.canSend, false, 'el supervisor prepara, pero no envía');
    assert.deepEqual(r.body.tags.sort(), ['eventos', 'vip']);
    assert.equal((await as('emp')('GET', m())).status, 403, 'el empleado no entra');
  });

  it('cuenta el público por grupo', async () => {
    assert.equal((await as('sup')('POST', `${m()}/audience`, { tags: ['vip'] })).body.count, 1);
    assert.equal((await as('sup')('POST', `${m()}/audience`, { stages: ['won'] })).body.count, 1);
    assert.equal((await as('sup')('POST', `${m()}/audience`, { stages: ['nada'] })).status, 400);
  });

  it('crea y edita borradores; la prueba llega solo a quien la pide', async () => {
    const r = await as('sup')('POST', `${m()}/campaigns`, {
      name: 'Octubre',
      subject: 'Nuevo menú',
      body: '## Llegó el menú\n\nVen a probarlo.\n\n- Café\n- Torta',
    });
    assert.equal(r.status, 201);
    draft = r.body;
    const u = await as('sup')('PUT', `${m()}/campaigns/${draft.id}`, {
      name: 'Octubre',
      subject: 'Nuevo menú de octubre',
      body: draft.body,
      segment: { tags: ['VIP'] },
    });
    assert.equal(u.status, 200);
    assert.deepEqual(u.body.segment.tags, ['vip']);
    const t = await as('sup')('POST', `${m()}/campaigns/${draft.id}/test`);
    assert.equal(t.status, 200);
    const mail = sentEmails.findLast((x) => x.to === emails.sup);
    assert.equal(mail.subject, '[Prueba] Nuevo menú de octubre');
    assert.equal(mail.fromName, company.name);
    assert.match(mail.text, /\/baja\/prueba/);
    const baja = await call('GET', '/public/marketing/unsubscribe/prueba');
    assert.equal(baja.body.test, true);
  });

  it('solo el administrador envía; no se manda dos veces ni se edita después', async () => {
    assert.equal((await as('sup')('POST', `${m()}/campaigns/${draft.id}/send`)).status, 403);
    await as('owner')('PUT', `${m()}/campaigns/${draft.id}`, { name: 'Octubre', subject: 'Nuevo menú de octubre', body: draft.body, segment: {} });
    const before = sentEmails.length;
    const s = await as('owner')('POST', `${m()}/campaigns/${draft.id}/send`);
    assert.equal(s.status, 200);
    assert.equal(s.body.recipientCount, 2, 'el correo repetido recibe uno solo');
    const done = await waitSent(draft.id);
    assert.equal(done.stats.sent, 2);
    const mails = sentEmails.slice(before);
    assert.deepEqual(mails.map((x) => x.to.toLowerCase()).sort(), [client(1), client(2)]);
    assert.ok(mails.every((x) => x.headers['List-Unsubscribe'].includes('/baja/')));
    assert.ok(mails.every((x) => x.replyTo === emails.owner));
    assert.ok(!mails.some((x) => x.to === client(3)), 'no le llega a quien no aceptó');
    assert.equal((await as('owner')('POST', `${m()}/campaigns/${draft.id}/send`)).status, 409);
    assert.equal(
      (await as('owner')('PUT', `${m()}/campaigns/${draft.id}`, { name: 'Otra', subject: 'Otro', body: 'Otro mensaje largo' })).status,
      409,
    );
    assert.equal((await as('owner')('DELETE', `${m()}/campaigns/${draft.id}`)).status, 409, 'la enviada no se borra');
  });

  it('el enlace de baja saca al contacto de las próximas campañas', async () => {
    const rec = await prisma.campaignRecipient.findFirst({ where: { campaignId: draft.id, email: client(2) } });
    const v = await call('GET', `/public/marketing/unsubscribe/${rec.token}`);
    assert.equal(v.status, 200);
    assert.equal(v.body.done, false);
    assert.ok(!v.body.email.includes(`cliente2.${stamp}`), 'no muestra el correo completo');
    assert.equal((await call('POST', `/public/marketing/unsubscribe/${rec.token}`)).status, 200);
    assert.equal((await call('GET', `/public/marketing/unsubscribe/${rec.token}`)).body.done, true);
    const o = await as('owner')('GET', m());
    assert.equal(o.body.audience.eligible, 2);
    assert.equal(o.body.campaigns.find((c) => c.id === draft.id).stats.unsubscribed, 1);
    assert.equal((await call('GET', '/public/marketing/unsubscribe/no-existe-este-enlace')).status, 404);
  });

  it('sin nadie en el grupo no se envía', async () => {
    const c = (
      await as('owner')('POST', `${m()}/campaigns`, { name: 'VIP', subject: 'Solo VIP', body: 'Mensaje para VIP', segment: { tags: ['vip'] } })
    ).body;
    assert.equal((await as('owner')('POST', `${m()}/campaigns/${c.id}/send`)).status, 400);
  });

  it('el enlace público suscribe con permiso y guarda en el CRM', async () => {
    assert.equal((await as('sup')('POST', `${m()}/newsletter`)).status, 403);
    const { newsletterToken } = (await as('owner')('POST', `${m()}/newsletter`)).body;
    assert.ok(newsletterToken);
    const v = await call('GET', `/public/newsletter/${newsletterToken}`);
    assert.equal(v.body.companyName, company.name);
    assert.equal(
      (await call('POST', `/public/newsletter/${newsletterToken}`, { body: { name: 'Nueva', email: client(6), consent: false } })).status,
      400,
    );
    assert.equal(
      (await call('POST', `/public/newsletter/${newsletterToken}`, { body: { name: 'Nueva', email: client(6), consent: true } })).status,
      201,
    );
    const nueva = await prisma.crmContact.findFirst({ where: { companyId: company.id, email: client(6) } });
    assert.equal(nueva.source, 'web');
    assert.equal(nueva.marketingOptIn, true);
    // Quien se había dado de baja puede volver a suscribirse.
    await call('POST', `/public/newsletter/${newsletterToken}`, { body: { name: 'Dos', email: client(2).toUpperCase(), consent: true } });
    const dos = await prisma.crmContact.findFirst({ where: { companyId: company.id, name: 'Dos' } });
    assert.equal(dos.marketingOptIn, true);
    assert.equal(dos.unsubscribedAt, null);
    await as('owner')('DELETE', `${m()}/newsletter`);
    assert.equal((await call('GET', `/public/newsletter/${newsletterToken}`)).status, 404);
  });

  it('respeta el tope diario de correos', async () => {
    const data = Array.from({ length: 300 }, (_, i) => ({
      companyId: company.id,
      name: `Masivo ${i}`,
      email: `masivo${i}.${stamp}@example.com`,
      marketingOptIn: true,
    }));
    await prisma.crmContact.createMany({ data });
    const c = (await as('owner')('POST', `${m()}/campaigns`, { name: 'Grande', subject: 'Para todos', body: 'Mensaje para todos' })).body;
    const r = await as('owner')('POST', `${m()}/campaigns/${c.id}/send`);
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Hoy puedes mandar 298 correos más/);
  });
});
