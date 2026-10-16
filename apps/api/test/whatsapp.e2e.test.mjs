// Pruebas de integración de WhatsApp empresarial (con el cliente falso: no habla con Meta).
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
process.env.WHATSAPP_APP_SECRET = 'secreto-de-prueba-meta';
process.env.WHATSAPP_VERIFY_TOKEN = 'verificar-3r';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');
const { FakeWhatsappClient } = await import('../dist/whatsapp/whatsapp-client.js');
const { normalizePhone } = await import('../dist/whatsapp/whatsapp.service.js');
const { createHmac } = await import('node:crypto');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `wa.owner.${stamp}@example.com`,
  sup: `wa.sup.${stamp}@example.com`,
  emp: `wa.emp.${stamp}@example.com`,
  staff: `wa.staff.${stamp}@example.com`,
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

const hook = async (payload, secret = 'secreto-de-prueba-meta') => {
  const raw = JSON.stringify(payload);
  const sig = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const res = await fetch(`${base}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
    body: raw,
  });
  return res.status;
};
const PHONE_ID = `${stamp}`.slice(-12);
const inbound = (from, id, text, name = 'Ana Cliente', ts = Math.floor(Date.now() / 1000)) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: PHONE_ID },
            contacts: [{ wa_id: from, profile: { name } }],
            messages: [{ from, id, timestamp: String(ts), type: 'text', text: { body: text } }],
          },
        },
      ],
    },
  ],
});
const statusEvent = (id, status) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PHONE_ID }, statuses: [{ id, status }] } }] }] });

describe('whatsapp empresarial', () => {
  const w = () => `/companies/${company.id}/whatsapp`;
  let conv;

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const [k, e] of Object.entries(emails)) tokens[k] = await signup(e);
    const staff = await prisma.user.findUnique({ where: { email: emails.staff } });
    await prisma.userRole.create({ data: { userId: staff.id, role: 'ADMIN' } });
    tokens.staff = (await call('POST', '/auth/login', { body: { email: emails.staff, password } })).body.accessToken;
    company = (await as('owner')('POST', '/companies', { name: `WhatsApp ${stamp}` })).body;
    for (const [k, role] of [
      ['sup', 'supervisor'],
      ['emp', 'employee'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['whatsapp', 'crm', 'alerts'] });
    await as('owner')('POST', `/companies/${company.id}/crm/contacts`, { name: 'Pedro Conocido', phone: '310 555 0000' });
  });

  after(async () => {
    await prisma?.company.deleteMany({ where: { id: company?.id } });
    await prisma?.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await app?.close();
  });

  it('arregla los celulares de Colombia', () => {
    assert.equal(normalizePhone('300 123 4567'), '573001234567');
    assert.equal(normalizePhone('+57 (300) 123-4567'), '573001234567');
    assert.equal(normalizePhone('1 305 555 1234'), '13055551234');
  });

  it('el equipo de 3R conecta el número y el token no se devuelve', async () => {
    const dto = {
      phoneNumberId: PHONE_ID,
      wabaId: '987654321',
      displayPhone: '+57 300 000 0000',
      accessToken: 'EAAG-token-de-prueba-largo-1234567890',
    };
    assert.equal((await as('owner')('PUT', `/admin/companies/${company.id}/whatsapp`, dto)).status, 403);
    const r = await as('staff')('PUT', `/admin/companies/${company.id}/whatsapp`, dto);
    assert.equal(r.status, 200);
    assert.equal(r.body.account.displayPhone, '+57 300 000 0000');
    assert.ok(!JSON.stringify(r.body).includes('EAAG'));
    const row = await prisma.whatsappAccount.findUnique({ where: { companyId: company.id } });
    assert.ok(!row.tokenEnc.includes('EAAG'), 'guardado cifrado');
    // Editar sin token deja el anterior.
    assert.equal(
      (await as('staff')('PUT', `/admin/companies/${company.id}/whatsapp`, { ...dto, accessToken: undefined, displayPhone: '+57 300 111 1111' }))
        .status,
      200,
    );
    assert.equal((await prisma.whatsappAccount.findUnique({ where: { companyId: company.id } })).tokenEnc, row.tokenEnc);
  });

  it('Meta verifica la dirección de avisos con la clave', async () => {
    const ok = await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verificar-3r&hub.challenge=12345`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '12345');
    assert.equal((await fetch(`${base}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otra&hub.challenge=1`)).status, 404);
  });

  it('un mensaje del cliente abre la conversación, avisa y queda en el CRM', async () => {
    assert.equal(await hook(inbound('573001112233', 'wamid.in.1', 'Hola, ¿tienen domicilios?'), 'otra-clave'), 403, 'sin la firma correcta no entra');
    assert.equal(await hook(inbound('573001112233', 'wamid.in.1', 'Hola, ¿tienen domicilios?')), 200);
    assert.equal(await hook(inbound('573001112233', 'wamid.in.1', 'Hola, ¿tienen domicilios?')), 200, 'el mismo aviso dos veces');
    const o = await as('sup')('GET', w());
    assert.equal(o.status, 200);
    assert.equal(o.body.conversations.length, 1);
    conv = o.body.conversations[0];
    assert.equal(conv.name, 'Ana Cliente');
    assert.equal(conv.unread, 1);
    assert.equal(conv.canReply, true);
    const contact = await prisma.crmContact.findFirst({ where: { companyId: company.id, source: 'whatsapp' } });
    assert.equal(contact.phone, '+573001112233');
    assert.equal(conv.contactId, contact.id);
    const alerts = await prisma.notification.count({ where: { companyId: company.id, kind: 'whatsapp' } });
    assert.ok(alerts >= 2, 'avisa a los supervisores en adelante');
    assert.equal((await as('emp')('GET', w())).status, 403);
  });

  it('reconoce a un cliente que ya estaba en el CRM', async () => {
    await hook(inbound('573105550000', 'wamid.in.2', 'Buenas', 'Pedro'));
    const c = await prisma.whatsappConversation.findFirst({ where: { companyId: company.id, waId: '573105550000' } });
    const pedro = await prisma.crmContact.findFirst({ where: { companyId: company.id, name: 'Pedro Conocido' } });
    assert.equal(c.contactId, pedro.id);
  });

  it('responde dentro de las 24 horas y sigue los estados', async () => {
    const d = await as('sup')('GET', `${w()}/conversations/${conv.id}`);
    assert.equal(d.body.messages.length, 1);
    assert.equal(d.body.unread, 0);
    const r = await as('sup')('POST', `${w()}/conversations/${conv.id}/messages`, { body: 'Sí, hasta las 6 pm.' });
    assert.equal(r.status, 201);
    assert.deepEqual(FakeWhatsappClient.sent.at(-1), { to: '573001112233', type: 'text', body: 'Sí, hasta las 6 pm.' });
    const msg = await prisma.whatsappMessage.findUnique({ where: { id: r.body.id } });
    await hook(statusEvent(msg.waMessageId, 'read'));
    await hook(statusEvent(msg.waMessageId, 'delivered'));
    assert.equal((await prisma.whatsappMessage.findUnique({ where: { id: r.body.id } })).status, 'read', 'no se devuelve a entregado');
    FakeWhatsappClient.failNext = true;
    assert.equal((await as('sup')('POST', `${w()}/conversations/${conv.id}/messages`, { body: 'Otro' })).status, 503);
    assert.equal(await prisma.whatsappMessage.count({ where: { conversationId: conv.id, status: 'failed' } }), 1);
  });

  it('pasadas 24 horas solo deja mandar plantillas', async () => {
    await prisma.whatsappConversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date(Date.now() - 25 * 3600 * 1000) } });
    assert.equal((await as('sup')('POST', `${w()}/conversations/${conv.id}/messages`, { body: 'Hola de nuevo' })).status, 409);
    assert.equal((await as('sup')('POST', `${w()}/templates/sync`)).status, 403);
    assert.equal((await as('owner')('POST', `${w()}/templates/sync`)).body.count, 2);
    const t = (await as('sup')('GET', w())).body.templates.find((x) => x.name === 'pedido_listo');
    assert.equal(t.params, 2);
    assert.equal((await as('sup')('POST', `${w()}/conversations/${conv.id}/template`, { templateId: t.id, params: ['Ana'] })).status, 400);
    const r = await as('sup')('POST', `${w()}/conversations/${conv.id}/template`, { templateId: t.id, params: ['Ana', '#12'] });
    assert.equal(r.status, 201);
    assert.equal(r.body.body, 'Hola Ana, tu pedido #12 ya está listo para recoger.');
    assert.deepEqual(FakeWhatsappClient.sent.at(-1).params, ['Ana', '#12']);
  });

  it('escribirle primero a un cliente nuevo, asignar y cerrar', async () => {
    const t = (await as('sup')('GET', w())).body.templates.find((x) => x.name === 'bienvenida');
    const s = await as('sup')('POST', `${w()}/conversations`, { phone: '300 999 8877', name: 'Lina', templateId: t.id, params: ['Lina'] });
    assert.equal(s.status, 201);
    assert.equal(FakeWhatsappClient.sent.at(-1).to, '573009998877');
    const mine = await as('sup')('GET', `${w()}?filter=mine`);
    assert.ok(mine.body.conversations.some((c) => c.id === s.body.conversationId));
    await as('sup')('PATCH', `${w()}/conversations/${s.body.conversationId}`, { status: 'closed' });
    const closed = await as('sup')('GET', `${w()}?filter=closed`);
    assert.deepEqual(
      closed.body.conversations.map((c) => c.id),
      [s.body.conversationId],
    );
    // Si el cliente vuelve a escribir, se reabre.
    await hook(inbound('573009998877', 'wamid.in.3', 'Gracias'));
    assert.equal((await prisma.whatsappConversation.findUnique({ where: { id: s.body.conversationId } })).status, 'open');
  });

  it('el asistente con IA responde solo y pasa la conversación al equipo', async () => {
    const info = 'Abrimos de lunes a sábado de 8 am a 6 pm. Domicilios en Bocagrande sin costo.';
    assert.equal((await as('sup')('PUT', `${w()}/bot`, { enabled: true, info })).status, 403);
    assert.equal((await as('owner')('PUT', `${w()}/bot`, { enabled: true })).status, 400, 'sin información no se prende');
    const on = await as('owner')('PUT', `${w()}/bot`, { enabled: true, info });
    assert.equal(on.status, 200);
    assert.deepEqual(on.body, { available: true, enabled: true, info });
    assert.deepEqual((await as('sup')('GET', w())).body.bot, { available: true, enabled: true, info });

    const botCount = (id) => prisma.whatsappMessage.count({ where: { conversationId: id, bot: true } });
    const waitBot = async (id, n) => {
      for (let i = 0; i < 50 && (await botCount(id)) < n; i++) await new Promise((r) => setTimeout(r, 100));
      return botCount(id);
    };
    await hook(inbound('573004445566', 'wamid.bot.1', '¿A qué hora abren?', 'Marta'));
    const c = await prisma.whatsappConversation.findFirst({ where: { companyId: company.id, waId: '573004445566' } });
    assert.equal(await waitBot(c.id, 1), 1);
    assert.deepEqual(FakeWhatsappClient.sent.at(-1), { to: '573004445566', type: 'text', body: `¡Hola! ${info}` });

    // Pide una persona: el asistente avisa, se calla y le llega la alerta al equipo.
    await hook(inbound('573004445566', 'wamid.bot.2', 'Quiero hablar con una persona', 'Marta'));
    assert.equal(await waitBot(c.id, 2), 2);
    assert.equal(FakeWhatsappClient.sent.at(-1).body, 'Ya le aviso a alguien del equipo para que te responda por aquí.');
    assert.equal((await prisma.whatsappConversation.findUnique({ where: { id: c.id } })).botPaused, true);
    assert.ok(await prisma.notification.findFirst({ where: { companyId: company.id, title: { contains: 'necesita que alguien le responda' } } }));
    await hook(inbound('573004445566', 'wamid.bot.3', '¿Hola?', 'Marta'));
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(await botCount(c.id), 2, 'en pausa no responde');

    // Se la devuelven al asistente; si después responde una persona, el asistente se calla otra vez.
    const back = await as('sup')('PATCH', `${w()}/conversations/${c.id}`, { botPaused: false });
    assert.equal(back.body.botPaused, false);
    await hook(inbound('573004445566', 'wamid.bot.4', '¿Hacen domicilios?', 'Marta'));
    assert.equal(await waitBot(c.id, 3), 3);
    await as('sup')('POST', `${w()}/conversations/${c.id}/messages`, { body: 'Hola Marta, soy Laura.' });
    assert.equal((await prisma.whatsappConversation.findUnique({ where: { id: c.id } })).botPaused, true);
    const detail = await as('sup')('GET', `${w()}/conversations/${c.id}`);
    assert.equal(detail.body.messages.filter((m) => m.bot).length, 3);

    // Apagado, no responde.
    await as('owner')('PUT', `${w()}/bot`, { enabled: false });
    await hook(inbound('573007778899', 'wamid.bot.5', 'Hola', 'Nuevo'));
    await new Promise((r) => setTimeout(r, 400));
    const n = await prisma.whatsappConversation.findFirst({ where: { companyId: company.id, waId: '573007778899' } });
    assert.equal(await botCount(n.id), 0);
  });

  it('sin el módulo no entra nadie', async () => {
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['crm'] });
    assert.equal((await as('owner')('GET', w())).status, 403);
  });
});
