// Modelo del documento del editor (versión 1). Debe coincidir con la validación de la API
// (apps/api/src/editor/editor-document.ts).

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Un valor único o uno por tamaño de pantalla. Móvil hereda de tablet y esta de escritorio. */
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

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
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export interface Styles {
  fontSize?: Responsive<number>;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  background?: string;
  paddingTop?: Responsive<number>;
  paddingBottom?: Responsive<number>;
  paddingX?: Responsive<number>;
  marginTop?: Responsive<number>;
  marginBottom?: Responsive<number>;
  borderRadius?: number;
  /** Porcentaje del ancho disponible (imágenes). */
  width?: Responsive<number>;
  /** Píxeles (separador, línea divisoria). */
  height?: Responsive<number>;
  gap?: number;
}

export type Props = Record<string, string | number | boolean>;

export interface ComponentNode {
  id: string;
  type: ComponentType;
  content?: string;
  props?: Props;
  styles?: Styles;
  /** Solo los contenedores tienen hijos. */
  components?: ComponentNode[];
}

export interface SectionNode {
  id: string;
  type: string;
  /** Las secciones no tienen texto propio; el campo existe solo para leer `node.content` sin distinguir el tipo. */
  content?: undefined;
  props?: Props;
  styles?: Styles;
  components: ComponentNode[];
}

export interface EditorDocument {
  version: 1;
  sections: SectionNode[];
}

export type AnyNode = SectionNode | ComponentNode;

/** Solo las secciones y los contenedores pueden tener hijos. */
export const canContain = (node: AnyNode, kind: 'section' | 'component') =>
  kind === 'section' || node.type === 'container';

export const emptyDocument = (): EditorDocument => ({ version: 1, sections: [] });
