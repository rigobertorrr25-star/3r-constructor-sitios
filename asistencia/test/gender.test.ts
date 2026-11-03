import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstName, guessGender } from '../lib/gender';

describe('asistencia: hombre o mujer por el nombre (solo para el avatar)', () => {
  it('toma el primer nombre, sin tildes, también si viene "Apellido, Nombre"', () => {
    assert.equal(firstName('María José Pérez'), 'maria');
    assert.equal(firstName('Pérez, Ana'), 'ana');
    assert.equal(firstName('  Ángel  Ríos '), 'angel');
  });

  it('nombres comunes de Colombia', () => {
    for (const name of ['Carlos Gómez', 'Andrés Mejía', 'Jhon Restrepo', 'Brayan Ruiz', 'Yeison Mora', 'José Luis', 'Luca Rossi', 'Joshua Díaz']) {
      assert.equal(guessGender(name), 'm', name);
    }
    for (const name of ['Ana Pérez', 'Valentina Ríos', 'Luisa Martínez', 'Isabel Cruz', 'Leidy Jiménez', 'Karen Ortiz', 'Luz Marina', 'Nicol Vargas', 'Dayana López']) {
      assert.equal(guessGender(name), 'f', name);
    }
  });
});
