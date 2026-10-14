// Alta automática del primer programa con las variables LOYALTY_BOOTSTRAP_* (puesta en marcha sin el panel del equipo).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';

process.loadEnvFile('.env');
const slug = `arranque-${Date.now()}`;
process.env.LOYALTY_BOOTSTRAP_SLUG = slug;
process.env.LOYALTY_BOOTSTRAP_NAME = 'Negocio de Arranque';
process.env.LOYALTY_BOOTSTRAP_OWNER_KEY = 'clave-arranque-1';
process.env.LOYALTY_BOOTSTRAP_REWARDS = '4: 20 % de descuento | 7: Café gratis | 10: Cóctel gratis';
process.env.LOYALTY_BOOTSTRAP_COOLDOWN_HOURS = '3';

const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { parseRewardList } = await import('../dist/loyalty/loyalty-bootstrap.js');

let app, prisma, base;

describe('alta automática del programa', () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    prisma = app.get(PrismaService);
  });

  after(async () => {
    await prisma.loyaltyProgram.deleteMany({ where: { slug } });
    await app.close();
  });

  it('crea el programa con sus premios y la espera entre sellos', async () => {
    const info = await (await fetch(`${base}/loyalty/${slug}`)).json();
    assert.equal(info.name, 'Negocio de Arranque');
    assert.equal(info.goal, 10);
    assert.equal(info.cooldownMinutes, 180);
    assert.deepEqual(info.rewards.map((r) => r.at), [4, 7, 10]);
  });

  it('el dueño entra con la clave de la variable', async () => {
    const res = await fetch(`${base}/loyalty/${slug}/owner/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'clave-arranque-1' }),
    });
    assert.equal(res.status, 200);
  });

  it('volver a arrancar no cambia un programa que ya existe', async () => {
    await prisma.loyaltyProgram.update({ where: { slug }, data: { name: 'Nombre cambiado en el panel' } });
    const second = await NestFactory.create(AppModule, { logger: false });
    await second.init();
    await second.close();
    const program = await prisma.loyaltyProgram.findUnique({ where: { slug } });
    assert.equal(program.name, 'Nombre cambiado en el panel');
  });

  it('lee la lista de premios y rechaza la mal escrita', () => {
    assert.deepEqual(parseRewardList('3: Papas | 8: Hamburguesa'), [{ at: 3, label: 'Papas' }, { at: 8, label: 'Hamburguesa' }]);
    assert.equal(parseRewardList('3 Papas'), null);
    assert.equal(parseRewardList(''), null);
  });
});
