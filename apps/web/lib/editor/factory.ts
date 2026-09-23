import type { ComponentNode, ComponentType, SectionNode } from './types';

export type IdFactory = (type: string) => string;

/** Los ids cumplen el patrón que exige la API: letras, números, guion y guion bajo. */
export const newId: IdFactory = (type) => `${type}-${crypto.randomUUID().slice(0, 8)}`;

export const PALETTE: { type: ComponentType; label: string }[] = [
  { type: 'heading', label: 'Título' },
  { type: 'text', label: 'Texto' },
  { type: 'image', label: 'Imagen' },
  { type: 'button', label: 'Botón' },
  { type: 'video', label: 'Video' },
  { type: 'container', label: 'Contenedor' },
  { type: 'divider', label: 'Divisor' },
  { type: 'spacer', label: 'Espacio' },
];

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  heading: 'Título',
  text: 'Texto',
  image: 'Imagen',
  button: 'Botón',
  container: 'Contenedor',
  divider: 'Divisor',
  spacer: 'Espacio',
  video: 'Video',
  icon: 'Icono',
  gallery: 'Galería',
  form: 'Formulario',
  map: 'Mapa',
  socialLinks: 'Redes sociales',
};

export function createComponent(type: ComponentType, makeId: IdFactory = newId): ComponentNode {
  const id = makeId(type);
  switch (type) {
    case 'heading':
      return {
        id,
        type,
        content: 'Escribe un título',
        styles: { fontSize: { desktop: 40, tablet: 34, mobile: 28 }, fontWeight: 700, textAlign: 'left', color: '#111827' },
      };
    case 'text':
      return {
        id,
        type,
        content: 'Escribe aquí tu texto. Selecciónalo para editarlo en el panel de la derecha.',
        styles: { fontSize: { desktop: 17, mobile: 16 }, textAlign: 'left', color: '#4b5563' },
      };
    case 'button':
      return {
        id,
        type,
        content: 'Botón',
        props: { href: '#' },
        styles: { background: '#5b6cff', color: '#ffffff', borderRadius: 999, textAlign: 'left', fontSize: 15 },
      };
    case 'image':
      return { id, type, props: { src: '', alt: '' }, styles: { width: 100, borderRadius: 12, textAlign: 'left' } };
    case 'video':
      return { id, type, props: { src: '', poster: '' }, styles: { width: 100, borderRadius: 12, textAlign: 'left' } };
    case 'container':
      return {
        id,
        type,
        components: [],
        styles: { paddingTop: 24, paddingBottom: 24, paddingX: 24, background: '#f3f4f6', borderRadius: 16, gap: 16 },
      };
    case 'divider':
      return { id, type, styles: { height: 1, color: '#e5e7eb', marginTop: 16, marginBottom: 16 } };
    case 'spacer':
      return { id, type, styles: { height: { desktop: 48, mobile: 24 } } };
    default:
      return { id, type };
  }
}

export type SectionPreset = 'hero' | 'content' | 'cta' | 'blank';

export const SECTION_PRESETS: { id: SectionPreset; label: string; hint: string }[] = [
  { id: 'hero', label: 'Portada', hint: 'Título grande, texto y botón' },
  { id: 'content', label: 'Contenido', hint: 'Título y párrafo' },
  { id: 'cta', label: 'Llamado a la acción', hint: 'Fondo de color con botón' },
  { id: 'blank', label: 'En blanco', hint: 'Sección vacía' },
];

export function createSection(preset: SectionPreset, makeId: IdFactory = newId): SectionNode {
  const id = makeId('section');
  const heading = (text: string, extra: Partial<NonNullable<ComponentNode['styles']>> = {}) => {
    const node = createComponent('heading', makeId);
    return { ...node, content: text, styles: { ...node.styles, ...extra } };
  };
  const text = (content: string, extra: Partial<NonNullable<ComponentNode['styles']>> = {}) => {
    const node = createComponent('text', makeId);
    return { ...node, content, styles: { ...node.styles, ...extra } };
  };
  const button = (label: string, extra: Partial<NonNullable<ComponentNode['styles']>> = {}) => {
    const node = createComponent('button', makeId);
    return { ...node, content: label, styles: { ...node.styles, ...extra } };
  };

  switch (preset) {
    case 'hero':
      return {
        id,
        type: 'hero',
        styles: { background: '#f5f7ff', paddingTop: { desktop: 96, mobile: 56 }, paddingBottom: { desktop: 96, mobile: 56 }, paddingX: 24 },
        components: [
          heading('Tu título principal', { fontSize: { desktop: 56, tablet: 46, mobile: 34 }, textAlign: 'center' }),
          text('Cuéntale al visitante qué haces y por qué debería elegirte.', { fontSize: { desktop: 19, mobile: 16 }, textAlign: 'center' }),
          button('Empezar', { textAlign: 'center' }),
        ],
      };
    case 'content':
      return {
        id,
        type: 'content',
        styles: { background: '#ffffff', paddingTop: { desktop: 64, mobile: 40 }, paddingBottom: { desktop: 64, mobile: 40 }, paddingX: 24 },
        components: [
          heading('Sobre nosotros', { fontSize: { desktop: 36, tablet: 32, mobile: 26 } }),
          text('Escribe aquí una descripción de tu negocio, tus servicios o tu historia.'),
        ],
      };
    case 'cta':
      return {
        id,
        type: 'cta',
        styles: { background: '#5b6cff', paddingTop: { desktop: 72, mobile: 48 }, paddingBottom: { desktop: 72, mobile: 48 }, paddingX: 24 },
        components: [
          heading('¿Listo para empezar?', { color: '#ffffff', textAlign: 'center', fontSize: { desktop: 40, tablet: 34, mobile: 28 } }),
          text('Escríbenos y respondemos en menos de un día.', { color: '#e0e4ff', textAlign: 'center' }),
          button('Contáctanos', { textAlign: 'center', background: '#ffffff', color: '#3743c9' }),
        ],
      };
    case 'blank':
      return {
        id,
        type: 'blank',
        styles: { background: '#ffffff', paddingTop: 48, paddingBottom: 48, paddingX: 24 },
        components: [],
      };
  }
}
