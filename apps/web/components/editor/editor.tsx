'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createEditorState, editorReducer } from '@/lib/editor/store';
import type { EditorDocument } from '@/lib/editor/types';
import { clearDraft, readDraft, useAutosave } from '@/lib/editor/use-autosave';
import type { PageSummary, PublicationStatus } from '@/lib/types';
import { Canvas } from './canvas';
import { DragProvider } from './drag-context';
import { Palette } from './palette';
import { Properties } from './properties';
import { Toolbar } from './toolbar';
import { VersionsPanel } from './versions-panel';

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

const looksLikeDocument = (value: unknown): value is EditorDocument =>
  typeof value === 'object' && value !== null && (value as EditorDocument).version === 1 && Array.isArray((value as EditorDocument).sections);

export function Editor({
  siteId,
  siteName,
  pages,
  pageId,
  initial,
  serverUpdatedAt,
  publication,
}: {
  siteId: string;
  siteName: string;
  pages: PageSummary[];
  pageId: string;
  initial: EditorDocument;
  serverUpdatedAt: string;
  publication: PublicationStatus;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(editorReducer, initial, createEditorState);
  const doc = state.history.present;
  const { status, message, savedAt, saveNow } = useAutosave(pageId, doc, initial);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ url: string | null; message: string; error: boolean }>({
    url: publication.published ? publication.url : null,
    message: '',
    error: false,
  });
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;

  // Si quedó una copia local más nueva que el servidor (se cerró sin conexión), se recupera.
  useEffect(() => {
    const draft = readDraft(pageId);
    if (!draft || !looksLikeDocument(draft.content)) return;
    if (draft.savedAt <= Date.parse(serverUpdatedAt)) return clearDraft(pageId);
    if (JSON.stringify(draft.content) === JSON.stringify(initial)) return clearDraft(pageId);
    dispatch({ type: 'replace', doc: draft.content });
    setRecovered(true);
  }, [pageId, serverUpdatedAt, initial]);

  // Atajos de teclado.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 's') {
        event.preventDefault();
        void saveRef.current();
      } else if (mod && key === 'z' && !isTyping(event.target)) {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'y' && !isTyping(event.target)) {
        event.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && key === 'd' && state.selectedId && !isTyping(event.target)) {
        event.preventDefault();
        dispatch({ type: 'duplicate', id: state.selectedId, suffix: crypto.randomUUID().slice(0, 6) });
      } else if ((key === 'delete' || key === 'backspace') && state.selectedId && !isTyping(event.target)) {
        event.preventDefault();
        dispatch({ type: 'remove', id: state.selectedId });
      } else if (key === 'escape' && !isTyping(event.target)) {
        dispatch({ type: 'select', id: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.selectedId]);

  /** Guarda lo pendiente antes de salir de la página; si falla, pregunta. */
  const leaveSafely = useCallback(async () => {
    const ok = await saveRef.current();
    return ok || window.confirm('No se pudo guardar. Tus cambios quedan en este navegador. ¿Salir de todos modos?');
  }, []);

  const switchPage = async (id: string) => {
    if (id === pageId || !(await leaveSafely())) return;
    router.push(`/editor/${siteId}?page=${id}`);
  };

  /** Guarda lo pendiente y publica todas las páginas del sitio en su dirección propia. */
  const publishSite = async () => {
    setPublishing(true);
    setPublished((prev) => ({ ...prev, message: '', error: false }));
    try {
      if (!(await saveRef.current())) {
        setPublished((prev) => ({ ...prev, message: 'No se pudo guardar tu trabajo, así que no se publicó.', error: true }));
        return;
      }
      const res = await fetch(`/api/bff/sites/${siteId}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const body = (await res.json().catch(() => null)) as { url?: string; pages?: number; message?: string | string[] } | null;
      if (!res.ok || !body?.url) {
        const message = Array.isArray(body?.message) ? body.message.join('. ') : (body?.message ?? 'No se pudo publicar.');
        setPublished((prev) => ({ ...prev, message, error: true }));
        return;
      }
      setPublished({ url: body.url, message: `¡Publicado! ${body.pages} ${body.pages === 1 ? 'página' : 'páginas'} en línea.`, error: false });
    } catch {
      setPublished((prev) => ({ ...prev, message: 'No se pudo conectar. Inténtalo de nuevo.', error: true }));
    } finally {
      setPublishing(false);
    }
  };

  const newPage = async () => {
    const title = window.prompt('Nombre de la nueva página');
    if (!title?.trim()) return;
    if (!(await leaveSafely())) return;
    const res = await fetch(`/api/bff/sites/${siteId}/pages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string | string[] } | null;
    if (!res.ok || !body?.id) {
      window.alert(Array.isArray(body?.message) ? body.message.join('. ') : (body?.message ?? 'No se pudo crear la página.'));
      return;
    }
    router.push(`/editor/${siteId}?page=${body.id}`);
  };

  return (
    <DragProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <Toolbar
          siteName={siteName}
          pages={pages}
          pageId={pageId}
          breakpoint={state.breakpoint}
          preview={state.preview}
          canUndo={state.history.past.length > 0}
          canRedo={state.history.future.length > 0}
          status={status}
          message={message}
          savedAt={savedAt}
          onUndo={() => dispatch({ type: 'undo' })}
          onRedo={() => dispatch({ type: 'redo' })}
          onBreakpoint={(breakpoint) => dispatch({ type: 'breakpoint', breakpoint })}
          onPreview={() => dispatch({ type: 'preview', on: !state.preview })}
          onVersions={() => setVersionsOpen(true)}
          onSwitchPage={switchPage}
          onNewPage={newPage}
          onSave={() => void saveNow()}
          onPublish={publishSite}
          publishing={publishing}
          publishedUrl={published.url}
        />

        {published.message && (
          <p
            role={published.error ? 'alert' : 'status'}
            className={`px-4 py-2 text-center text-[13px] ${published.error ? 'bg-destructive/15 text-[#ffb4b5]' : 'bg-[#5ee0a0]/15 text-[#9df0c6]'}`}
          >
            {published.message}
            {!published.error && published.url ? (
              <>
                {' '}
                <a href={published.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Ver sitio
                </a>
              </>
            ) : null}
          </p>
        )}
        {recovered && (
          <p role="status" className="bg-[#f7cb58]/15 px-4 py-2 text-center text-[13px] text-[#f7cb58]">
            Recuperamos cambios que no se habían guardado. Se sincronizarán automáticamente.
          </p>
        )}
        <p className="bg-white/[0.04] px-4 py-2 text-center text-[12px] text-muted-foreground lg:hidden">
          El editor funciona mejor en una pantalla grande.
        </p>

        <div className="flex min-h-0 flex-1">
          {!state.preview && <Palette doc={doc} selectedId={state.selectedId} dispatch={dispatch} />}
          <Canvas doc={doc} selectedId={state.selectedId} breakpoint={state.breakpoint} preview={state.preview} dispatch={dispatch} />
          {!state.preview && <Properties doc={doc} selectedId={state.selectedId} breakpoint={state.breakpoint} dispatch={dispatch} />}
        </div>

        {versionsOpen && (
          <VersionsPanel
            pageId={pageId}
            onClose={() => setVersionsOpen(false)}
            flush={() => saveRef.current()}
            onRestored={() => {
              clearDraft(pageId);
              setVersionsOpen(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </DragProvider>
  );
}
