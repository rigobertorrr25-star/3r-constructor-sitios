'use client';

import type { Dispatch } from 'react';
import { createComponent, createSection, PALETTE, SECTION_PRESETS } from '@/lib/editor/factory';
import type { EditorAction } from '@/lib/editor/store';
import { findNode } from '@/lib/editor/tree';
import { canContain, type ComponentType, type EditorDocument } from '@/lib/editor/types';
import { useDrag } from './drag-context';
import type { SectionPreset } from '@/lib/editor/factory';

const item =
  'flex cursor-grab items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left text-[14px] text-foreground transition hover:border-white/[0.18] hover:bg-white/[0.06] active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export function Palette({
  doc,
  selectedId,
  dispatch,
}: {
  doc: EditorDocument;
  selectedId: string | null;
  dispatch: Dispatch<EditorAction>;
}) {
  const drag = useDrag();

  /** Clic como alternativa al arrastre: agrega dentro de lo seleccionado, o al final de la última sección. */
  const addComponent = (type: ComponentType) => {
    let sectionId: string | undefined = doc.sections.at(-1)?.id;
    if (!sectionId) {
      const section = createSection('blank');
      dispatch({ type: 'add-section', section, index: 0 });
      dispatch({ type: 'add-component', node: createComponent(type), parentId: section.id, index: 0 });
      return;
    }

    let parentId = sectionId;
    const selected = selectedId ? findNode(doc, selectedId) : null;
    if (selected) {
      parentId = canContain(selected.node, selected.kind) ? selected.node.id : (selected.parentId ?? sectionId);
    }
    const parent = findNode(doc, parentId);
    const index = parent?.node.components?.length ?? 0;
    dispatch({ type: 'add-component', node: createComponent(type), parentId, index });
  };

  const addSection = (preset: SectionPreset) => {
    const selected = selectedId ? findNode(doc, selectedId) : null;
    let index = doc.sections.length;
    if (selected?.kind === 'section') index = selected.index + 1;
    else if (selected) {
      const parent = findNode(doc, selected.parentId);
      // Sube hasta la sección que contiene al nodo seleccionado.
      let cursor = parent;
      while (cursor && cursor.kind !== 'section') cursor = findNode(doc, cursor.parentId!);
      if (cursor) index = cursor.index + 1;
    }
    dispatch({ type: 'add-section', section: createSection(preset), index });
  };

  return (
    <aside aria-label="Componentes" className="flex w-[260px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-white/[0.06] bg-[#04080d] p-4">
      <section>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Secciones</h2>
        <ul className="space-y-2">
          {SECTION_PRESETS.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                draggable
                data-palette={`section:${preset.id}`}
                className={`${item} w-full flex-col items-start gap-0.5`}
                onDragStart={(event) => drag.start({ kind: 'new-section', preset: preset.id }, event)}
                onDragEnd={drag.end}
                onClick={() => addSection(preset.id)}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-[12px] text-muted-foreground">{preset.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Componentes</h2>
        <ul className="grid grid-cols-2 gap-2">
          {PALETTE.map((entry) => (
            <li key={entry.type}>
              <button
                type="button"
                draggable
                data-palette={`component:${entry.type}`}
                className={`${item} w-full`}
                onDragStart={(event) => drag.start({ kind: 'new-component', type: entry.type }, event)}
                onDragEnd={drag.end}
                onClick={() => addComponent(entry.type)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Arrastra al lienzo o haz clic para agregar dentro de lo seleccionado.
        </p>
      </section>
    </aside>
  );
}
