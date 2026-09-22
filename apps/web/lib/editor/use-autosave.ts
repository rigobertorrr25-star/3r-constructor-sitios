'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorDocument } from './types';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'offline' | 'unauthorized';

const DEBOUNCE_MS = 1500;
const OFFLINE_RETRY_MS = 10_000;

const draftKey = (pageId: string) => `3r:draft:${pageId}`;

interface Draft {
  content: EditorDocument;
  savedAt: number;
}

// localStorage puede fallar o no existir (modo privado, cuota): el editor debe seguir funcionando.
export function readDraft(pageId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(pageId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(pageId: string, content: EditorDocument) {
  try {
    window.localStorage.setItem(draftKey(pageId), JSON.stringify({ content, savedAt: Date.now() }));
  } catch {
    /* sin almacenamiento local: solo se pierde la copia de respaldo */
  }
}

export function clearDraft(pageId: string) {
  try {
    window.localStorage.removeItem(draftKey(pageId));
  } catch {
    /* nada que limpiar */
  }
}

/**
 * Guarda el documento 1.5 s después del último cambio. Sin conexión conserva una copia local
 * y reintenta al volver la red; si cierras la pestaña con cambios pendientes, avisa.
 */
export function useAutosave(pageId: string, doc: EditorDocument, baseline: EditorDocument) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [message, setMessage] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const lastSaved = useRef(baseline);
  const current = useRef(doc);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef(false);
  current.current = doc;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const save = useCallback(async (): Promise<boolean> => {
    clearTimer();
    if (inflight.current) return false;
    const snapshot = current.current;
    if (snapshot === lastSaved.current) {
      setStatus('saved');
      return true;
    }

    inflight.current = true;
    failed.current = false;
    setStatus('saving');
    let ok = false;
    try {
      const res = await fetch(`/api/bff/pages/${pageId}/autosave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: snapshot }),
      });
      if (res.ok) {
        ok = true;
        lastSaved.current = snapshot;
        setSavedAt(new Date());
        if (current.current === snapshot) clearDraft(pageId);
      } else if (res.status === 401) {
        failed.current = true;
        setStatus('unauthorized');
      } else {
        failed.current = true;
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        setMessage(Array.isArray(body?.message) ? body.message.join('. ') : (body?.message ?? 'No se pudo guardar'));
        setStatus('error');
      }
    } catch {
      failed.current = true;
      setStatus('offline');
      timer.current = setTimeout(() => void save(), OFFLINE_RETRY_MS);
    } finally {
      inflight.current = false;
    }

    // Hubo más cambios mientras se guardaba: programa otro guardado.
    if (ok && current.current !== lastSaved.current) {
      setStatus('dirty');
      timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
    } else if (ok) {
      setStatus('saved');
    }
    return ok;
  }, [pageId]);

  // Cada cambio: copia local inmediata y guardado con retraso.
  useEffect(() => {
    if (doc === lastSaved.current) return;
    writeDraft(pageId, doc);
    if (!inflight.current) setStatus((prev) => (prev === 'offline' || prev === 'unauthorized' ? prev : 'dirty'));
    clearTimer();
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
    return clearTimer;
  }, [doc, pageId, save]);

  // Al volver la conexión, sincroniza enseguida.
  useEffect(() => {
    const onOnline = () => {
      if (current.current !== lastSaved.current) void save();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [save]);

  // Aviso al cerrar con cambios sin guardar.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (current.current !== lastSaved.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { status, message, savedAt, saveNow: save };
}
