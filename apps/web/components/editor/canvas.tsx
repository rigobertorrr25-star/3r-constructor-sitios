'use client';

import { Fragment, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon, CopyIcon, GripIcon, TrashIcon } from '@/components/icons';
import { safeImageUrl, safeUrl, toCss } from '@/lib/editor/css';
import { COMPONENT_LABELS, createComponent, createSection } from '@/lib/editor/factory';
import { resolve } from '@/lib/editor/responsive';
import type { EditorAction } from '@/lib/editor/store';
import { collectIds, findNode } from '@/lib/editor/tree';
import type { AnyNode, Breakpoint, ComponentNode, EditorDocument, SectionNode } from '@/lib/editor/types';
import { useDrag } from './drag-context';

const FRAME_WIDTH: Record<Breakpoint, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

interface Common {
  doc: EditorDocument;
  bp: Breakpoint;
  selectedId: string | null;
  edit: boolean;
  dispatch: Dispatch<EditorAction>;
}

// ───────── zonas de suelta ─────────

function DropZone({
  common,
  kind,
  parentId,
  index,
  empty,
}: {
  common: Common;
  kind: 'section' | 'component';
  parentId: string | null;
  index: number;
  empty?: boolean;
}) {
  const drag = useDrag();
  const [over, setOver] = useState(false);
  const { doc, dispatch } = common;

  const accepts = () => {
    const payload = drag.payload.current;
    if (!payload) return false;
    if (kind === 'section') return payload.kind === 'new-section' || payload.kind === 'move-section';
    if (payload.kind === 'new-component') return true;
    if (payload.kind === 'move-component') {
      const found = findNode(doc, payload.id);
      return !!found && !collectIds(found.node).has(parentId ?? '');
    }
    return false;
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(false);
    const payload = drag.payload.current;
    if (!payload || !accepts()) return;
    drag.end();

    if (kind === 'section') {
      if (payload.kind === 'new-section') dispatch({ type: 'add-section', section: createSection(payload.preset), index });
      if (payload.kind === 'move-section') dispatch({ type: 'move-section', id: payload.id, index });
    } else if (parentId) {
      if (payload.kind === 'new-component') {
        dispatch({ type: 'add-component', node: createComponent(payload.type), parentId, index });
      }
      if (payload.kind === 'move-component') dispatch({ type: 'move', id: payload.id, parentId, index });
    }
  };

  if (!common.edit) return null;

  const handlers = {
    onDragOver: (event: React.DragEvent) => {
      if (!accepts()) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = drag.payload.current?.kind.startsWith('new') ? 'copy' : 'move';
      if (!over) setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  if (empty) {
    return (
      <div
        data-dropzone={`${kind}:${parentId ?? 'root'}:${index}`}
        {...handlers}
        className={`m-1 flex min-h-[64px] items-center justify-center rounded-lg border border-dashed text-[13px] transition ${
          over ? 'border-[#5b6cff] bg-[#5b6cff]/10 text-[#5b6cff]' : 'border-black/20 text-black/40'
        }`}
      >
        {kind === 'section' ? 'Arrastra una sección aquí' : 'Suelta un componente aquí'}
      </div>
    );
  }

  return (
    <div className="relative z-10 h-0">
      <div
        data-dropzone={`${kind}:${parentId ?? 'root'}:${index}`}
        {...handlers}
        className={`absolute inset-x-0 -top-3 h-6 ${drag.dragging ? '' : 'pointer-events-none'}`}
      >
        <div className={`absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-full transition-all ${over ? 'h-1 bg-[#5b6cff]' : drag.dragging ? 'h-px bg-[#5b6cff]/30' : 'h-0'}`} />
      </div>
    </div>
  );
}

// ───────── envoltorio de selección ─────────

function NodeShell({
  common,
  node,
  kind,
  index,
  count,
  children,
}: {
  common: Common;
  node: AnyNode;
  kind: 'section' | 'component';
  index: number;
  count: number;
  children: ReactNode;
}) {
  const drag = useDrag();
  const ref = useRef<HTMLDivElement>(null);
  const { selectedId, edit, dispatch } = common;
  if (!edit) return <>{children}</>;

  const selected = selectedId === node.id;
  const label = kind === 'section' ? 'Sección' : COMPONENT_LABELS[(node as ComponentNode).type];
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };
  const tool =
    'flex size-6 items-center justify-center rounded text-white/90 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white';

  return (
    <div
      ref={ref}
      data-node-id={node.id}
      data-node-kind={kind}
      draggable={kind === 'component'}
      onDragStart={(event) => {
        if (kind !== 'component') return;
        event.stopPropagation();
        drag.start({ kind: 'move-component', id: node.id }, event);
      }}
      onDragEnd={drag.end}
      onClick={(event) => {
        event.stopPropagation();
        dispatch({ type: 'select', id: node.id });
      }}
      className={`relative ${selected ? 'outline outline-2 -outline-offset-2 outline-[#5b6cff]' : 'hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-[#5b6cff]/40'}`}
    >
      {children}
      {selected && (
        <div
          className="absolute -top-7 right-0 z-30 flex items-center gap-0.5 rounded-t-md bg-[#5b6cff] px-1 py-0.5 text-[11px] text-white shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {kind === 'section' && (
            <span
              draggable
              onDragStart={(event) => {
                event.stopPropagation();
                if (ref.current) event.dataTransfer.setDragImage(ref.current, 24, 24);
                drag.start({ kind: 'move-section', id: node.id }, event);
              }}
              onDragEnd={drag.end}
              title="Arrastra para mover la sección"
              className="flex size-6 cursor-grab items-center justify-center rounded hover:bg-white/20"
            >
              <GripIcon size={14} />
            </span>
          )}
          <span className="px-1.5 font-medium">{label}</span>
          <button type="button" aria-label="Subir" disabled={index === 0} className={`${tool} disabled:opacity-30`} onClick={stop(() => dispatch({ type: 'nudge', id: node.id, delta: -1 }))}>
            <ChevronUpIcon size={14} />
          </button>
          <button type="button" aria-label="Bajar" disabled={index === count - 1} className={`${tool} disabled:opacity-30`} onClick={stop(() => dispatch({ type: 'nudge', id: node.id, delta: 1 }))}>
            <ChevronDownIcon size={14} />
          </button>
          <button type="button" aria-label="Duplicar" className={tool} onClick={stop(() => dispatch({ type: 'duplicate', id: node.id, suffix: crypto.randomUUID().slice(0, 6) }))}>
            <CopyIcon size={14} />
          </button>
          <button type="button" aria-label="Eliminar" className={tool} onClick={stop(() => dispatch({ type: 'remove', id: node.id }))}>
            <TrashIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ───────── componentes ─────────

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-dashed border-black/25 bg-black/[0.03] px-4 text-center text-[13px] text-black/50">
      {children}
    </div>
  );
}

function Leaf({ node, bp }: { node: ComponentNode; bp: Breakpoint }) {
  const css = toCss(node.styles, bp);
  switch (node.type) {
    case 'heading':
      return (
        <h2 className="whitespace-pre-wrap break-words" style={{ margin: 0, ...css, lineHeight: 1.15 }}>
          {node.content}
        </h2>
      );
    case 'text':
      return (
        <p className="whitespace-pre-wrap break-words" style={{ margin: 0, ...css, lineHeight: 1.6 }}>
          {node.content}
        </p>
      );
    case 'button': {
      const href = safeUrl(String(node.props?.href ?? ''));
      return (
        <div style={{ textAlign: node.styles?.textAlign, marginTop: css.marginTop, marginBottom: css.marginBottom }}>
          <a
            href={href || undefined}
            onClick={(event) => event.preventDefault()}
            className="inline-block cursor-pointer"
            style={{
              background: node.styles?.background ?? '#5b6cff',
              color: node.styles?.color ?? '#ffffff',
              borderRadius: node.styles?.borderRadius ?? 999,
              fontSize: css.fontSize ?? 15,
              fontWeight: node.styles?.fontWeight ?? 600,
              padding: '12px 24px',
              textDecoration: 'none',
            }}
          >
            {node.content || 'Botón'}
          </a>
        </div>
      );
    }
    case 'image': {
      const src = safeImageUrl(String(node.props?.src ?? ''));
      const width = resolve(node.styles?.width, bp) ?? 100;
      return (
        <div style={{ textAlign: node.styles?.textAlign, marginTop: css.marginTop, marginBottom: css.marginBottom }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={String(node.props?.alt ?? '')}
              draggable={false}
              style={{ width: `${width}%`, maxWidth: '100%', height: 'auto', borderRadius: node.styles?.borderRadius, display: 'inline-block' }}
            />
          ) : (
            <div style={{ width: `${width}%`, display: 'inline-block' }}>
              <Placeholder>Imagen: pega una dirección (URL) en el panel de la derecha</Placeholder>
            </div>
          )}
        </div>
      );
    }
    case 'video': {
      const src = safeImageUrl(String(node.props?.src ?? ''));
      const poster = safeImageUrl(String(node.props?.poster ?? ''));
      const width = resolve(node.styles?.width, bp) ?? 100;
      return (
        <div style={{ textAlign: node.styles?.textAlign, marginTop: css.marginTop, marginBottom: css.marginBottom }}>
          {src ? (
            <video
              src={src}
              poster={poster || undefined}
              controls
              style={{ width: `${width}%`, maxWidth: '100%', borderRadius: node.styles?.borderRadius, display: 'inline-block', background: '#000' }}
            />
          ) : (
            <div style={{ width: `${width}%`, display: 'inline-block' }}>
              <Placeholder>Video: pega una dirección (URL) en el panel de la derecha</Placeholder>
            </div>
          )}
        </div>
      );
    }
    case 'map': {
      const address = String(node.props?.address ?? '').trim();
      const height = resolve(node.styles?.height, bp) ?? 320;
      return address ? (
        <iframe
          title="Mapa"
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
          style={{ width: '100%', height, border: 0, borderRadius: node.styles?.borderRadius, display: 'block' }}
          loading="lazy"
        />
      ) : (
        <div style={{ width: '100%', height }}>
          <Placeholder>Mapa: escribe la dirección en el panel de la derecha</Placeholder>
        </div>
      );
    }
    case 'form': {
      const title = String(node.props?.title ?? '').trim();
      const field = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 14, color: '#374151' };
      const input = { font: 'inherit', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111827' };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {title ? <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'none' }}>
            <label style={field}>
              <span>Nombre</span>
              <input style={input} disabled />
            </label>
            <label style={field}>
              <span>Correo</span>
              <input style={input} disabled />
            </label>
            <label style={field}>
              <span>Teléfono / WhatsApp (opcional)</span>
              <input style={input} disabled />
            </label>
            <label style={field}>
              <span>Mensaje</span>
              <textarea style={{ ...input, resize: 'vertical' }} rows={4} disabled />
            </label>
            <button
              type="button"
              style={{ alignSelf: 'flex-start', padding: '12px 24px', border: 0, borderRadius: 999, background: '#5b6cff', color: '#fff', fontSize: 15, fontWeight: 600 }}
            >
              Enviar mensaje
            </button>
          </div>
        </div>
      );
    }
    case 'divider':
      return (
        <div
          role="separator"
          style={{
            height: resolve(node.styles?.height, bp) ?? 1,
            background: node.styles?.color ?? '#e5e7eb',
            marginTop: css.marginTop,
            marginBottom: css.marginBottom,
          }}
        />
      );
    case 'spacer':
      return <div aria-hidden style={{ height: resolve(node.styles?.height, bp) ?? 32 }} />;
    default:
      return <Placeholder>{COMPONENT_LABELS[node.type]} (próximamente)</Placeholder>;
  }
}

