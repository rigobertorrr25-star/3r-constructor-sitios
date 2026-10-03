// Pruebas de integración del generador de documentos de la plataforma empresarial.
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
const { numberToWords, pesosText } = await import('../dist/doc-generator/spanish-number.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const emails = {
  hr: `gen.hr.${stamp}@example.com`,
  owner: `gen.owner.${stamp}@example.com`,
  emp: `gen.emp.${stamp}@example.com`,
  emp2: `gen.emp2.${stamp}@example.com`,
  sup: `gen.sup.${stamp}@example.com`,
  out: `gen.out.${stamp}@example.com`,
  staff: `gen.staff.${stamp}@example.com`,
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

const raw = async (who, path, body) => {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[who]}` }, body: JSON.stringify(body) });
  return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
};

describe('números en letras', () => {
  it('escribe los valores como en un certificado', () => {
    assert.equal(numberToWords(1), 'un');
    assert.equal(numberToWords(21), 'veintiún');
    assert.equal(numberToWords(100), 'cien');
    assert.equal(numberToWords(101), 'ciento un');
    assert.equal(numberToWords(1000), 'mil');
    assert.equal(numberToWords(1423500), 'un millón cuatrocientos veintitrés mil quinientos');
    assert.equal(numberToWords(2000000), 'dos millones');
    assert.equal(numberToWords(35750000), 'treinta y cinco millones setecientos cincuenta mil');
    assert.equal(pesosText(1600000), 'un millón seiscientos mil pesos ($1.600.000)');
    assert.equal(pesosText(2000000), 'dos millones de pesos ($2.000.000)');
  });
});

describe('generador de documentos', () => {
  let g;
  const member = {};
  const signer = { signerName: 'Ana Gómez', signerTitle: 'Jefe de Recursos Humanos' };

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
    company = (await as('owner')('POST', '/companies', { name: `Certificados ${stamp}`, city: 'Cartagena', taxId: '900123456-7' })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'supervisor'], ['hr', 'hr']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      member[Object.keys(emails).find((x) => emails[x] === m.user.email)] = m.id;
    }
    g = `/companies/${company.id}/doc-generator`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'gen.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; solo RR. HH. en adelante', async () => {
    assert.equal((await as('hr')('GET', `${g}/people`)).status, 403);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['doc_generator', 'documents'] })).status, 200);
    assert.equal((await as('hr')('GET', `${g}/people`)).status, 200);
    assert.equal((await as('sup')('GET', `${g}/people`)).status, 403);
    assert.equal((await as('emp')('GET', `${g}/people`)).status, 403);
  });

  it('dice qué le falta a cada ficha y RR. HH. solo ve a quienes tienen menor rango', async () => {
    const res = (await as('hr')('GET', `${g}/people`)).body;
    assert.deepEqual(res.company.missing, []);
    const ids = res.people.map((p) => p.id);
    assert.ok(ids.includes(member.emp) && !ids.includes(member.owner) && !ids.includes(member.hr));
    assert.deepEqual(res.people.find((p) => p.id === member.emp).missing, ['documento', 'cargo', 'fecha de ingreso']);
    const r = await raw('hr', `${g}/generate`, { template: 'employment_certificate', memberId: member.emp, ...signer });
    assert.equal(r.status, 400);
    assert.match(JSON.parse(r.buffer.toString()).message, /documento, cargo, fecha de ingreso/);
  });

  it('genera el certificado laboral en PDF y guarda la copia en la carpeta del empleado', async () => {
    await prisma.companyMember.update({ where: { id: member.emp }, data: { jobTitle: 'Mesera', area: 'Salón', hiredAt: new Date('2025-10-15T00:00:00Z') } });
    await prisma.employeeProfile.create({
      data: { memberId: member.emp, companyId: company.id, documentType: 'CC', documentNumber: '1047000111', contractType: 'fixed', salary: 1600000 },
    });
    const r = await raw('hr', `${g}/generate`, { template: 'employment_certificate', memberId: member.emp, includeSalary: true, saveToFolder: true, ...signer });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.match(r.headers.get('content-disposition'), /certificado-laboral-prueba-\d{4}-\d{2}-\d{2}\.pdf/);
    assert.equal(r.buffer.subarray(0, 5).toString(), '%PDF-');
    const saved = r.headers.get('x-saved-document');
    assert.ok(saved);
    const docs = (await as('emp')('GET', `/companies/${company.id}/documents?memberId=${member.emp}`)).body.documents;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].category, 'certificate');
    const dl = (await as('emp')('GET', `/companies/${company.id}/documents/${saved}/download`)).body;
    const file = Buffer.from(await (await fetch(dl.url)).arrayBuffer());
    assert.deepEqual(file, r.buffer, 'la copia es el mismo PDF');
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'COMPANY_DOCUMENT_GENERATED', entityId: company.id } }));
  });

  it('constancia de vacaciones solo con vacaciones aprobadas de esa persona', async () => {
    const approved = await prisma.leaveRequest.create({
      data: { companyId: company.id, memberId: member.emp, type: 'vacation', startDate: new Date('2026-12-14T00:00:00Z'), endDate: new Date('2026-12-26T00:00:00Z'), days: 11, reason: 'Navidad', status: 'approved', hrAt: new Date() },
    });
    const pending = await prisma.leaveRequest.create({
      data: { companyId: company.id, memberId: member.emp, type: 'vacation', startDate: new Date('2027-01-10T00:00:00Z'), endDate: new Date('2027-01-12T00:00:00Z'), days: 3, reason: 'Viaje', status: 'pending' },
    });
    assert.equal((await raw('hr', `${g}/generate`, { template: 'vacation_record', memberId: member.emp, requestId: pending.id, ...signer })).status, 400);
    assert.equal((await raw('hr', `${g}/generate`, { template: 'vacation_record', memberId: member.emp2, requestId: approved.id, ...signer })).status, 400);
    assert.equal((await raw('hr', `${g}/generate`, { template: 'vacation_record', memberId: member.emp, requestId: approved.id, ...signer })).status, 201);
    const people = (await as('hr')('GET', `${g}/people`)).body.people;
    assert.deepEqual(people.find((p) => p.id === member.emp).vacations.map((v) => v.id), [approved.id]);
  });

  it('carta libre con campos; avisa si un campo no existe o falta en la ficha', async () => {
    const ok = await raw('hr', `${g}/generate`, { template: 'custom_letter', memberId: member.emp, subject: 'Carta de felicitación', body: 'Felicitamos a {nombre}, {cargo}, por su primer año.\n\nGracias.', ...signer });
    assert.equal(ok.status, 201);
    const bad = await raw('hr', `${g}/generate`, { template: 'custom_letter', memberId: member.emp, subject: 'Carta', body: 'Hola {apodo}', ...signer });
    assert.equal(bad.status, 400);
    assert.match(JSON.parse(bad.buffer.toString()).message, /\{apodo\}/);
    const empty = await raw('hr', `${g}/generate`, { template: 'custom_letter', memberId: member.emp2, subject: 'Carta', body: 'Su cargo: {cargo}', ...signer });
    assert.equal(empty.status, 400);
  });

  it('RR. HH. no genera para alguien de su rango o mayor', async () => {
    assert.equal((await raw('hr', `${g}/generate`, { template: 'custom_letter', memberId: member.owner, subject: 'Carta', body: 'Texto', ...signer })).status, 404);
    assert.equal((await raw('owner', `${g}/generate`, { template: 'custom_letter', memberId: member.owner, subject: 'Carta propia', body: 'Texto de prueba', ...signer })).status, 201);
  });
});
