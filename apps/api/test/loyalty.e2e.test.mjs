// Pruebas de integración de la tarjeta de sellos: alta del programa (equipo 3R), tarjeta del cliente
// (registro, sellos, canjes, recuperar en otro celular) y panel del dueño.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
process.env.LOYALTY_ORIGINS = 'https://negocio-prueba.example.com/';

const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');

const stamp = Date.now();
const password = 'una-clave-larga-123';
const adminEmail = `loyalty.admin.${stamp}@example.com`;
const slug = `prueba-${stamp}`;
const slugSlow = `prueba-lenta-${stamp}`;
const ownerKey = 'clave-del-dueno-1';

let app, prisma, base, adminToken, ownerToken, program;

const call = async (method, path, { body, tok, headers } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
};

const rewards = [
  { at: 2, label: 'Café gratis' },
  { at: 4, label: 'Cóctel gratis' },
];

describe('tarjeta de sellos', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);

    await call('POST', '/auth/register', { body: { email: adminEmail, password, firstName: 'Prueba', acceptPrivacy: true } });
    const user = await prisma.user.findUnique({ where: { email: adminEmail } });
    await prisma.userRole.create({ data: { userId: user.id, role: 'ADMIN' } });
    adminToken = (await call('POST', '/auth/login', { body: { email: adminEmail, password } })).body.accessToken;
  });

  after(async () => {
    await prisma.loyaltyProgram.deleteMany({ where: { slug: { in: [slug, slugSlow] } } });
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  describe('alta del programa (equipo 3R)', () => {
    it('solo el equipo puede crear programas', async () => {
      const res = await call('POST', '/admin/loyalty', { body: { slug, name: 'X', goal: 4, cooldownMinutes: 0, rewards, ownerKey } });
      assert.equal(res.status, 401);
    });

    it('rechaza premios desordenados o que no terminan en el último sello', async () => {
      const bad = await call('POST', '/admin/loyalty', {
        tok: adminToken,
        body: { slug, name: 'Negocio', goal: 5, cooldownMinutes: 0, rewards, ownerKey },
      });
      assert.equal(bad.status, 400);
      assert.match(bad.body.message, /último sello/);
    });

    it('crea el programa sin guardar la clave del dueño en claro', async () => {
      const res = await call('POST', '/admin/loyalty', {
        tok: adminToken,
        body: { slug, name: 'Negocio de Prueba', goal: 4, cooldownMinutes: 0, rewards, ownerKey },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.ownerKeyHash, undefined);
      program = res.body;
      const saved = await prisma.loyaltyProgram.findUnique({ where: { slug } });
      assert.notEqual(saved.ownerKeyHash, ownerKey);

      const dup = await call('POST', '/admin/loyalty', {
        tok: adminToken,
        body: { slug, name: 'Otro', goal: 4, cooldownMinutes: 0, rewards, ownerKey },
      });
      assert.equal(dup.status, 409);
    });

    it('la información pública no expone nada privado', async () => {
      const res = await call('GET', `/loyalty/${slug}`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { name: 'Negocio de Prueba', goal: 4, cooldownMinutes: 0, rewards });
    });
  });

  describe('panel del dueño: entrar y meseros', () => {
    it('la clave equivocada no entra', async () => {
      const res = await call('POST', `/loyalty/${slug}/owner/login`, { body: { key: 'otra-clave-123' } });
      assert.equal(res.status, 401);
    });

    it('entra con su clave y agrega meseros', async () => {
      const res = await call('POST', `/loyalty/${slug}/owner/login`, { body: { key: ownerKey } });
      assert.equal(res.status, 200);
      ownerToken = res.body.token;

      for (const [name, pin] of [['Lore', '3028'], ['Vere', '1026']]) {
        const s = await call('POST', `/loyalty/${slug}/owner/staff`, { tok: ownerToken, body: { name, pin } });
        assert.equal(s.status, 201);
        assert.equal(s.body.pinHash, undefined, 'nunca devuelve el hash del código');
      }
    });

    it('dos meseros activos no pueden tener el mismo código', async () => {
      const res = await call('POST', `/loyalty/${slug}/owner/staff`, { tok: ownerToken, body: { name: 'Copia', pin: '3028' } });
      assert.equal(res.status, 409);
    });

    it('sin sesión, o con la sesión de otra cosa, no entra al panel', async () => {
      assert.equal((await call('GET', `/loyalty/${slug}/owner/summary`)).status, 401);
      assert.equal((await call('GET', `/loyalty/${slug}/owner/summary`, { tok: adminToken })).status, 401);
    });

    it('la sesión del dueño no sirve en el resto de la API', async () => {
      assert.equal((await call('GET', '/auth/me', { tok: ownerToken })).status, 401);
    });
  });

  describe('tarjeta del cliente', () => {
    let tokenA, tokenB;

    it('pide aceptar el uso de datos y un celular válido', async () => {
      const noConsent = await call('POST', `/loyalty/${slug}/customers`, { body: { name: 'Ana', phone: '3001112233', consent: false } });
      assert.equal(noConsent.status, 400);
      const badPhone = await call('POST', `/loyalty/${slug}/customers`, { body: { name: 'Ana', phone: '123', consent: true } });
      assert.equal(badPhone.status, 400);
    });

    it('registra al cliente y devuelve su tarjeta vacía', async () => {
      const res = await call('POST', `/loyalty/${slug}/customers`, { body: { name: 'Ana Pérez', phone: '300 111 2233', consent: true } });
      assert.equal(res.status, 201);
      tokenA = res.body.token;
      assert.equal(res.body.card.stamps, 0);
      assert.equal(res.body.card.phone, '••• 2233');
      const saved = await prisma.loyaltyCustomer.findFirst({ where: { program: { slug }, name: 'Ana Pérez' } });
      assert.equal(saved.phone, '573001112233', 'guarda el celular con indicativo');
      assert.ok(saved.consentAt);
    });

    it('el mismo celular no crea otra tarjeta', async () => {
      const res = await call('POST', `/loyalty/${slug}/customers`, { body: { name: 'Ana', phone: '+57 300-111-2233', consent: true } });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'PHONE_EXISTS');
    });

    it('sin token no hay tarjeta', async () => {
      assert.equal((await call('GET', `/loyalty/${slug}/card`)).status, 401);
      assert.equal((await call('GET', `/loyalty/${slug}/card`, { tok: 'inventado' })).status, 401);
    });

    it('5 códigos equivocados bloquean la tarjeta, incluso para el código bueno', async () => {
      tokenB = (await call('POST', `/loyalty/${slug}/customers`, { body: { name: 'Beto', phone: '3109998877', consent: true } })).body.token;
      for (let i = 0; i < 4; i++) {
        const r = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenB, body: { pin: '0000' } });
        assert.equal(r.status, 401);
        assert.equal(r.body.code, 'BAD_PIN');
      }
      const fifth = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenB, body: { pin: '0000' } });
      assert.equal(fifth.status, 429);
      const good = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenB, body: { pin: '3028' } });
      assert.equal(good.status, 429, 'bloqueada: ni el código bueno pasa');
    });

    it('cada sello queda a nombre del mesero y el premio se canjea con código', async () => {
      const s1 = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenA, body: { pin: '3028' } });
      assert.equal(s1.status, 200);
      assert.equal(s1.body.staff, 'Lore');
      assert.equal(s1.body.card.stamps, 1);

      const early = await call('POST', `/loyalty/${slug}/card/redeem`, { tok: tokenA, body: { pin: '1026' } });
      assert.equal(early.status, 409, 'todavía no hay premio');

      const s2 = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenA, body: { pin: '1026' } });
      assert.equal(s2.body.staff, 'Vere');
      assert.equal(s2.body.card.ready.at, 2);

      const r = await call('POST', `/loyalty/${slug}/card/redeem`, { tok: tokenA, body: { pin: '1026' } });
      assert.equal(r.status, 200);
      assert.equal(r.body.reward, 'Café gratis');
      assert.equal(r.body.card.rewards[0].status, 'used');
      assert.equal(r.body.card.ready, null);
    });

    it('la tarjeta llena espera el canje; después del último premio, el siguiente sello abre otra', async () => {
      await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenA, body: { pin: '3028' } });
      const s4 = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenA, body: { pin: '3028' } });
      assert.equal(s4.body.card.stamps, 4);
      const full = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenA, body: { pin: '3028' } });
      assert.equal(full.status, 409);
      assert.equal(full.body.code, 'CARD_FULL');

      const last = await call('POST', `/loyalty/${slug}/card/redeem`, { tok: tokenA, body: { pin: '3028' } });
      assert.equal(last.body.reward, 'Cóctel gratis');
      assert.equal(last.body.card.complete, true, 'queda completa, con sus premios a la vista');
      assert.equal(last.body.card.cardsCompleted, 1);

      const fresh = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenA, body: { pin: '1026' } });
      assert.equal(fresh.status, 200);
      assert.equal(fresh.body.card.cardNumber, 2);
      assert.equal(fresh.body.card.stamps, 1);
      assert.equal(fresh.body.card.complete, false);
    });

    it('en otro celular la recupera el mesero con su código, y el celular viejo deja de verla', async () => {
      const bad = await call('POST', `/loyalty/${slug}/customers/recover`, { body: { phone: '3001112233', pin: '9999' } });
      assert.equal(bad.status, 401);
      const res = await call('POST', `/loyalty/${slug}/customers/recover`, { body: { phone: '3001112233', pin: '1026' } });
      assert.equal(res.status, 200);
      assert.equal(res.body.card.stamps, 1);
      assert.equal((await call('GET', `/loyalty/${slug}/card`, { tok: tokenA })).status, 401);
      assert.equal((await call('GET', `/loyalty/${slug}/card`, { tok: res.body.token })).status, 200);
    });

    it('un mesero dado de baja ya no pone sellos', async () => {
      const staff = (await call('GET', `/loyalty/${slug}/owner/staff`, { tok: ownerToken })).body;
      const lore = staff.find((s) => s.name === 'Lore');
      const off = await call('PATCH', `/loyalty/${slug}/owner/staff/${lore.id}`, { tok: ownerToken, body: { isActive: false } });
      assert.equal(off.body.isActive, false);
      const back = await call('PATCH', `/loyalty/${slug}/owner/staff/${lore.id}`, { tok: ownerToken, body: { isActive: true } });
      assert.equal(back.status, 400, 'para volver necesita un código nuevo');
      const tokenC = (await call('POST', `/loyalty/${slug}/customers`, { body: { name: 'Caro', phone: '3205556677', consent: true } })).body.token;
      const r = await call('POST', `/loyalty/${slug}/card/stamp`, { tok: tokenC, body: { pin: '3028' } });
      assert.equal(r.status, 401);
    });
  });

  describe('espera entre sellos', () => {
    it('no deja poner dos sellos seguidos', async () => {
      await call('POST', '/admin/loyalty', {
        tok: adminToken,
        body: { slug: slugSlow, name: 'Lento', goal: 3, cooldownMinutes: 180, rewards: [{ at: 3, label: 'Postre' }], ownerKey },
      });
      const owner = (await call('POST', `/loyalty/${slugSlow}/owner/login`, { body: { key: ownerKey } })).body.token;
      await call('POST', `/loyalty/${slugSlow}/owner/staff`, { tok: owner, body: { name: 'Juan', pin: '4321' } });
      const tok = (await call('POST', `/loyalty/${slugSlow}/customers`, { body: { name: 'Dani', phone: '3001234567', consent: true } })).body.token;
      assert.equal((await call('POST', `/loyalty/${slugSlow}/card/stamp`, { tok, body: { pin: '4321' } })).status, 200);
      const second = await call('POST', `/loyalty/${slugSlow}/card/stamp`, { tok, body: { pin: '4321' } });
      assert.equal(second.status, 409);
      assert.equal(second.body.code, 'TOO_SOON');
      assert.ok(second.body.nextStampAt);
    });

    it('la sesión del dueño de un negocio no sirve en otro', async () => {
      assert.equal((await call('GET', `/loyalty/${slugSlow}/owner/summary`, { tok: ownerToken })).status, 401);
    });
  });

  describe('lo que ve el dueño', () => {
    it('resumen con sellos, canjes y meseros', async () => {
      const res = await call('GET', `/loyalty/${slug}/owner/summary`, { tok: ownerToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.customers, 3);
      assert.equal(res.body.stamps.today, 5);
      assert.deepEqual(res.body.redemptions30.map((r) => r.count), [1, 1]);
      assert.equal(res.body.stampsByDay.length, 14);
      assert.equal(res.body.stampsByDay.at(-1).count, 5);
      const vere = res.body.staff.find((s) => s.name === 'Vere');
      assert.deepEqual([vere.stamps30, vere.redeems30], [2, 1]);
    });

    it('lista y busca clientes', async () => {
      const all = (await call('GET', `/loyalty/${slug}/owner/customers`, { tok: ownerToken })).body;
      assert.equal(all.length, 3);
      const ana = all.find((c) => c.name === 'Ana Pérez');
      assert.deepEqual([ana.stamps, ana.visits, ana.redemptions, ana.cardsCompleted], [1, 5, 2, 1]);
      const found = (await call('GET', `/loyalty/${slug}/owner/customers?q=310999`, { tok: ownerToken })).body;
      assert.deepEqual(found.map((c) => c.name), ['Beto']);
      const byName = (await call('GET', `/loyalty/${slug}/owner/customers?q=caro`, { tok: ownerToken })).body;
      assert.deepEqual(byName.map((c) => c.name), ['Caro']);
    });

    it('historial con quién hizo cada cosa', async () => {
      const events = (await call('GET', `/loyalty/${slug}/owner/events`, { tok: ownerToken })).body;
      assert.equal(events[0].kind, 'recover');
      assert.equal(events[0].staff, 'Vere');
      const redeem = events.find((e) => e.kind === 'redeem' && e.reward === 'Café gratis');
      assert.equal(redeem.customer, 'Ana Pérez');
    });

    it('exporta los clientes para Excel', async () => {
      const res = await fetch(`${base}/loyalty/${slug}/owner/customers.csv`, { headers: { authorization: `Bearer ${ownerToken}` } });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/csv/);
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM para que Excel lea bien las tildes');
      const text = bytes.subarray(3).toString('utf8');
      assert.ok(text.startsWith('Nombre;Celular'));
      assert.ok(text.includes('Ana Pérez;573001112233;1/4'));
    });

    it('cambia su clave', async () => {
      const wrong = await call('POST', `/loyalty/${slug}/owner/key`, { tok: ownerToken, body: { current: 'no-es-esta-1', next: 'clave-nueva-123' } });
      assert.equal(wrong.status, 401);
      const ok = await call('POST', `/loyalty/${slug}/owner/key`, { tok: ownerToken, body: { current: ownerKey, next: 'clave-nueva-123' } });
      assert.equal(ok.status, 200);
      assert.equal((await call('POST', `/loyalty/${slug}/owner/login`, { body: { key: ownerKey } })).status, 401);
      assert.equal((await call('POST', `/loyalty/${slug}/owner/login`, { body: { key: 'clave-nueva-123' } })).status, 200);
    });
  });

  it('la página del negocio puede llamar a la API desde su dominio (CORS)', async () => {
    const res = await fetch(`${base}/loyalty/${slug}`, { headers: { origin: 'https://negocio-prueba.example.com' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://negocio-prueba.example.com');
    const other = await fetch(`${base}/loyalty/${slug}`, { headers: { origin: 'https://otro.example.com' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});
