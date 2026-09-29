import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPassword, parseSession, sessionValue } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/passwords';

describe('ingreso al panel', () => {
  it('sin configuración nadie entra', () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SESSION_SECRET;
    assert.equal(checkPassword(''), false);
    assert.equal(parseSession(sessionValue().value), null);
  });

  it('la clave del administrador y la sesión firmada', () => {
    process.env.ADMIN_PASSWORD = 'clave-de-prueba';
    process.env.SESSION_SECRET = 'un-secreto-largo-de-prueba-123';
    assert.equal(checkPassword('clave-de-prueba'), true);
    assert.equal(checkPassword('otra'), false);

    const { value } = sessionValue('admin');
    assert.equal(parseSession(value), 'admin');
    const [expires, subject, signature] = value.split('.');
    assert.equal(parseSession(`${expires}.${subject}.${signature.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))}`), null, 'firma alterada');
    assert.equal(parseSession(`${Date.now() + 1e12}.${subject}.${signature}`), null, 'fecha alterada');
    assert.equal(parseSession(sessionValue('admin', Date.now() - 31 * 86_400_000).value), null, 'vencida');
    assert.equal(parseSession(undefined), null);

    // Cambiar la clave cierra las sesiones abiertas.
    process.env.ADMIN_PASSWORD = 'clave-nueva';
    assert.equal(parseSession(value), null);
  });

  it('la sesión de un jefe no se puede convertir en la del administrador', () => {
    process.env.ADMIN_PASSWORD = 'clave-de-prueba';
    process.env.SESSION_SECRET = 'un-secreto-largo-de-prueba-123';
    const id = '11111111-2222-3333-4444-555555555555';
    const { value } = sessionValue(`m-${id}`);
    assert.equal(parseSession(value), `m-${id}`);
    const [expires, , signature] = value.split('.');
    assert.equal(parseSession(`${expires}.admin.${signature}`), null);
    assert.equal(parseSession(`${expires}.m-otro.${signature}`), null);
  });

  it('las claves de los jefes se guardan cifradas', async () => {
    const stored = await hashPassword('clave-del-jefe');
    assert.ok(!stored.includes('clave-del-jefe'));
    assert.notEqual(stored, await hashPassword('clave-del-jefe'), 'cada una con su propia sal');
    assert.equal(await verifyPassword('clave-del-jefe', stored), true);
    assert.equal(await verifyPassword('otra', stored), false);
    assert.equal(await verifyPassword('clave-del-jefe', 'basura'), false);
  });
});
