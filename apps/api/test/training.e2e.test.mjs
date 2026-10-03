// Pruebas de integración del capacitaciones de la plataforma empresarial.
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
  owner: `trn.owner.${stamp}@example.com`,
  emp: `trn.emp.${stamp}@example.com`,
  emp2: `trn.emp2.${stamp}@example.com`,
  sup: `trn.sup.${stamp}@example.com`,
  hr: `trn.hr.${stamp}@example.com`,
  staff: `trn.staff.${stamp}@example.com`,
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

describe('capacitaciones', () => {
  let t;
  let course;
  const member = async (k) => prisma.companyMember.findFirst({ where: { companyId: company.id, user: { email: emails[k] } } });
  const lessons = [
    { title: 'Lavado de manos', body: 'Lávate las manos 20 segundos antes de cada turno.', videoUrl: 'https://www.youtube.com/watch?v=demo' },
    { title: 'Temperaturas', body: 'La nevera va entre 1 y 4 grados.' },
  ];
  const questions = [
    { text: '¿Cuánto dura el lavado de manos?', options: ['5 segundos', '20 segundos'], correct: 1 },
    { text: '¿A qué temperatura va la nevera?', options: ['Entre 1 y 4 grados', 'Entre 8 y 10 grados', 'No importa'], correct: 0 },
  ];

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
    company = (await as('owner')('POST', '/companies', { name: `Capacitaciones ${stamp}` })).body;
    for (const [k, role] of [
      ['emp', 'employee'],
      ['emp2', 'employee'],
      ['sup', 'supervisor'],
      ['hr', 'hr'],
    ]) {
      await as('owner')('POST', `/companies/${company.id}/invites`, { email: emails[k], role });
      await as(k)('POST', '/company-invites/accept', { token: mailToken(emails[k], 'Te invitaron a') });
    }
    t = `/companies/${company.id}/training`;
  });

  after(async () => {
    try {
      await prisma.company.deleteMany({ where: { id: company.id } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'trn.' } } });
    } finally {
      await app.close();
    }
  });

  it('sin el módulo activo no se usa; solo RR. HH. en adelante crea y se validan las preguntas', async () => {
    assert.equal((await as('emp')('GET', t)).status, 403);
    await as('staff')('PUT', `/admin/companies/${company.id}/modules`, { keys: ['training', 'alerts'] });
    assert.equal((await as('emp')('GET', t)).status, 200);
    assert.equal((await as('sup')('POST', t, { title: 'Del supervisor', lessons })).status, 403);
    assert.equal(
      (await as('hr')('POST', t, { title: 'Mala', lessons, questions: [{ text: '¿Cuál?', options: ['A', 'B'], correct: 2 }] })).status,
      400,
    );
    assert.equal(
      (await as('hr')('POST', t, { title: 'Repetidas', lessons, questions: [{ text: '¿Cuál?', options: ['A', 'A'], correct: 0 }] })).status,
      400,
    );
    assert.equal((await as('hr')('POST', t, { title: 'Sin lecciones', lessons: [] })).status, 400);
    assert.equal((await as('hr')('POST', t, { title: 'Video raro', lessons: [{ ...lessons[0], videoUrl: 'javascript:alert(1)' }] })).status, 400);
  });

  it('curso obligatorio: borrador oculto, al publicarlo avisa y queda pendiente; el equipo no ve las respuestas', async () => {
    const res = await as('hr')('POST', t, {
      title: 'Manipulación de alimentos',
      required: true,
      dueAt: '2030-01-31',
      passScore: 100,
      lessons,
      questions,
    });
    assert.equal(res.status, 201);
    course = (await as('hr')('GET', `${t}/${res.body.id}`)).body;
    assert.equal(course.questions[1].correct, 0, 'RR. HH. ve la respuesta correcta');
    assert.equal((await as('emp')('GET', `${t}/${course.id}`)).status, 404, 'en borrador no se ve');
    assert.equal((await as('emp')('GET', t)).body.courses.length, 0);
    assert.equal((await as('hr')('POST', `${t}/${course.id}/publish`)).status, 200);
    const emp = await member('emp');
    assert.ok(await prisma.notification.findFirst({ where: { memberId: emp.id, title: 'Curso obligatorio: Manipulación de alimentos' } }));
    assert.deepEqual((await as('emp')('GET', `${t}/summary`)).body.pending, 1);
    const view = (await as('emp')('GET', `${t}/${course.id}`)).body;
    assert.equal(view.lessons[0].body, lessons[0].body);
    assert.ok(
      view.questions.every((q) => !('correct' in q)),
      'sin respuestas correctas',
    );
    assert.equal(view.mine, null);
  });

  it('lecciones, evaluación con reintento y certificado', async () => {
    const [l1, l2] = course.lessons;
    const [q1, q2] = course.questions;
    assert.equal((await as('emp')('POST', `${t}/${course.id}/quiz`, { answers: { [q1.id]: 1, [q2.id]: 0 } })).status, 400, 'primero las lecciones');
    assert.equal((await as('emp')('POST', `${t}/${course.id}/lessons/${l1.id}/done`)).body.done, 1);
    assert.equal((await as('emp')('POST', `${t}/${course.id}/lessons/${l1.id}/done`)).body.done, 1, 'no cuenta doble');
    assert.equal((await as('emp')('POST', `${t}/${course.id}/lessons/${l2.id}/done`)).body.completedAt, null, 'con evaluación, ver todo no basta');
    const fail = (await as('emp')('POST', `${t}/${course.id}/quiz`, { answers: { [q1.id]: 1, [q2.id]: 2 } })).body;
    assert.equal(fail.score, 50);
    assert.equal(fail.passed, false);
    assert.deepEqual(fail.wrong, [q2.id]);
    assert.equal((await as('emp')('GET', `${t}/${course.id}/certificate`)).status, 404, 'sin aprobar no hay certificado');
    assert.equal((await as('emp')('POST', `${t}/${course.id}/quiz`, { answers: { [q1.id]: 1 } })).status, 400, 'faltan respuestas');
    const ok = (await as('emp')('POST', `${t}/${course.id}/quiz`, { answers: { [q1.id]: 1, [q2.id]: 0 } })).body;
    assert.equal(ok.passed, true);
    assert.equal(ok.mine.attempts, 2);
    assert.ok(ok.mine.completedAt);
    assert.equal((await as('emp')('GET', `${t}/summary`)).body.pending, 0);
    const hr = await member('hr');
    assert.ok(await prisma.notification.findFirst({ where: { memberId: hr.id, title: { contains: 'terminó «Manipulación de alimentos»' } } }));
    const pdf = await fetch(`${base}${t}/${course.id}/certificate`, { headers: { authorization: `Bearer ${tokens.emp}` } });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
  });

  it('avance del equipo: supervisor lo ve y descarga certificados; un empleado no ve el de otro', async () => {
    assert.equal((await as('emp')('GET', `${t}/${course.id}/team`)).status, 403);
    const team = (await as('sup')('GET', `${t}/${course.id}/team`)).body;
    const emp = await member('emp');
    const row = team.people.find((p) => p.memberId === emp.id);
    assert.equal(row.status, 'completed');
    assert.equal(row.score, 100);
    assert.equal(team.people.filter((p) => p.status === 'pending').length, 4);
    assert.equal(team.people.at(-1).memberId, emp.id, 'los que terminaron van al final');
    assert.equal(
      (await fetch(`${base}${t}/${course.id}/certificate?memberId=${emp.id}`, { headers: { authorization: `Bearer ${tokens.sup}` } })).status,
      200,
    );
    assert.equal(
      (await fetch(`${base}${t}/${course.id}/certificate?memberId=${emp.id}`, { headers: { authorization: `Bearer ${tokens.emp2}` } })).status,
      404,
    );
    const list = (await as('sup')('GET', t)).body;
    assert.deepEqual(list.courses[0].stats, { members: 5, started: 1, completed: 1 });
  });

  it('editar conserva el avance de las lecciones que siguen; sin evaluación termina al ver la última', async () => {
    const [l1, l2] = course.lessons;
    await as('emp2')('POST', `${t}/${course.id}/lessons/${l1.id}/done`);
    const res = await as('hr')('PUT', `${t}/${course.id}`, {
      title: 'Manipulación de alimentos',
      required: true,
      lessons: [
        { id: l1.id, ...lessons[0], title: 'Lavado de manos (nuevo)' },
        { title: 'Limpieza', body: 'Desinfecta las mesas cada hora.' },
      ],
    });
    assert.equal(res.status, 200);
    const view = (await as('emp2')('GET', `${t}/${course.id}`)).body;
    assert.equal(view.lessons.length, 2);
    assert.equal(view.lessons[0].title, 'Lavado de manos (nuevo)');
    assert.ok(!view.lessons.some((l) => l.id === l2.id));
    assert.equal(view.mine.done, 1, 'el avance de la lección que siguió se conserva');
    assert.equal(view.questions.length, 0);
    const done = (await as('emp2')('POST', `${t}/${course.id}/lessons/${view.lessons[1].id}/done`)).body;
    assert.ok(done.completedAt, 'sin evaluación, ver todo lo termina');
  });

  it('archivado: solo lo ve quien lo terminó (por su certificado); borrar es de RR. HH.', async () => {
    await as('hr')('POST', `${t}/${course.id}/archive`);
    const other = (await as('hr')('POST', t, { title: 'Servicio al cliente', lessons })).body;
    await as('hr')('POST', `${t}/${other.id}/publish`);
    await as('hr')('POST', `${t}/${other.id}/archive`);
    assert.equal((await as('emp')('GET', `${t}/${course.id}`)).status, 200);
    assert.equal((await as('emp')('GET', `${t}/${other.id}`)).status, 404);
    assert.equal((await as('emp')('POST', `${t}/${course.id}/lessons/${course.lessons[0].id}/done`)).status, 400, 'archivado no se toma');
    assert.equal((await as('sup')('DELETE', `${t}/${other.id}`)).status, 403);
    assert.equal((await as('hr')('DELETE', `${t}/${other.id}`)).status, 204);
  });
});
