// Pruebas de integración del módulo CRM de la plataforma empresarial.
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
const emails = { owner: `crm.owner.${stamp}@example.com`, emp: `crm.emp.${stamp}@example.com`, out: `crm.out.${stamp}@example.com`, staff: `crm.staff.${stamp}@example.com` };
let app, prisma, base, company;
const tokens = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
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

describe('módulo CRM', () => {
  let crm;
  let contact;
  let empMember;

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
    company = (await as('owner')('POST', '/companies', { name: `Ventas ${stamp}` })).body;
    await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails.emp, role: 'employee' });
    await as('emp')('POST', '/company-invites/accept', { token: mailToken(emails.emp, 'Te invitaron a') });
    empMember = (await as('owner')('GET', `/companies/${company.id}/members`)).body.find((m) => m.user.email === emails.emp);
    crm = `/companies/${company.id}/crm`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'crm.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('owner')('GET', `${crm}/contacts`)).status, 403);
    const res = await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['crm'] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.modules, ['crm']);
    const detail = (await as('owner')('GET', `/companies/${company.id}`)).body;
    assert.equal(detail.modules.find((m) => m.key === 'crm').enabled, true);
    assert.equal((await as('owner')('GET', `${crm}/contacts`)).status, 200);
  });

  it('un empleado crea un cliente; el valor va en pesos y se guarda en centavos', async () => {
    const res = await as('emp')('POST', `${crm}/contacts`, {
      name: ' Hotel Las Américas ',
      organization: 'Grupo Américas',
      email: 'Compras@HotelAmericas.co',
      phone: '310 000 0000',
      value: 2_500_000,
      source: 'referral',
      ownerMemberId: empMember.id,
    });
    assert.equal(res.status, 201);
    contact = res.body;
    assert.equal(contact.name, 'Hotel Las Américas');
    assert.equal(contact.email, 'compras@hotelamericas.co');
    assert.equal(contact.stage, 'lead');
    assert.equal(contact.valueCents, 250_000_000);
    await as('emp')('POST', `${crm}/contacts`, { name: 'Restaurante El Muelle', value: 800_000, stage: 'quote' });
    await as('emp')('POST', `${crm}/contacts`, { name: 'Clínica del Mar', stage: 'won', value: 1_000_000 });
  });

  it('valida los datos y el responsable', async () => {
    assert.equal((await as('emp')('POST', `${crm}/contacts`, { name: 'x' })).status, 400);
    assert.equal((await as('emp')('POST', `${crm}/contacts`, { name: 'Ok', email: 'no-es-correo' })).status, 400);
    assert.equal((await as('emp')('POST', `${crm}/contacts`, { name: 'Ok', stage: 'otra' })).status, 400);
    assert.equal((await as('emp')('POST', `${crm}/contacts`, { name: 'Ok', value: 10.5 })).status, 400);
    const otherMember = '00000000-0000-4000-8000-000000000000';
    assert.equal((await as('emp')('POST', `${crm}/contacts`, { name: 'Ok', ownerMemberId: otherMember })).status, 400);
  });

  it('busca y filtra por etapa', async () => {
    assert.equal((await as('owner')('GET', `${crm}/contacts?q=muelle`)).body.length, 1);
    assert.equal((await as('owner')('GET', `${crm}/contacts?q=americas`)).body.length, 1, 'busca también en la organización y el correo');
    assert.equal((await as('owner')('GET', `${crm}/contacts?stage=quote`)).body.length, 1);
    assert.equal((await as('owner')('GET', `${crm}/contacts`)).body.length, 3);
  });

  it('mover de etapa queda en el historial; una llamada cuenta como último contacto', async () => {
    const moved = await as('emp')('PATCH', `${crm}/contacts/${contact.id}`, { stage: 'negotiation', value: 3_000_000 });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.stage, 'negotiation');
    assert.equal(moved.body.valueCents, 300_000_000);
    await as('emp')('POST', `${crm}/contacts/${contact.id}/activities`, { kind: 'note', body: 'Quieren menú en inglés' });
    assert.equal((await as('emp')('GET', `${crm}/contacts/${contact.id}`)).body.lastContactAt, null, 'una nota no cuenta');
    const call1 = await as('emp')('POST', `${crm}/contacts/${contact.id}/activities`, { kind: 'call', body: 'Llamé a compras, piden cotización formal' });
    assert.equal(call1.status, 201);
    const detail = (await as('owner')('GET', `${crm}/contacts/${contact.id}`)).body;
    assert.ok(detail.lastContactAt);
    assert.deepEqual(detail.activities.map((a) => a.kind), ['call', 'note', 'stage']);
    assert.equal(detail.activities[2].body, 'Nuevo → Negociación');
    assert.equal(detail.activities[0].author, 'Prueba');
    assert.equal((await as('emp')('POST', `${crm}/contacts/${contact.id}/activities`, { kind: 'stage', body: 'trampa' })).status, 400);
  });

  it('el resumen suma clientes y valor por etapa', async () => {
    const s = (await as('owner')('GET', `${crm}/summary`)).body;
    assert.equal(s.total, 3);
    assert.equal(s.openCount, 2);
    assert.equal(s.openValueCents, 300_000_000 + 80_000_000);
    assert.equal(s.wonValueCents, 100_000_000);
    assert.equal(s.stages.find((x) => x.stage === 'negotiation').count, 1);
  });

  it('nadie de afuera ve el CRM; solo un administrador borra', async () => {
    assert.equal((await as('out')('GET', `${crm}/contacts`)).status, 404);
    assert.equal((await as('out')('GET', `${crm}/contacts/${contact.id}`)).status, 404);
    assert.equal((await as('emp')('DELETE', `${crm}/contacts/${contact.id}`)).status, 403);
    assert.equal((await as('owner')('DELETE', `${crm}/contacts/${contact.id}`)).status, 204);
    assert.equal((await as('owner')('GET', `${crm}/contacts/${contact.id}`)).status, 404);
  });

  it('acepta negocios grandes (más de 21 millones de pesos)', async () => {
    const res = await as('owner')('POST', `${crm}/contacts`, { name: 'Constructora del Caribe', value: 250000000 });
    assert.equal(res.status, 201);
    assert.equal(res.body.valueCents, 25000000000);
    assert.equal((await as('owner')('GET', `${crm}/contacts/${res.body.id}`)).body.valueCents, 25000000000);
    assert.ok((await as('owner')('GET', `${crm}/summary`)).body.openValueCents >= 25000000000);
  });

  it('si 3R le quita el módulo, el CRM se cierra pero los datos quedan', async () => {
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: [] });
    assert.equal((await as('owner')('GET', `${crm}/contacts`)).status, 403);
    assert.equal(await prisma.crmContact.count({ where: { companyId: company.id } }), 3);
  });
});
