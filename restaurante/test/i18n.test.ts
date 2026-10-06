// Textos en español e inglés.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EN } from '../lib/i18n/dictionary';
import { langFromAcceptLanguage, makeT, tr, translate } from '../lib/i18n';

describe('idioma', () => {
  it('usa el idioma del navegador solo si nadie escogió', () => {
    assert.equal(langFromAcceptLanguage('en-US,en;q=0.9'), 'en');
    assert.equal(langFromAcceptLanguage('es-CO,es;q=0.9,en;q=0.8'), 'es');
    assert.equal(langFromAcceptLanguage(null), 'es');
  });

  it('traduce con huecos y deja el español si falta la traducción', () => {
    const t = makeT('en');
    assert.equal(t('Salir'), 'Sign out');
    assert.equal(t('Hay {n} papeles sin imprimir: revisa que el computador de impresión esté prendido y las impresoras con papel.', { n: 3 }).startsWith('3 tickets'), true);
    assert.equal(t('Texto que nadie tradujo'), 'Texto que nadie tradujo');
    assert.equal(translate('es', 'Mesa {n}', { n: 4 }), 'Mesa 4');
  });

  it('traduce textos ya armados del servidor con moldes', () => {
    assert.equal(tr('en', 'Algo salió mal. Intenta otra vez.'), 'Something went wrong. Please try again.');
    assert.equal(tr('es', 'Algo salió mal. Intenta otra vez.'), 'Algo salió mal. Intenta otra vez.');
    const mold = Object.keys(EN).find((k) => /\{\w+\}/.test(k))!;
    const filled = mold.replace(/\{\w+\}/g, 'XYZ');
    assert.notEqual(tr('en', filled), filled, `el molde «${mold}» calza`);
  });

  it('traduce errores y auditoría del servidor con moldes', () => {
    assert.equal(tr('en', 'Nombre del insumo: entre 2 y 60 caracteres.'), 'Ingredient name: between 2 and 60 characters.');
    assert.equal(tr('en', 'En caja debería haber $50.000: no alcanza para sacar $80.000.'), 'The drawer should have $50.000: not enough to take out $80.000.');
    assert.equal(tr('en', 'Cobró $45.000 en efectivo de la mesa 7 + propina $4.500'), 'Charged $45.000 in cash on table 7 + $4.500 tip');
    assert.equal(tr('en', 'Cambió a Ana (0002): nombre a Ana María, sede, lo desactivó'), 'Changed Ana (0002): name to Ana María, location, deactivated');
    assert.equal(tr('en', 'Abrió la mesa 4 para 1 persona'), 'Opened table 4 for 1 guest');
  });

  it('el inglés trae los mismos huecos que el español', () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [es, en] of Object.entries(EN)) assert.equal(holes(en), holes(es), `«${es}» → «${en}»`);
  });

  it('no cambia frases que escribe la gente', () => {
    assert.equal(tr('en', 'El cliente cambió de idea'), 'El cliente cambió de idea');
    assert.equal(tr('en', 'Faltó un billete de mil'), 'Faltó un billete de mil');
    assert.equal(tr('en', 'Lunes a viernes'), 'Lunes a viernes');
  });
});
