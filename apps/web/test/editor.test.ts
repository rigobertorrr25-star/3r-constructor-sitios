import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCss, safeUrl } from '../lib/editor/css';
import { createComponent, createSection } from '../lib/editor/factory';
import { commit, createHistory, redo, undo } from '../lib/editor/history';
import { resolve, setAt } from '../lib/editor/responsive';
import {
  collectIds,
  duplicateNode,
  findNode,
  insertComponent,
  insertSection,
  moveComponent,
  moveSection,
  nudge,
  removeNode,
  updateNode,
} from '../lib/editor/tree';
import { emptyDocument, type EditorDocument } from '../lib/editor/types';

let counter = 0;
const makeId = (type: string) => `${type}-${++counter}`;

/** section-a: [heading, container[text], button] · section-b: [] */
function sample(): EditorDocument {
  counter = 0;
  const a = createSection('blank', () => 'section-a');
  const b = createSection('blank', () => 'section-b');
  let doc = insertSection(insertSection(emptyDocument(), 0, a), 1, b);
  doc = insertComponent(doc, 'section-a', 0, { ...createComponent('heading', () => 'h'), id: 'h' });
  doc = insertComponent(doc, 'section-a', 1, { ...createComponent('container', () => 'box'), id: 'box' });
  doc = insertComponent(doc, 'box', 0, { ...createComponent('text', () => 't'), id: 't' });
  doc = insertComponent(doc, 'section-a', 2, { ...createComponent('button', () => 'btn'), id: 'btn' });
  return doc;
}

const order = (doc: EditorDocument, parentId: string) =>
  (findNode(doc, parentId)?.node.components ?? []).map((c) => c.id);

describe('tree', () => {
  it('inserta en secciones y contenedores, y no en componentes que no contienen', () => {
    const doc = sample();
    assert.deepEqual(order(doc, 'section-a'), ['h', 'box', 'btn']);
    assert.deepEqual(order(doc, 'box'), ['t']);
    assert.equal(insertComponent(doc, 'h', 0, createComponent('text', makeId)), doc, 'un título no admite hijos');
    assert.equal(insertComponent(doc, 'no-existe', 0, createComponent('text', makeId)), doc);
  });

  it('no muta el documento original', () => {
    const doc = sample();
    const snapshot = JSON.stringify(doc);
    removeNode(doc, 'h');
    moveComponent(doc, 'btn', 'section-b', 0);
    updateNode(doc, 'h', { content: 'otro' });
    assert.equal(JSON.stringify(doc), snapshot);
  });

  it('mueve entre secciones y dentro de contenedores', () => {
    const doc = sample();
    const moved = moveComponent(doc, 'btn', 'section-b', 0);
    assert.deepEqual(order(moved, 'section-a'), ['h', 'box']);
    assert.deepEqual(order(moved, 'section-b'), ['btn']);

    const into = moveComponent(doc, 'h', 'box', 1);
    assert.deepEqual(order(into, 'box'), ['t', 'h']);
  });

  it('reordena dentro del mismo padre ajustando el índice', () => {
    const doc = sample();
    assert.deepEqual(order(moveComponent(doc, 'h', 'section-a', 3), 'section-a'), ['box', 'btn', 'h']);
    assert.deepEqual(order(moveComponent(doc, 'btn', 'section-a', 0), 'section-a'), ['btn', 'h', 'box']);
    assert.equal(moveComponent(doc, 'box', 'section-a', 1), doc, 'soltar en su propio sitio no cambia nada');
    assert.equal(moveComponent(doc, 'box', 'section-a', 2), doc);
  });

  it('nunca mete un nodo dentro de sí mismo ni de sus descendientes', () => {
    const doc = sample();
    assert.equal(moveComponent(doc, 'box', 'box', 0), doc);
    const nested = insertComponent(doc, 'box', 1, { ...createComponent('container', () => 'inner'), id: 'inner' });
    assert.equal(moveComponent(nested, 'box', 'inner', 0), nested);
  });

  it('no mueve secciones como componentes y las reordena con moveSection', () => {
    const doc = sample();
    assert.equal(moveComponent(doc, 'section-a', 'section-b', 0), doc);
    assert.deepEqual(moveSection(doc, 'section-a', 2).sections.map((s) => s.id), ['section-b', 'section-a']);
    assert.equal(moveSection(doc, 'section-a', 1), doc);
  });

  it('nudge sube y baja y respeta los bordes', () => {
    const doc = sample();
    assert.deepEqual(order(nudge(doc, 'box', -1), 'section-a'), ['box', 'h', 'btn']);
    assert.deepEqual(order(nudge(doc, 'box', 1), 'section-a'), ['h', 'btn', 'box']);
    assert.equal(nudge(doc, 'h', -1), doc);
    assert.equal(nudge(doc, 'btn', 1), doc);
    assert.deepEqual(nudge(doc, 'section-a', 1).sections.map((s) => s.id), ['section-b', 'section-a']);
  });

  it('elimina nodos con todo su contenido', () => {
    const doc = sample();
    const cleaned = removeNode(doc, 'box');
    assert.equal(findNode(cleaned, 't'), null);
    assert.equal(removeNode(doc, 'no-existe'), doc);
    assert.equal(removeNode(doc, 'section-b').sections.length, 1);
  });

  it('updateNode mezcla estilos y quita claves con undefined', () => {
    const doc = sample();
    const next = updateNode(doc, 'h', { content: 'Hola', styles: { color: '#ff0000', textAlign: undefined } });
    const node = findNode(next, 'h')!.node;
    assert.equal(node.content, 'Hola');
    assert.equal(node.styles?.color, '#ff0000');
    assert.ok(!('textAlign' in (node.styles ?? {})));
    assert.equal(node.styles?.fontWeight, 700, 'conserva el resto');
    assert.equal(findNode(next, 'btn')!.node, findNode(doc, 'btn')!.node, 'comparte lo que no cambió');
  });

  it('duplica con ids nuevos y sin repetir ninguno', () => {
    const doc = sample();
    const { doc: copy, newId } = duplicateNode(doc, 'box', makeId);
    assert.ok(newId);
    assert.equal(order(copy, 'section-a').length, 4);
    const all = copy.sections.flatMap((s) => [...collectIds(s)]);
    assert.equal(new Set(all).size, all.length, 'ids únicos en todo el documento');
    assert.equal(findNode(copy, newId!)!.node.components?.length, 1, 'copia también los hijos');
  });
});

