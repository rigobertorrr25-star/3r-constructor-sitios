// Pruebas de integración del módulo de documentos de la plataforma empresarial.
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
  hr: `doc.hr.${stamp}@example.com`,
  owner: `doc.owner.${stamp}@example.com`,
  emp: `doc.emp.${stamp}@example.com`,
  emp2: `doc.emp2.${stamp}@example.com`,
  sup: `doc.sup.${stamp}@example.com`,
  out: `doc.out.${stamp}@example.com`,
  staff: `doc.staff.${stamp}@example.com`,
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

const pdf = Buffer.from('%PDF-1.4\n% documento de prueba\n');

describe('módulo de documentos', () => {
  let d;
  const member = {};
  let policy;
  let contract;

  const send = async (who, meta, file = pdf) => {
    const res = await as(who)('POST', `${d}/uploads`, { contentType: 'application/pdf', size: file.length, ...meta });
    if (res.status !== 201) return res;
    const put = await fetch(res.body.upload.url, { method: 'PUT', headers: res.body.upload.headers, body: file });
    assert.equal(put.status, 200);
    return as(who)('POST', `${d}/${res.body.documentId}/confirm`);
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
    company = (await as('owner')('POST', '/companies', { name: `Archivo ${stamp}` })).body;
    for (const [k, role] of [['emp', 'employee'], ['emp2', 'employee'], ['sup', 'supervisor'], ['hr', 'hr']]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    for (const m of (await as('owner')('GET', `/companies/${company.id}/members`)).body) {
      member[Object.keys(emails).find((x) => emails[x] === m.user.email)] = m.id;
    }
    d = `/companies/${company.id}/documents`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'doc.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; el equipo de 3R lo activa', async () => {
    assert.equal((await as('emp')('GET', d)).status, 403);
    assert.equal((await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['documents'] })).status, 200);
    assert.equal((await as('emp')('GET', d)).status, 200);
    assert.equal((await as('out')('GET', d)).status, 404);
  });

  it('RR. HH. sube un documento de la empresa en dos pasos; un empleado no puede', async () => {
    const res = await send('hr', { title: 'Reglamento interno', category: 'policy', fileName: 'reglamento.pdf' });
    assert.equal(res.status, 201);
    policy = res.body;
    assert.equal(policy.size, pdf.length);
    assert.equal((await as('emp')('POST', `${d}/uploads`, { title: 'Política', category: 'policy', fileName: 'x.pdf', contentType: 'application/pdf', size: 10 })).status, 403);
    assert.equal((await as('hr')('POST', `${d}/uploads`, { title: 'Virus', category: 'policy', fileName: 'x.exe', contentType: 'application/x-msdownload', size: 10 })).status, 400);
    assert.equal((await as('hr')('POST', `${d}/uploads`, { title: 'Gigante', category: 'policy', fileName: 'x.pdf', contentType: 'application/pdf', size: 30 * 1024 * 1024 })).status, 400);
    // Pedir el enlace sin subir el archivo: no queda en la lista ni se puede confirmar.
    const pending = await as('hr')('POST', `${d}/uploads`, { title: 'Sin subir', category: 'manual', fileName: 'y.pdf', contentType: 'application/pdf', size: 10 });
    assert.equal((await as('hr')('POST', `${d}/${pending.body.documentId}/confirm`)).status, 400);
    assert.deepEqual((await as('emp')('GET', d)).body.documents.map((x) => x.title), ['Reglamento interno']);
  });

  it('cualquiera del equipo descarga el reglamento con un enlace firmado que trae el archivo', async () => {
    const { body } = await as('emp')('GET', `${d}/${policy.id}/download`);
    const file = await fetch(body.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'application/pdf');
    assert.match(file.headers.get('content-disposition'), /reglamento\.pdf/);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
    // El enlace alterado no sirve.
    assert.equal((await fetch(body.url.replace(/sig=[0-9a-f]{4}/, 'sig=0000'))).status, 404);
    assert.equal((await fetch(body.url.replace('name=reglamento.pdf', 'name=otro.pdf'))).status, 404);
  });

  it('un documento solo para RR. HH. no lo ve el equipo', async () => {
    const res = await send('hr', { title: 'Nómina de octubre', category: 'other', fileName: 'nomina.pdf', audience: 'hr' });
    assert.equal(res.status, 201);
    assert.equal((await as('emp')('GET', d)).body.documents.length, 1);
    assert.equal((await as('emp')('GET', `${d}/${res.body.id}/download`)).status, 404);
    assert.equal((await as('hr')('GET', d)).body.documents.length, 2);
  });

  it('documentos del empleado: los ve él y RR. HH.; otro empleado y el supervisor no', async () => {
    const res = await send('hr', { title: 'Contrato 2026', category: 'contract', fileName: 'contrato.pdf', memberId: member.emp, expiresOn: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
    assert.equal(res.status, 201);
    contract = res.body;
    assert.equal(contract.can.manage, true);
    const own = (await as('emp')('GET', `${d}?memberId=${member.emp}`)).body;
    assert.deepEqual(own.documents.map((x) => x.title), ['Contrato 2026']);
    assert.equal(own.documents[0].can.manage, false, 'no borra lo que subió RR. HH.');
    assert.equal((await as('emp2')('GET', `${d}?memberId=${member.emp}`)).status, 404);
    assert.equal((await as('sup')('GET', `${d}?memberId=${member.emp}`)).status, 404);
    assert.equal((await as('emp2')('GET', `${d}/${contract.id}/download`)).status, 404);
    assert.equal((await as('hr')('GET', `${d}/${contract.id}/download`)).status, 200);
    const log = await prisma.auditLog.findFirst({ where: { action: 'COMPANY_DOCUMENT_DOWNLOADED', entityId: company.id } });
    assert.ok(log, 'queda constancia de que RR. HH. lo descargó');
    // RR. HH. no abre la carpeta de alguien de su rango o mayor.
    assert.equal((await as('hr')('GET', `${d}?memberId=${member.owner}`)).status, 404);
  });

  it('el empleado sube los suyos y puede borrarlos; no sube a otro', async () => {
    const mine = await send('emp', { title: 'Incapacidad 3 oct', category: 'medical', fileName: 'incapacidad.jpg', contentType: 'image/jpeg', memberId: member.emp });
    assert.equal(mine.status, 201);
    assert.equal(mine.body.can.manage, true);
    assert.equal((await as('emp')('POST', `${d}/uploads`, { title: 'Ajeno', category: 'medical', fileName: 'a.pdf', contentType: 'application/pdf', size: 5, memberId: member.emp2 })).status, 403);
    assert.equal((await as('emp')('POST', `${d}/uploads`, { title: 'Categoría mala', category: 'policy', fileName: 'a.pdf', contentType: 'application/pdf', size: 5, memberId: member.emp })).status, 400);
    assert.equal((await as('emp')('DELETE', `${d}/${mine.body.id}`)).status, 204);
    assert.equal((await as('emp')('DELETE', `${d}/${contract.id}`)).status, 403);
  });

  it('carpetas y cifras: RR. HH. ve las de su alcance y lo que vence pronto', async () => {
    const folders = (await as('hr')('GET', `${d}/folders`)).body;
    assert.deepEqual(folders.map((f) => f.self || f.id === member.emp || f.id === member.emp2 || f.id === member.sup).every(Boolean), true);
    assert.equal(folders.some((f) => f.id === member.owner), false);
    assert.equal(folders.find((f) => f.id === member.emp).count, 1);
    const hr = (await as('hr')('GET', `${d}/summary`)).body;
    assert.deepEqual(hr.expiring.map((x) => x.title), ['Contrato 2026']);
    const emp = (await as('emp')('GET', `${d}/summary`)).body;
    assert.equal(emp.company, 1);
    assert.equal(emp.mine, 1);
    assert.deepEqual(emp.expiring, []);
    assert.deepEqual((await as('emp')('GET', `${d}/folders`)).body.map((f) => f.id), [member.emp]);
  });

  it('RR. HH. cambia y borra; el archivo deja de descargarse', async () => {
    assert.equal((await as('hr')('PATCH', `${d}/${policy.id}`, { title: 'Reglamento interno 2026' })).body.title, 'Reglamento interno 2026');
    const { body } = await as('emp')('GET', `${d}/${policy.id}/download`);
    assert.equal((await as('hr')('DELETE', `${d}/${policy.id}`)).status, 204);
    assert.equal((await fetch(body.url)).status, 404, 'el archivo ya no está');
  });
});
