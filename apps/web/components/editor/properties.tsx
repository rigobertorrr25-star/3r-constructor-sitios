'use client';

import type { Dispatch } from 'react';
import { COMPONENT_LABELS } from '@/lib/editor/factory';
import { resolve, setAt } from '@/lib/editor/responsive';
import type { EditorAction } from '@/lib/editor/store';
import { findNode, type NodePatch } from '@/lib/editor/tree';
import type { Breakpoint, ComponentNode, EditorDocument, Responsive, Styles } from '@/lib/editor/types';
import { ACCEPT_IMAGE, ACCEPT_VIDEO } from '@/lib/upload';
import { AlignControl, ColorControl, Group, NumberControl, SelectControl, TextAreaControl, TextControl, UploadControl } from './controls';

const BP_LABEL: Record<Breakpoint, string> = { desktop: 'escritorio', tablet: 'tablet', mobile: 'móvil' };

type ResponsiveKey = 'fontSize' | 'paddingTop' | 'paddingBottom' | 'paddingX' | 'marginTop' | 'marginBottom' | 'width' | 'height' | 'columns';
type PlainKey = 'color' | 'background' | 'borderRadius' | 'gap' | 'fontWeight' | 'textAlign';

const WEIGHTS = [
  { value: 400, label: 'Normal' },
  { value: 500, label: 'Medio' },
  { value: 600, label: 'Seminegrita' },
  { value: 700, label: 'Negrita' },
];