function ComponentView({
  common,
  node,
  parentId,
  index,
  count,
}: {
  common: Common;
  node: ComponentNode;
  parentId: string;
  index: number;
  count: number;
}) {
  const columns = Math.max(1, Math.min(4, resolve(node.styles?.columns, common.bp) ?? 1));
  const inner =
    node.type === 'container' ? (
      <div
        style={{
          ...toCss(node.styles, common.bp),
          display: columns > 1 ? 'grid' : 'flex',
          flexDirection: columns > 1 ? undefined : 'column',
          gridTemplateColumns: columns > 1 ? `repeat(${columns}, 1fr)` : undefined,
          gap: node.styles?.gap ?? 0,
        }}
      >
        <Children common={common} parentId={node.id} kind="component" items={node.components ?? []} />
      </div>
    ) : (
      <Leaf node={node} bp={common.bp} />
    );

  return (
    <NodeShell common={common} node={node} kind="component" index={index} count={count}>
      {inner}
    </NodeShell>
  );
}

function Children({
  common,
  parentId,
  kind,
  items,
}: {
  common: Common;
  parentId: string;
  kind: 'component';
  items: ComponentNode[];
}) {
  if (items.length === 0) {
    return common.edit ? <DropZone common={common} kind={kind} parentId={parentId} index={0} empty /> : null;
  }
  return (
    <>
      <DropZone common={common} kind={kind} parentId={parentId} index={0} />
      {items.map((child, i) => (
        <Fragment key={child.id}>
          <ComponentView common={common} node={child} parentId={parentId} index={i} count={items.length} />
          <DropZone common={common} kind={kind} parentId={parentId} index={i + 1} />
        </Fragment>
      ))}
    </>
  );
}

