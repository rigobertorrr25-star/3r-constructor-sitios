import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPassword, isValidSession, sessionValue } from '../lib/auth';

describe('ingreso al panel', () => {
  it('sin configuración nadie entra', () => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SESSION_SECRET;
    assert.equal(checkPassword(''), false);
    assert.equal(isValidSession(sessionValue().value), false);
  });

  it('la clave y la sesión firmada', () => {
    process.env.ADMIN_PASSWORD = 'clave-de-prueba';
    process.env.SESSION_SECRET = 'un-secreto-largo-de-prueba-123';
    assert.equal(checkPassword('clave-de-prueba'), true);
    assert.equal(checkPassword('otra'), false);

    const { value } = sessionValue();
    assert.equal(isValidSession(value), true);
    assert.equal(isValidSession(value.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), false, 'firma alterada');
    assert.equal(isValidSession(`${Date.now() + 1e12}.${value.split('.')[1]}`), false, 'fecha alterada');
    assert.equal(isValidSession(sessionValue(Date.now() - 31 * 86_400_000).value), false, 'vencida');
    assert.equal(isValidSession(undefined), false);

    // Cambiar la clave cierra las sesiones abiertas.
    process.env.ADMIN_PASSWORD = 'clave-nueva';
    assert.equal(isValidSession(value), false);
  });
});