export function Properties({
  doc,
  selectedId,
  breakpoint,
  dispatch,
}: {
  doc: EditorDocument;
  selectedId: string | null;
  breakpoint: Breakpoint;
  dispatch: Dispatch<EditorAction>;
}) {
  const found = selectedId ? findNode(doc, selectedId) : null;

  if (!found) {
    return (
      <aside aria-label="Propiedades" className="w-[300px] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#04080d] p-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Propiedades</h2>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
          Selecciona una sección o un componente en el lienzo para editarlo.
        </p>
      </aside>
    );
  }

  const node = found.node;
  const id = node.id;
  const styles: Styles = node.styles ?? {};
  const type = found.kind === 'section' ? 'section' : (node as ComponentNode).type;
  const title = found.kind === 'section' ? 'Sección' : COMPONENT_LABELS[(node as ComponentNode).type];

  const patch = (change: NodePatch, group: string) => dispatch({ type: 'update', id, patch: change, group: `${id}:${group}` });
  const setStyle = (key: keyof Styles, value: Styles[keyof Styles]) => patch({ styles: { [key]: value } }, key);

  const plain = (key: PlainKey) => ({
    value: styles[key] as never,
    onChange: (value: unknown) => setStyle(key, value as never),
  });

  const responsive = (key: ResponsiveKey) => {
    const current = styles[key] as Responsive<number> | undefined;
    const overridden = breakpoint !== 'desktop' && typeof current === 'object' && current !== null && breakpoint in current;
    return {
      value: resolve(current, breakpoint),
      hint: breakpoint === 'desktop' ? undefined : `(${BP_LABEL[breakpoint]})`,
      onChange: (value: number | undefined) => setStyle(key, setAt(current, breakpoint, value)),
      onReset: overridden ? () => setStyle(key, setAt(current, breakpoint, undefined)) : undefined,
    };
  };

  const prop = (key: string) => String(node.props?.[key] ?? '');
  const setProp = (key: string, value: string) => patch({ props: { [key]: value === '' ? undefined : value } }, `props:${key}`);

  const content = (
    <Group title="Contenido">
      <TextAreaControl name="Texto" value={node.content ?? ''} onChange={(value) => patch({ content: value }, 'content')} />
    </Group>
  );

  const typography = (
    <Group title="Tipografía">
      <NumberControl name="Tamaño" unit="px" min={8} max={200} {...responsive('fontSize')} />
      <SelectControl name="Grosor" value={styles.fontWeight} options={WEIGHTS} onChange={(value) => setStyle('fontWeight', value)} />
      <AlignControl value={styles.textAlign} onChange={(value) => setStyle('textAlign', value)} />
      <ColorControl name="Color" {...plain('color')} fallback="#111827" />
    </Group>
  );

  const margins = (
    <Group title="Espaciado">
      <NumberControl name="Margen superior" unit="px" {...responsive('marginTop')} />
      <NumberControl name="Margen inferior" unit="px" {...responsive('marginBottom')} />
    </Group>
  );

  let body: React.ReactNode;
  switch (type) {
    case 'section':
      body = (
        <>
          <Group title="Fondo">
            <ColorControl name="Color de fondo" {...plain('background')} fallback="#ffffff" />
          </Group>
          <Group title="Espaciado">
            <NumberControl name="Relleno superior" unit="px" {...responsive('paddingTop')} />
            <NumberControl name="Relleno inferior" unit="px" {...responsive('paddingBottom')} />
            <NumberControl name="Relleno lateral" unit="px" {...responsive('paddingX')} />
          </Group>
        </>
      );
      break;
    case 'heading':
    case 'text':
      body = (
        <>
          {content}
          {typography}
          {margins}
        </>
      );
      break;
    case 'button':
      body = (
        <>
          <Group title="Contenido">
            <TextControl name="Texto del botón" value={node.content ?? ''} onChange={(value) => patch({ content: value }, 'content')} />
            <TextControl name="Enlace" value={prop('href')} placeholder="https://… o #seccion" onChange={(value) => setProp('href', value)} />
          </Group>
          <Group title="Estilo">
            <ColorControl name="Fondo" {...plain('background')} fallback="#5b6cff" />
            <ColorControl name="Color del texto" {...plain('color')} fallback="#ffffff" />
            <NumberControl name="Redondeo" unit="px" max={999} {...plain('borderRadius')} />
            <NumberControl name="Tamaño de letra" unit="px" min={8} max={80} {...responsive('fontSize')} />
            <AlignControl value={styles.textAlign} onChange={(value) => setStyle('textAlign', value)} />
          </Group>
          {margins}
        </>
      );
      break;
    case 'image':
      body = (
        <>
          <Group title="Imagen">
            <UploadControl accept={ACCEPT_IMAGE} onUploaded={(url) => setProp('src', url)} />
            <TextControl name="Dirección (URL)" value={prop('src')} placeholder="https://…" onChange={(value) => setProp('src', value)} />
            <TextControl name="Texto alternativo" value={prop('alt')} placeholder="Describe la imagen" onChange={(value) => setProp('alt', value)} />
          </Group>
          <Group title="Estilo">
            <NumberControl name="Ancho" unit="%" min={5} max={100} {...responsive('width')} />
            <NumberControl name="Redondeo" unit="px" max={200} {...plain('borderRadius')} />
            <AlignControl value={styles.textAlign} onChange={(value) => setStyle('textAlign', value)} />
          </Group>
          {margins}
        </>
      );
      break;
    case 'video':
      body = (
        <>
          <Group title="Video">
            <UploadControl accept={ACCEPT_VIDEO} onUploaded={(url) => setProp('src', url)} />
            <TextControl name="Dirección (URL)" value={prop('src')} placeholder="https://…" onChange={(value) => setProp('src', value)} />
          </Group>
          <Group title="Portada (opcional)">
            <UploadControl accept={ACCEPT_IMAGE} onUploaded={(url) => setProp('poster', url)} />
            <TextControl name="Imagen de portada (URL)" value={prop('poster')} placeholder="https://…" onChange={(value) => setProp('poster', value)} />
          </Group>
          <Group title="Estilo">
            <NumberControl name="Ancho" unit="%" min={5} max={100} {...responsive('width')} />
            <NumberControl name="Redondeo" unit="px" max={200} {...plain('borderRadius')} />
            <AlignControl value={styles.textAlign} onChange={(value) => setStyle('textAlign', value)} />
          </Group>
          {margins}
        </>
      );
      break;
    case 'map':
      body = (
        <>
          <Group title="Mapa">
            <TextControl
              name="Dirección"
              value={prop('address')}
              placeholder="Calle 10 # 5-20, Bogotá"
              onChange={(value) => setProp('address', value)}
            />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Escribe la dirección tal como la buscarías en Google Maps. No hace falta cuenta ni coordenadas.
            </p>
          </Group>
          <Group title="Estilo">
            <NumberControl name="Alto" unit="px" min={120} max={800} {...responsive('height')} />
            <NumberControl name="Redondeo" unit="px" max={200} {...plain('borderRadius')} />
          </Group>
          {margins}
        </>
      );
      break;
    case 'divider':
      body = (
        <>
          <Group title="Línea">
            <ColorControl name="Color" {...plain('color')} fallback="#e5e7eb" />
            <NumberControl name="Grosor" unit="px" min={1} max={40} {...responsive('height')} />
          </Group>
          {margins}
        </>
      );
      break;
    case 'spacer':
      body = (
        <Group title="Espacio">
          <NumberControl name="Alto" unit="px" max={600} {...responsive('height')} />
        </Group>
      );
      break;
    case 'container':
      body = (
        <>
          <Group title="Columnas">
            <NumberControl name="Cuántas lado a lado" min={1} max={4} {...responsive('columns')} />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              2 o más columnas, con varias imágenes adentro, arman una galería de fotos. Revisa cómo se ve en
              móvil (arriba, en el selector de pantalla) — puede que ahí convenga poner 1.
            </p>
          </Group>
          <Group title="Fondo">
            <ColorControl name="Color de fondo" {...plain('background')} fallback="#f3f4f6" />
            <NumberControl name="Redondeo" unit="px" max={200} {...plain('borderRadius')} />
          </Group>
          <Group title="Espaciado">
            <NumberControl name="Relleno superior" unit="px" {...responsive('paddingTop')} />
            <NumberControl name="Relleno inferior" unit="px" {...responsive('paddingBottom')} />
            <NumberControl name="Relleno lateral" unit="px" {...responsive('paddingX')} />
            <NumberControl name="Separación interna" unit="px" max={200} {...plain('gap')} />
          </Group>
          {margins}
        </>
      );
      break;
    default:
      body = <p className="text-[14px] text-muted-foreground">Este componente aún no tiene opciones.</p>;
  }

  return (
    <aside aria-label="Propiedades" className="w-[300px] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#04080d] p-5">
      <div className="mb-4">
        <h2 className="font-display text-[18px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Los tamaños y espacios se guardan para <strong className="font-semibold text-foreground">{BP_LABEL[breakpoint]}</strong>.
        </p>
      </div>
      {body}
    </aside>
  );
}
