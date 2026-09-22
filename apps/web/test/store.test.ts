import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createComponent, createSection } from '../lib/editor/factory';
import { createEditorState, editorReducer, type EditorAction, type EditorState } from '../lib/editor/store';
import { findNode } from '../lib/editor/tree';

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const start = () => createEditorState({ version: 1, sections: [] });
const section = (id: string) => createSection('blank', () => id);
const heading = (id: string) => ({ ...createComponent('heading', () => id), id });

describe('store', () => {
  it('agregar selecciona lo nuevo y deshacer lo quita junto con la selección', () => {
    let s = run(start(), { type: 'add-section', section: section('s1'), index: 0 });
    assert.equal(s.selectedId, 's1');
    s = run(s, { type: 'add-component', node: heading('h1'), parentId: 's1', index: 0 });
    assert.equal(s.selectedId, 'h1');
    s = run(s, { type: 'undo' });
    assert.equal(s.selectedId, null, 'el nodo ya no existe');
    assert.equal(findNode(s.history.present, 'h1'), null);
    s = run(s, { type: 'redo' });
    assert.ok(findNode(s.history.present, 'h1'));
  });

  it('agregar a un padre inválido no cambia nada ni ensucia el historial', () => {
    const s = run(start(), { type: 'add-section', section: section('s1'), index: 0 });
    const next = run(s, { type: 'add-component', node: heading('h1'), parentId: 'no-existe', index: 0 });
    assert.equal(next, s);
  });

  it('las ediciones seguidas de un mismo campo son un solo paso de deshacer', () => {
    let s = run(
      start(),
      { type: 'add-section', section: section('s1'), index: 0 },
      { type: 'add-component', node: heading('h1'), parentId: 's1', index: 0 },
    );
    for (const text of ['H', 'Ho', 'Hol', 'Hola']) {
      s = run(s, { type: 'update', id: 'h1', patch: { content: text }, group: 'content:h1' });
    }
    s = run(s, { type: 'undo' });
    assert.equal(findNode(s.history.present, 'h1')!.node.content, 'Escribe un título');
  });

  it('borrar limpia la selección; duplicar selecciona la copia', () => {
    let s = run(
      start(),
      { type: 'add-section', section: section('s1'), index: 0 },
      { type: 'add-component', node: heading('h1'), parentId: 's1', index: 0 },
      { type: 'duplicate', id: 'h1', suffix: 'x' },
    );
    assert.equal(s.selectedId, 'heading-x1');
    assert.equal(findNode(s.history.present, 's1')!.node.components?.length, 2);
    s = run(s, { type: 'remove', id: 'heading-x1' });
    assert.equal(s.selectedId, null);
    assert.equal(findNode(s.history.present, 's1')!.node.components?.length, 1);
  });

  it('vista previa quita la selección y "replace" reinicia el historial', () => {
    let s = run(start(), { type: 'add-section', section: section('s1'), index: 0 });
    s = run(s, { type: 'preview', on: true });
    assert.equal(s.selectedId, null);
    s = run(s, { type: 'replace', doc: { version: 1, sections: [] } });
    assert.equal(s.history.past.length, 0);
    assert.equal(run(s, { type: 'undo' }), s, 'sin historial, deshacer no cambia el estado');
  });
});
