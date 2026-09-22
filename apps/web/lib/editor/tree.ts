// Operaciones puras e inmutables sobre el árbol del documento. Devuelven el mismo objeto
// cuando no hay cambio, así el historial no registra acciones vacías.
import {
  canContain,
  type AnyNode,
  type ComponentNode,
  type EditorDocument,
  type SectionNode,
  type Styles,
  type Props,
} from './types';

export type Found =
  | { kind: 'section'; node: SectionNode; parentId: null; index: number }
  | { kind: 'component'; node: ComponentNode; parentId: string; index: number };

const childrenOf = (node: AnyNode): ComponentNode[] => node.components ?? [];

function findInChildren(parent: AnyNode, id: string): Found | null {
  const children = childrenOf(parent);
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (child.id === id) return { kind: 'component', node: child, parentId: parent.id, index };
    const deeper = findInChildren(child, id);
    if (deeper) return deeper;
  }
  return null;
}

export function findNode(doc: EditorDocument, id: string): Found | null {
  for (let index = 0; index < doc.sections.length; index++) {
    const section = doc.sections[index];
    if (section.id === id) return { kind: 'section', node: section, parentId: null, index };
    const deeper = findInChildren(section, id);
    if (deeper) return deeper;
  }
  return null;
}

export function collectIds(node: AnyNode, into = new Set<string>()): Set<string> {
  into.add(node.id);
  childrenOf(node).forEach((child) => collectIds(child, into));
  return into;
}

/** Aplica `fn` al nodo con ese id, conservando las referencias de todo lo que no cambia. */
function transformNode<T extends AnyNode>(node: T, id: string, fn: (node: AnyNode) => AnyNode): T {
  if (node.id === id) return fn(node) as T;
  const children = node.components;
  if (!children) return node;
  let changed = false;
  const next = children.map((child) => {
    const result = transformNode(child, id, fn);
    if (result !== child) changed = true;
    return result;
  });
  return changed ? { ...node, components: next } : node;
}

function transform(doc: EditorDocument, id: string, fn: (node: AnyNode) => AnyNode): EditorDocument {
  let changed = false;
  const sections = doc.sections.map((section) => {
    const result = transformNode(section, id, fn);
    if (result !== section) changed = true;
    return result;
  });
  return changed ? { ...doc, sections } : doc;
}

const clamp = (index: number, length: number) => Math.max(0, Math.min(index, length));

const withChild = (parent: AnyNode, child: ComponentNode, index: number): AnyNode => {
  const list = [...childrenOf(parent)];
  list.splice(clamp(index, list.length), 0, child);
  return { ...parent, components: list } as AnyNode;
};

// ───────── inserción ─────────

export function insertSection(doc: EditorDocument, index: number, section: SectionNode): EditorDocument {
  const sections = [...doc.sections];
  sections.splice(clamp(index, sections.length), 0, section);
  return { ...doc, sections };
}

/** Inserta un componente dentro de una sección o de un contenedor. */
export function insertComponent(
  doc: EditorDocument,
  parentId: string,
  index: number,
  component: ComponentNode,
): EditorDocument {
  const parent = findNode(doc, parentId);
  if (!parent || !canContain(parent.node, parent.kind)) return doc;
  return transform(doc, parentId, (node) => withChild(node, component, index));
}

// ───────── borrado y movimiento ─────────

export function removeNode(doc: EditorDocument, id: string): EditorDocument {
  const found = findNode(doc, id);
  if (!found) return doc;
  if (found.kind === 'section') return { ...doc, sections: doc.sections.filter((s) => s.id !== id) };
  return transform(doc, found.parentId, (parent) => ({
    ...parent,
    components: childrenOf(parent).filter((child) => child.id !== id),
  }) as AnyNode);
}

export function moveSection(doc: EditorDocument, id: string, index: number): EditorDocument {
  const from = doc.sections.findIndex((s) => s.id === id);
  if (from === -1) return doc;
  const to = clamp(from < index ? index - 1 : index, doc.sections.length - 1);
  if (to === from) return doc;
  const sections = [...doc.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return { ...doc, sections };
}

/**
 * Mueve un componente a otro padre (o a otra posición del mismo). `index` es la posición de
 * destino en la lista original; nunca permite meter un nodo dentro de sí mismo.
 */
export function moveComponent(
  doc: EditorDocument,
  id: string,
  targetParentId: string,
  index: number,
): EditorDocument {
  const found = findNode(doc, id);
  const target = findNode(doc, targetParentId);
  if (!found || found.kind !== 'component' || !target) return doc;
  if (!canContain(target.node, target.kind)) return doc;
  if (targetParentId === id || collectIds(found.node).has(targetParentId)) return doc;

  let position = index;
  if (found.parentId === targetParentId) {
    if (index === found.index || index === found.index + 1) return doc;
    if (found.index < index) position = index - 1;
  }
  return insertComponent(removeNode(doc, id), targetParentId, position, found.node);
}

/** Sube (-1) o baja (+1) un nodo dentro de su lista de hermanos. */
export function nudge(doc: EditorDocument, id: string, delta: -1 | 1): EditorDocument {
  const found = findNode(doc, id);
  if (!found) return doc;
  const size = found.kind === 'section' ? doc.sections.length : childrenOf(findNode(doc, found.parentId)!.node).length;
  const target = found.index + delta;
  if (target < 0 || target >= size) return doc;
  const destination = delta === 1 ? target + 1 : target;
  return found.kind === 'section'
    ? moveSection(doc, id, destination)
    : moveComponent(doc, id, found.parentId, destination);
}

// ───────── edición ─────────

export interface NodePatch {
  content?: string;
  props?: Record<string, string | number | boolean | undefined>;
  styles?: { [K in keyof Styles]?: Styles[K] | undefined };
}

const mergeDefined = <T extends object>(base: T | undefined, patch: object | undefined): T | undefined => {
  if (!patch) return base;
  const merged: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return Object.keys(merged).length > 0 ? (merged as T) : undefined;
};

/** Cambia contenido, propiedades o estilos. Un valor `undefined` quita esa clave. */
export function updateNode(doc: EditorDocument, id: string, patch: NodePatch): EditorDocument {
  return transform(doc, id, (node) => {
    const next: Record<string, unknown> = { ...node };
    if (patch.content !== undefined) next.content = patch.content;
    if (patch.props) next.props = mergeDefined<Props>(node.props, patch.props);
    if (patch.styles) next.styles = mergeDefined<Styles>(node.styles, patch.styles);
    for (const key of ['props', 'styles']) if (next[key] === undefined) delete next[key];
    return next as unknown as AnyNode;
  });
}

// ───────── duplicado ─────────

function cloneWithNewIds<T extends AnyNode>(node: T, makeId: (type: string) => string): T {
  const copy = { ...node, id: makeId(node.type) } as T;
  if (node.components) copy.components = node.components.map((child) => cloneWithNewIds(child, makeId));
  return copy;
}

/** Copia un nodo (con todos sus hijos y ids nuevos) justo después del original. */
export function duplicateNode(
  doc: EditorDocument,
  id: string,
  makeId: (type: string) => string,
): { doc: EditorDocument; newId: string | null } {
  const found = findNode(doc, id);
  if (!found) return { doc, newId: null };
  if (found.kind === 'section') {
    const copy = cloneWithNewIds(found.node, makeId);
    return { doc: insertSection(doc, found.index + 1, copy), newId: copy.id };
  }
  const copy = cloneWithNewIds(found.node, makeId);
  return { doc: insertComponent(doc, found.parentId, found.index + 1, copy), newId: copy.id };
}