function SectionView({ common, section, index, count }: { common: Common; section: SectionNode; index: number; count: number }) {
  return (
    <NodeShell common={common} node={section} kind="section" index={index} count={count}>
      <section style={toCss(section.styles, common.bp)}>
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
          <Children common={common} parentId={section.id} kind="component" items={section.components} />
        </div>
      </section>
    </NodeShell>
  );
}

// ───────── lienzo ─────────

export function Canvas({
  doc,
  selectedId,
  breakpoint,
  preview,
  dispatch,
}: {
  doc: EditorDocument;
  selectedId: string | null;
  breakpoint: Breakpoint;
  preview: boolean;
  dispatch: Dispatch<EditorAction>;
}) {
  const common: Common = { doc, bp: breakpoint, selectedId, edit: !preview, dispatch };

  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-[#0a0d14] p-4 sm:p-8"
      onClick={() => dispatch({ type: 'select', id: null })}
    >
      <div
        data-testid="canvas"
        className="mx-auto min-h-[480px] bg-white text-[#111827] shadow-[0_24px_80px_-24px_#000] transition-[width] duration-300"
        style={{ width: FRAME_WIDTH[breakpoint], maxWidth: '100%', fontFamily: 'var(--font-sans)' }}
      >
        {doc.sections.length === 0 ? (
          common.edit ? (
            <DropZone common={common} kind="section" parentId={null} index={0} empty />
          ) : (
            <p className="p-16 text-center text-black/40">Esta página está vacía.</p>
          )
        ) : (
          <>
            <DropZone common={common} kind="section" parentId={null} index={0} />
            {doc.sections.map((section, i) => (
              <Fragment key={section.id}>
                <SectionView common={common} section={section} index={i} count={doc.sections.length} />
                <DropZone common={common} kind="section" parentId={null} index={i + 1} />
              </Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
