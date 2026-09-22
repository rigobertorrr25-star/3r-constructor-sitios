import type { EditorDocument } from './types';

const LIMIT = 100;
const COALESCE_MS = 1000;

export interface History {
  past: EditorDocument[];
  present: EditorDocument;
  future: EditorDocument[];
  /** Última edición agrupable (p. ej. escribir en un campo) para no llenar el historial. */
  group?: { key: string; at: number };
}

export const createHistory = (doc: EditorDocument): History => ({ past: [], present: doc, future: [] });

/**
 * Registra un cambio. Con `groupKey`, cambios seguidos de la misma clave (dentro de 1 s)
 * reemplazan el estado actual en vez de apilar uno por pulsación de tecla.
 */
export function commit(history: History, next: EditorDocument, groupKey?: string, now = Date.now()): History {
  if (next === history.present) return history;

  const groupable =
    groupKey !== undefined &&
    history.group?.key === groupKey &&
    now - history.group.at < COALESCE_MS &&
    history.past.length > 0;

  const past = groupable ? history.past : [...history.past, history.present].slice(-LIMIT);
  return {
    past,
    present: next,
    future: [],
    group: groupKey === undefined ? undefined : { key: groupKey, at: now },
  };
}

export function undo(history: History): History {
  if (history.past.length === 0) return history;
  const past = history.past.slice(0, -1);
  return { past, present: history.past[history.past.length - 1], future: [history.present, ...history.future] };
}

export function redo(history: History): History {
  if (history.future.length === 0) return history;
  const [next, ...future] = history.future;
  return { past: [...history.past, history.present], present: next, future };
}

/** Reemplaza el documento sin dejar rastro en el historial (p. ej. al restaurar una versión). */
export const reset = (doc: EditorDocument): History => createHistory(doc);
