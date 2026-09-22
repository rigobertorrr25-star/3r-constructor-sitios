// Estado del editor: documento con historial, selección, tamaño de pantalla y modo vista previa.
// El reductor es puro: los ids nuevos llegan ya generados en la acción.
import { commit, createHistory, redo, reset, undo, type History } from './history';
import {
  duplicateNode,
  findNode,
  insertComponent,
  insertSection,
  moveComponent,
  moveSection,
  nudge,
  removeNode,
  updateNode,
  type NodePatch,
} from './tree';
import type { Breakpoint, ComponentNode, EditorDocument, SectionNode } from './types';

export interface EditorState {
  history: History;
  selectedId: string | null;
  breakpoint: Breakpoint;
  preview: boolean;
}

export type EditorAction =
  | { type: 'add-section'; section: SectionNode; index: number }
  | { type: 'add-component'; node: ComponentNode; parentId: string; index: number }
  | { type: 'move'; id: string; parentId: string; index: number }
  | { type: 'move-section'; id: string; index: number }
  | { type: 'update'; id: string; patch: NodePatch; group?: string }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; suffix: string }
  | { type: 'nudge'; id: string; delta: -1 | 1 }
  | { type: 'select'; id: string | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'breakpoint'; breakpoint: Breakpoint }
  | { type: 'preview'; on: boolean }
  | { type: 'replace'; doc: EditorDocument };

export const createEditorState = (doc: EditorDocument): EditorState => ({
  history: createHistory(doc),
  selectedId: null,
  breakpoint: 'desktop',
  preview: false,
});

/** Si el nodo seleccionado ya no existe (p. ej. tras deshacer), se quita la selección. */
const keepSelection = (state: EditorState, history: History): EditorState =>
  history === state.history
    ? state
    : {
        ...state,
        history,
        selectedId:
          state.selectedId && findNode(history.present, state.selectedId) ? state.selectedId : null,
      };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const doc = state.history.present;

  switch (action.type) {
    case 'add-section': {
      const next = insertSection(doc, action.index, action.section);
      return { ...state, history: commit(state.history, next), selectedId: action.section.id };
    }
    case 'add-component': {
      const next = insertComponent(doc, action.parentId, action.index, action.node);
      if (next === doc) return state;
      return { ...state, history: commit(state.history, next), selectedId: action.node.id };
    }
    case 'move': {
      const next = moveComponent(doc, action.id, action.parentId, action.index);
      return next === doc ? state : { ...state, history: commit(state.history, next), selectedId: action.id };
    }
    case 'move-section': {
      const next = moveSection(doc, action.id, action.index);
      return next === doc ? state : { ...state, history: commit(state.history, next), selectedId: action.id };
    }
    case 'update': {
      const next = updateNode(doc, action.id, action.patch);
      return next === doc ? state : { ...state, history: commit(state.history, next, action.group) };
    }
    case 'remove': {
      const next = removeNode(doc, action.id);
      if (next === doc) return state;
      return keepSelection({ ...state, selectedId: null }, commit(state.history, next));
    }
    case 'duplicate': {
      let n = 0;
      const { doc: next, newId } = duplicateNode(doc, action.id, (type) => `${type}-${action.suffix}${++n}`);
      if (next === doc) return state;
      return { ...state, history: commit(state.history, next), selectedId: newId };
    }
    case 'nudge': {
      const next = nudge(doc, action.id, action.delta);
      return next === doc ? state : { ...state, history: commit(state.history, next) };
    }
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
    case 'undo':
      return keepSelection(state, undo(state.history));
    case 'redo':
      return keepSelection(state, redo(state.history));
    case 'breakpoint':
      return { ...state, breakpoint: action.breakpoint };
    case 'preview':
      return { ...state, preview: action.on, selectedId: action.on ? null : state.selectedId };
    case 'replace':
      return { ...state, history: reset(action.doc), selectedId: null };
  }
}
