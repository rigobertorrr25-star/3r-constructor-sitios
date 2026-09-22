'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { SectionPreset } from '@/lib/editor/factory';
import type { ComponentType } from '@/lib/editor/types';

/** Qué se está arrastrando. El navegador no deja leer los datos del arrastre hasta soltar, así que se guarda aquí. */
export type DragPayload =
  | { kind: 'new-component'; type: ComponentType }
  | { kind: 'new-section'; preset: SectionPreset }
  | { kind: 'move-component'; id: string }
  | { kind: 'move-section'; id: string };

interface DragContextValue {
  payload: RefObject<DragPayload | null>;
  dragging: boolean;
  start: (payload: DragPayload, event: React.DragEvent) => void;
  end: () => void;
}

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { children: ReactNode }) {
  const payload = useRef<DragPayload | null>(null);
  const [dragging, setDragging] = useState(false);

  const start = useCallback((next: DragPayload, event: React.DragEvent) => {
    payload.current = next;
    event.dataTransfer.effectAllowed = next.kind.startsWith('new') ? 'copy' : 'move';
    // Firefox exige datos en el arrastre para iniciarlo.
    event.dataTransfer.setData('text/plain', next.kind);
    setDragging(true);
  }, []);

  const end = useCallback(() => {
    payload.current = null;
    setDragging(false);
  }, []);

  const value = useMemo(() => ({ payload, dragging, start, end }), [dragging, start, end]);
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDrag() {
  const context = useContext(DragContext);
  if (!context) throw new Error('useDrag debe usarse dentro de DragProvider');
  return context;
}
