// Pruebas de integración de correos: registro, recuperar contraseña, verificar el correo
// y el candado de "correo sin verificar" al pedir una página. Usa el LoggingMailSender
// (sin RESEND_API_KEY): los correos quedan en `sentEmails`, en el mismo proceso que esta prueba.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
assert.equal(process.env.RESEND_API_KEY ?? '', '', 'estas pruebas exigen modo de prueba (sin RESEND_API_KEY)');

const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { sentEmails } = await import('../dist/email/logging-mail-sender.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const email = `email.test.${stamp}@example.com`;
const adminEmail = process.env.ADMIN_EMAIL;

let app;
let prisma;
let base;

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
};

const lastTo = (to, subjectContains) => [...sentEmails].reverse().find((m) => m.to === to && m.subject.includes(subjectContains));
const tokenOf = (mail) => {
  const match = mail && /token=([^\s&"]+)/.exec(mail.text);
  return match ? decodeURIComponent(match[1]) : null;
};

describe('correos', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
  });

  after(async () => {
    await prisma.order.deleteMany({ where: { user: { email: { startsWith: 'email.test.' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'email.test.' } } });
    await app.close();
  });

  it('registrarse manda bienvenida+verificación al cliente y aviso al administrador', async () => {
    const before = sentEmails.length;
    const res = await call('POST', '/auth/register', { body: { email, password, firstName: 'Ana', acceptPrivacy: true } });
    assert.equal(res.status, 201);
    assert.ok(sentEmails.length >= before + (adminEmail ? 2 : 1));

    const welcome = lastTo(email, 'confirma tu correo');
    assert.ok(welcome, 'debe mandar bienvenida+verificación al cliente');
    assert.ok(welcome.html.includes('Ana') && welcome.html.includes('/verificar?token='));
    assert.ok(!welcome.subject.includes('\n') && !welcome.html.includes('<script'));

    if (adminEmail) {
      const admin = lastTo(adminEmail, 'Cuenta nueva registrada');
      assert.ok(admin, 'debe avisar al administrador');
      assert.ok(admin.html.includes(email));
    }
  });

  it('un usuario no verificado no puede pedir una página', async () => {
    const login = await call('POST', '/auth/login', { body: { email, password } });
    const res = await call('POST', '/orders', {
      token: login.body.accessToken,
      body: { packageSlug: 'esencial', brief: { businessName: 'Panadería X', businessType: 'Panadería', description: 'Una descripción de al menos diez letras.' } },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  });

  it('reenviar verificación respeta el enfriamiento de un minuto', async () => {
    const login = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
    // El enlace de bienvenida se acaba de mandar: pedir otro tan pronto queda bloqueado.
    const blocked = await call('POST', '/auth/resend-verification', { token: login });
    assert.equal(blocked.status, 429);

    // Se simula que pasó más de un minuto, adelantando la fecha del token existente.
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, purpose: 'email_verification' },
      data: { createdAt: new Date(Date.now() - 2 * 60_000) },
    });

    const ok = await call('POST', '/auth/resend-verification', { token: login });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.sent);

    const again = await call('POST', '/auth/resend-verification', { token: login });
    assert.equal(again.status, 429, 'el nuevo envío también inicia su propio enfriamiento');
  });

  it('el enlace de verificación confirma el correo, y uno inválido no', async () => {
    assert.equal((await call('POST', '/auth/verify-email', { body: { token: 'esto-no-es-un-token-valido-xxxxxxx' } })).status, 400);

    // Pedir otro enlace invalida el anterior: se usa el más reciente (bienvenida u "onfirma tu correo" del reenvío).
    const mail = lastTo(email, 'onfirma tu correo');
    const token = tokenOf(mail);
    assert.ok(token);
    const ok = await call('POST', '/auth/verify-email', { body: { token } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.verified, true);

    // Un enlace usado no sirve dos veces.
    assert.equal((await call('POST', '/auth/verify-email', { body: { token } })).status, 400);

    const login = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
    const me = await call('GET', '/auth/me', { token: login });
    assert.ok(me.body.emailVerifiedAt);
  });

  it('ya verificado, ahora sí puede pedir una página', async () => {
    const login = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
    const res = await call('POST', '/orders', {
      token: login,
      body: { packageSlug: 'esencial', brief: { businessName: 'Panadería X', businessType: 'Panadería', description: 'Pan artesanal todos los días.' } },
    });
    assert.equal(res.status, 201);
  });

  it('reenviar verificación cuando ya está verificado no manda nada nuevo', async () => {
    const login = (await call('POST', '/auth/login', { body: { email, password } })).body.accessToken;
    const res = await call('POST', '/auth/resend-verification', { token: login });
    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyVerified, true);
  });

  it('recuperar contraseña: pedirlo no revela si el correo existe', async () => {
    const exists = await call('POST', '/auth/forgot-password', { body: { email } });
    const notExists = await call('POST', '/auth/forgot-password', { body: { email: `no.${stamp}@example.com` } });
    assert.equal(exists.status, 200);
    assert.equal(notExists.status, 200);
    assert.equal(exists.body.message, notExists.body.message, 'el mensaje es igual exista o no la cuenta');
    assert.ok(lastTo(email, 'Recuperar tu contraseña'), 'solo se manda el correo si la cuenta existe');
  });

  it('el enlace de recuperar cambia la contraseña, cierra sesiones y avisa', async () => {
    const login = await call('POST', '/auth/login', { body: { email, password } });
    assert.equal(login.status, 200);
    const oldRefresh = login.body.refreshToken;

    const mail = lastTo(email, 'Recuperar tu contraseña');
    const token = tokenOf(mail);
    assert.ok(token);

    assert.equal((await call('POST', '/auth/reset-password', { body: { token, password: 'corta' } })).status, 400, 'valida el largo mínimo');

    const nueva = 'una-clave-distinta-456';
    const reset = await call('POST', '/auth/reset-password', { body: { token, password: nueva } });
    assert.equal(reset.status, 200);

    // El enlace ya no sirve una segunda vez.
    assert.equal((await call('POST', '/auth/reset-password', { body: { token, password: 'otra-clave-789' } })).status, 400);

    // La sesión que tenía abierta quedó cerrada.
    assert.equal((await call('POST', '/auth/refresh', { body: { refreshToken: oldRefresh } })).status, 401);

    // La contraseña vieja ya no funciona; la nueva sí.
    assert.equal((await call('POST', '/auth/login', { body: { email, password } })).status, 401);
    assert.equal((await call('POST', '/auth/login', { body: { email, password: nueva } })).status, 200);

    assert.ok(lastTo(email, 'Tu contraseña cambió'), 'avisa que la contraseña cambió');
  });

  it('un enlace de recuperar viejo o inventado no sirve', async () => {
    const res = await call('POST', '/auth/reset-password', { body: { token: 'token-inventado-que-no-existe-xxxxx', password: 'lo-que-sea-123' } });
    assert.equal(res.status, 400);
  });
});
