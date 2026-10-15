// Pruebas de integración del núcleo de la plataforma empresarial: empresas, miembros, roles, invitaciones y módulos.
// Requieren: npm run dev:db y npm run build -w api.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
process.env.WEB_ORIGIN = 'https://3rpaginas.test';
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  owner: `co.owner.${stamp}@example.com`,
  admin: `co.admin.${stamp}@example.com`,
  hr: `co.hr.${stamp}@example.com`,
  emp: `co.emp.${stamp}@example.com`,
  outsider: `co.out.${stamp}@example.com`,
  staff: `co.staff.${stamp}@example.com`,
};

let app;
let prisma;
let base;
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

const mailToken = (to, subjectContains, param = 'token') => {
  const sent = [...sentEmails].reverse().find((m) => m.to === to && m.subject.includes(subjectContains));
  const match = sent && new RegExp(`${param}=([^\\s&"]+)`).exec(sent.text);
  return match ? decodeURIComponent(match[1]) : null;
};

const signup = async (email, verify = true) => {
  await call('POST', '/auth/register', { body: { email, password, firstName: 'Prueba', acceptPrivacy: true } });
  if (verify) await call('POST', '/auth/verify-email', { body: { token: mailToken(email, 'confirma tu correo') } });
  return (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
};

describe('plataforma: empresas, roles e invitaciones', () => {
  let company;
  const members = {};

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
    for (const [key, email] of Object.entries(emails)) tokens[key] = await signup(email);
    const staff = await prisma.user.findUnique({ where: { email: emails.staff } });
    await prisma.userRole.create({ data: { userId: staff.id, role: 'ADMIN' } });
    tokens.staff = (await call('POST', '/auth/login', { body: { email: emails.staff, password } })).body.accessToken;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { members: { some: { user: { email: { startsWith: 'co.' } } } } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'co.' } } });
    } finally {
      await app.close();
    }
  });

  it('un usuario crea su empresa y queda como dueño', async () => {
    const res = await as('owner')('POST', '/companies', { name: '  Café La Muralla  ', city: 'Cartagena', industry: 'Restaurante' });
    assert.equal(res.status, 201);
    company = res.body;
    assert.equal(company.name, 'Café La Muralla');
    assert.match(company.slug, /^cafe-la-muralla/);
    assert.equal(company.me.role, 'owner');
    assert.equal(company.memberCount, 1);
    assert.ok(company.modules.length >= 20, 'trae el catálogo de módulos');
    assert.ok(company.modules.every((m) => m.enabled === false));
    const mine = (await as('owner')('GET', '/companies')).body;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].role, 'owner');
  });

  it('sin correo confirmado no se crea empresa, y el nombre se valida', async () => {
    const unverified = await signup(`co.unv.${stamp}@example.com`, false);
    assert.equal((await call('POST', '/companies', { token: unverified, body: { name: 'Otra' } })).status, 403);
    assert.equal((await as('owner')('POST', '/companies', { name: 'x' })).status, 400);
    assert.equal((await call('POST', '/companies', { body: { name: 'Sin sesión' } })).status, 401);
  });

  it('alguien de afuera no ve la empresa (ni sabe que existe)', async () => {
    assert.equal((await as('outsider')('GET', `/companies/${company.id}`)).status, 404);
    assert.equal((await as('outsider')('GET', `/companies/${company.id}/members`)).status, 404);
  });

  it('el dueño invita por correo y la persona acepta con ese mismo correo', async () => {
    for (const [who, role] of [['admin', 'admin'], ['hr', 'hr'], ['emp', 'employee']]) {
      const res = await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[who].toUpperCase(), role });
      assert.equal(res.status, 201);
      assert.equal(res.body.email, emails[who]);
      assert.equal(res.body.token, undefined, 'el token no sale en la respuesta');
      const token = mailToken(emails[who], 'Te invitaron a');
      assert.ok(token, 'le llega el correo con el enlace');

      const preview = await call('GET', `/company-invites/${encodeURIComponent(token)}`);
      assert.equal(preview.status, 200);
      assert.equal(preview.body.companyName, 'Café La Muralla');
      assert.equal(preview.body.role, role);

      if (who === 'emp') {
        // Con otra cuenta no se puede usar.
        assert.equal((await as('outsider')('POST', '/company-invites/accept', { token })).status, 403);
      }
      const accepted = await as(who)('POST', '/company-invites/accept', { token });
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.companyId, company.id);
      assert.equal((await as(who)('POST', '/company-invites/accept', { token })).status, 409, 'no se usa dos veces');
    }
    const list = (await as('emp')('GET', `/companies/${company.id}/members`)).body;
    assert.equal(list.length, 4);
    for (const m of list) members[m.user.email] = m;
  });

  it('no se invita a quien ya está, ni con un rol igual o mayor que el propio', async () => {
    assert.equal((await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails.emp, role: 'employee' })).status, 409);
    assert.equal((await as('admin')('POST', `/companies/${company.id}/invites`, { email: `co.x.${stamp}@example.com`, role: 'admin' })).status, 403);
    assert.equal((await as('owner')('POST', `/companies/${company.id}/invites`, { email: `co.x.${stamp}@example.com`, role: 'owner' })).status, 400);
    assert.equal((await as('hr')('POST', `/companies/${company.id}/invites`, { email: `co.x.${stamp}@example.com`, role: 'employee' })).status, 403, 'RR. HH. no invita');
    assert.equal((await as('emp')('GET', `/companies/${company.id}/invites`)).status, 403);
  });

  it('una invitación nueva al mismo correo reemplaza a la anterior, y se puede revocar', async () => {
    const email = `co.new.${stamp}@example.com`;
    await as('admin')('POST', `/companies/${company.id}/invites`, { email, role: 'employee' });
    const first = mailToken(email, 'Te invitaron a');
    const second = (await as('admin')('POST', `/companies/${company.id}/invites`, { email, role: 'supervisor' })).body;
    assert.equal((await call('GET', `/company-invites/${encodeURIComponent(first)}`)).status, 404, 'la vieja ya no sirve');
    const pending = (await as('admin')('GET', `/companies/${company.id}/invites`)).body;
    assert.deepEqual(pending.map((i) => i.email), [email]);
    assert.equal((await as('admin')('DELETE', `/companies/${company.id}/invites/${second.id}`)).status, 204);
    assert.equal((await as('admin')('GET', `/companies/${company.id}/invites`)).body.length, 0);
  });

  it('una invitación vencida no se acepta', async () => {
    const email = `co.late.${stamp}@example.com`;
    tokens.late = await signup(email);
    await as('owner')('POST', `/companies/${company.id}/invites`, { email, role: 'employee' });
    const token = mailToken(email, 'Te invitaron a');
    await prisma.companyInvite.updateMany({ where: { email }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('GET', `/company-invites/${encodeURIComponent(token)}`)).body.expired, true);
    assert.equal((await as('late')('POST', '/company-invites/accept', { token })).status, 400);
  });

  it('roles: RR. HH. edita cargo y área; solo admin cambia roles; nadie toca al dueño ni a un igual', async () => {
    const emp = members[emails.emp];
    const admin = members[emails.admin];
    const owner = members[emails.owner];
    const hr = members[emails.hr];
    const url = (m) => `/companies/${company.id}/members/${m.id}`;

    const edited = await as('hr')('PATCH', url(emp), { jobTitle: 'Mesera', area: 'Salón', hiredAt: '2026-03-15' });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.jobTitle, 'Mesera');
    assert.equal(edited.body.hiredAt.slice(0, 10), '2026-03-15');
    assert.equal((await as('hr')('PATCH', url(emp), { role: 'supervisor' })).status, 403, 'RR. HH. no cambia roles');
    assert.equal((await as('hr')('PATCH', url(admin), { jobTitle: 'Gerente' })).status, 403, 'no edita a alguien de mayor rango');
    assert.equal((await as('emp')('PATCH', url(hr), { jobTitle: 'X' })).status, 403);
    assert.equal((await as('emp')('PATCH', url(emp), { jobTitle: 'Mesera principal' })).status, 403, 'el empleado no puede editar (necesita RR. HH.)');

    assert.equal((await as('admin')('PATCH', url(emp), { role: 'supervisor' })).body.role, 'supervisor');
    assert.equal((await as('admin')('PATCH', url(emp), { role: 'admin' })).status, 403, 'no da un rol igual al suyo');
    assert.equal((await as('admin')('PATCH', url(owner), { status: 'disabled' })).status, 403);
    assert.equal((await as('owner')('PATCH', url(admin), { role: 'hr' })).body.role, 'hr', 'el dueño sí');
    assert.equal((await as('owner')('PATCH', url(admin), { role: 'admin' })).body.role, 'admin');
    assert.equal((await as('admin')('PATCH', url(emp), { hiredAt: '2026-02-30' })).status, 400);
  });

  it('un miembro deshabilitado ya no entra; quitar personas respeta los rangos', async () => {
    const emp = members[emails.emp];
    await as('admin')('PATCH', `/companies/${company.id}/members/${emp.id}`, { status: 'disabled' });
    assert.equal((await as('emp')('GET', `/companies/${company.id}`)).status, 404);
    assert.equal((await as('emp')('GET', '/companies')).body.length, 0);
    await as('admin')('PATCH', `/companies/${company.id}/members/${emp.id}`, { status: 'active' });
    assert.equal((await as('emp')('GET', `/companies/${company.id}`)).status, 200);

    assert.equal((await as('hr')('DELETE', `/companies/${company.id}/members/${emp.id}`)).status, 403);
    assert.equal((await as('admin')('DELETE', `/companies/${company.id}/members/${members[emails.owner].id}`)).status, 403);
    // Cualquiera puede salirse por su cuenta.
    assert.equal((await as('emp')('DELETE', `/companies/${company.id}/members/${emp.id}`)).status, 204);
    assert.equal((await as('emp')('GET', `/companies/${company.id}`)).status, 404);
  });

  it('solo un administrador edita los datos de la empresa', async () => {
    assert.equal((await as('hr')('PATCH', `/companies/${company.id}`, { city: 'Barranquilla' })).status, 403);
    const res = await as('admin')('PATCH', `/companies/${company.id}`, { taxId: '900.123.456-7', phone: '' });
    assert.equal(res.status, 200);
    assert.equal(res.body.taxId, '900.123.456-7');
    assert.equal(res.body.phone, null);
  });

  it('el equipo de 3R ve las empresas, activa solo módulos listos y suspende', async () => {
    assert.equal((await as('owner')('GET', '/admin/companies')).status, 403);
    const list = (await as('staff')('GET', '/admin/companies')).body;
    const mine = list.find((c) => c.id === company.id);
    assert.equal(mine.owner.email, emails.owner);
    assert.equal(mine.memberCount, 3);

    const bad = await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['no-existe'] });
    assert.equal(bad.status, 400);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: [] })).status, 200);

    assert.equal((await as('staff')('PATCH', `/admin/companies/${company.id}`, { status: 'suspended' })).body.status, 'suspended');
    assert.equal((await as('owner')('GET', `/companies/${company.id}`)).status, 403);
    await as('staff')('PATCH', `/admin/companies/${company.id}`, { status: 'active' });
    assert.equal((await as('owner')('GET', `/companies/${company.id}`)).status, 200);
  });
});
