// Entrar solo desde el wifi del local (6 nov 2026).
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const url = process.env.TEST_DATABASE_URL;

describe('dirección del wifi', () => {
  it('IPv4 exacta; IPv6 por su prefijo /64', async () => {
    const { networkKey, allowedFrom } = await import('../lib/local-network');
    assert.equal(networkKey('181.52.10.4'), '181.52.10.4');
    assert.equal(networkKey('::ffff:181.52.10.4'), '181.52.10.4');
    assert.equal(networkKey('2800:484:a1b2:3c00:1111:2222:3333:4444'), '2800:484:a1b2:3c00::/64');
    assert.equal(networkKey('2800:0484:a1b2:3c00::9'), '2800:484:a1b2:3c00::/64');
    assert.equal(allowedFrom('1.2.3.4', []), true, 'sin lista, desde cualquier parte');
    assert.equal(allowedFrom('181.52.10.4', ['181.52.10.4']), true);
    assert.equal(allowedFrom('181.52.10.5', ['181.52.10.4']), false);
    assert.equal(allowedFrom('2800:484:a1b2:3c00:aaaa::1', ['2800:484:a1b2:3c00::/64']), true, 'el celular cambia la parte final');
    assert.equal(allowedFrom('2800:484:a1b2:3c01::1', ['2800:484:a1b2:3c00::/64']), false);
  });
});

describe('solo desde el wifi del local', { skip: url ? false : 'sin TEST_DATABASE_URL' }, () => {
  let store: typeof import('../lib/store');
  let net: typeof import('../lib/local-network');
  let db: typeof import('../lib/db');
  type Actor = import('../lib/store').StaffSession;
  let owner: Actor, waiter: Actor;
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = await import('../lib/db');
    store = await import('../lib/store');
    net = await import('../lib/local-network');
    const a = await store.createBusiness({ name: `Prueba ${stamp} Wifi`, locationName: 'Centro', ownerName: 'Dueña', ownerPin: '2580' });
    const login = async (code: string, pin: string) => {
      const r = await store.loginStaff({ slug: a.slug, code, pin });
      if (r.kind !== 'ok') throw new Error('sin sesión');
      return (await store.getStaffSession(r.staffId, r.locationId, r.epoch))!;
    };
    owner = await login('0001', '2580');
    await store.createStaff(owner, { name: 'Mesero', role: 'waiter', locationId: null, pin: '1357' });
    waiter = await login('0002', '1357');
  });

  after(async () => {
    const rows = await db.query<{ id: string }>('SELECT id FROM businesses WHERE name LIKE $1', [`Prueba ${stamp} %`]);
    for (const row of rows) await store.purgeBusiness(row.id);
    await db.closePool();
  });

  it('el bloqueo por wifi se quitó (9 nov 2026): el mesero trabaja desde cualquier parte aunque haya conexiones guardadas', async () => {
    assert.equal(await net.canWorkFrom(waiter, '9.9.9.9'), true, 'apagado: desde cualquier parte');
    await assert.rejects(net.addLocationNetwork(waiter, '181.52.10.4'), { code: 'FORBIDDEN' });
    await net.addLocationNetwork(owner, '181.52.10.4');
    await assert.rejects(net.addLocationNetwork(owner, '181.52.10.4'), { code: 'CONFLICT' });
    assert.equal(await net.canWorkFrom(waiter, '181.52.10.4'), true);
    assert.equal(await net.canWorkFrom(waiter, '9.9.9.9'), true, 'desde la casa también (bloqueo quitado)');
    assert.equal(await net.canWorkFrom(owner, '9.9.9.9'), true, 'la dueña sí');
    await net.removeLocationNetwork(owner, '181.52.10.4');
    assert.equal(await net.canWorkFrom(waiter, '9.9.9.9'), true, 'sin conexiones vuelve a desde cualquier parte');
  });
});
