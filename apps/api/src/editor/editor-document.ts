import { BadRequestException } from '@nestjs/common';

/**
 * Formato del documento del editor (versión 1):
 * { version: 1, sections: [{ id, type, styles?, props?, components: [{ id, type, content?, styles?, props?, components? }] }] }
 *
 * Aquí solo se valida la estructura y los límites. El contenido HTML se sanitiza al publicar.
 */
export const COMPONENT_TYPES = [
  'text',
  'heading',
  'image',
  'button',
  'video',
  'icon',
  'divider',
  'spacer',
  'container',
  'gallery',
  'form',
  'map',
  'socialLinks',
] as const;

const MAX_BYTES = 1_000_000;
const MAX_SECTIONS = 200;
const MAX_NODES = 5_000;
const MAX_DEPTH = 8;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const SECTION_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,49}$/;

export interface EditorDocument {
  version: 1;
  sections: unknown[];
  [key: string]: unknown;
}

export const emptyDocument = (): EditorDocument => ({ version: 1, sections: [] });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (path: string, reason: string): never => {
  throw new BadRequestException(`Documento del editor inválido en ${path}: ${reason}`);
};

export function validateEditorDocument(value: unknown): EditorDocument {
  if (!isObject(value)) return fail('/', 'debe ser un objeto');
  if (value.version !== 1) fail('/version', 'debe ser 1');
  if (!Array.isArray(value.sections)) return fail('/sections', 'debe ser una lista');
  if (value.sections.length > MAX_SECTIONS) fail('/sections', `máximo ${MAX_SECTIONS} secciones`);
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) fail('/', 'el documento es demasiado grande');

  const ids = new Set<string>();
  let nodes = 0;

  const checkId = (node: Record<string, unknown>, path: string) => {
    if (typeof node.id !== 'string' || !ID_PATTERN.test(node.id)) fail(`${path}/id`, 'id inválido');
    if (ids.has(node.id as string)) fail(`${path}/id`, `id repetido "${node.id as string}"`);
    ids.add(node.id as string);
    if (++nodes > MAX_NODES) fail('/', `máximo ${MAX_NODES} elementos`);
  };

  const checkComponents = (list: unknown, path: string, depth: number) => {
    if (list === undefined) return;
    if (!Array.isArray(list)) return fail(path, 'debe ser una lista');
    if (depth > MAX_DEPTH) fail(path, `anidación máxima ${MAX_DEPTH}`);
    list.forEach((component, i) => {
      const here = `${path}/${i}`;
      if (!isObject(component)) return fail(here, 'debe ser un objeto');
      checkId(component, here);
      if (!(COMPONENT_TYPES as readonly unknown[]).includes(component.type)) {
        fail(`${here}/type`, `tipo no permitido "${String(component.type)}"`);
      }
      checkComponents(component.components, `${here}/components`, depth + 1);
    });
  };

  value.sections.forEach((section, i) => {
    const path = `/sections/${i}`;
    if (!isObject(section)) return fail(path, 'debe ser un objeto');
    checkId(section, path);
    if (typeof section.type !== 'string' || !SECTION_TYPE_PATTERN.test(section.type)) {
      fail(`${path}/type`, 'tipo de sección inválido');
    }
    checkComponents(section.components, `${path}/components`, 1);
  });

  return value as EditorDocument;
}