describe('historial', () => {
  it('deshace y rehace', () => {
    const d0 = emptyDocument();
    const d1 = insertSection(d0, 0, createSection('blank', () => 's1'));
    const d2 = insertSection(d1, 1, createSection('blank', () => 's2'));
    let h = createHistory(d0);
    h = commit(h, d1);
    h = commit(h, d2);
    h = undo(h);
    assert.equal(h.present, d1);
    h = undo(h);
    assert.equal(h.present, d0);
    assert.equal(undo(h), h, 'no hay más que deshacer');
    h = redo(h);
    assert.equal(h.present, d1);
  });

  it('un cambio nuevo descarta lo rehacible y un cambio sin efecto no se registra', () => {
    const d0 = emptyDocument();
    const d1 = insertSection(d0, 0, createSection('blank', () => 's1'));
    let h = commit(createHistory(d0), d1);
    h = undo(h);
    assert.equal(h.future.length, 1);
    const d2 = insertSection(d0, 0, createSection('blank', () => 's2'));
    h = commit(h, d2);
    assert.equal(h.future.length, 0);
    assert.equal(commit(h, h.present), h);
  });

  it('agrupa las pulsaciones seguidas en una sola entrada', () => {
    const base = sample();
    let h = createHistory(base);
    let doc = base;
    for (let i = 0; i < 5; i++) {
      doc = updateNode(doc, 'h', { content: 'a'.repeat(i + 1) });
      h = commit(h, doc, 'content:h', 1000 + i * 100);
    }
    assert.equal(h.past.length, 1, 'un solo punto de deshacer');
    assert.equal(undo(h).present, base);

    // Otra clave, o una pausa larga, abre una entrada nueva
    h = commit(h, updateNode(doc, 'h', { content: 'x' }), 'content:otro', 1500);
    assert.equal(h.past.length, 2);
    h = commit(h, updateNode(h.present, 'h', { content: 'y' }), 'content:otro', 5000);
    assert.equal(h.past.length, 3);
  });

  it('limita el historial a 100 entradas', () => {
    let h = createHistory(emptyDocument());
    for (let i = 0; i < 150; i++) h = commit(h, insertSection(h.present, 0, createSection('blank', () => `s${i}`)));
    assert.equal(h.past.length, 100);
  });
});

describe('responsive', () => {
  it('móvil hereda de tablet y esta de escritorio', () => {
    const value = { desktop: 52, tablet: 42 };
    assert.equal(resolve(value, 'desktop'), 52);
    assert.equal(resolve(value, 'tablet'), 42);
    assert.equal(resolve(value, 'mobile'), 42);
    assert.equal(resolve(20, 'mobile'), 20);
    assert.equal(resolve(undefined, 'mobile'), undefined);
  });

  it('setAt cambia un solo tamaño y simplifica cuando puede', () => {
    assert.deepEqual(setAt(40, 'mobile', 28), { desktop: 40, mobile: 28 });
    assert.equal(setAt(40, 'desktop', 50), 50);
    assert.deepEqual(setAt({ desktop: 40, mobile: 28 }, 'tablet', 34), { desktop: 40, tablet: 34, mobile: 28 });
    assert.equal(setAt({ desktop: 40, mobile: 28 }, 'mobile', undefined), 40);
    assert.deepEqual(setAt(undefined, 'tablet', 30), { tablet: 30 });
    assert.equal(setAt({ mobile: 20 }, 'mobile', undefined), undefined);
  });
});

describe('css y enlaces', () => {
  it('toCss resuelve por tamaño y omite lo no definido', () => {
    const css = toCss({ fontSize: { desktop: 52, mobile: 34 }, paddingX: 24, color: '#fff' }, 'mobile');
    assert.equal(css.fontSize, '34px');
    assert.equal(css.paddingLeft, '24px');
    assert.equal(css.paddingRight, '24px');
    assert.ok(!('marginTop' in css));
  });

  it('safeUrl solo deja pasar enlaces seguros', () => {
    for (const ok of ['https://a.com', 'http://a.com/x?y=1', 'mailto:a@b.com', 'tel:+1555', '#contacto', '/servicios']) {
      assert.equal(safeUrl(ok), ok);
    }
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x', '  ']) {
      assert.equal(safeUrl(bad), '', bad);
    }
  });
});
