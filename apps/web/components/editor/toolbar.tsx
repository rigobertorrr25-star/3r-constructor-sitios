'use client';

import Link from 'next/link';
import {
  ArrowLeftIcon,
  EyeIcon,
  HistoryIcon,
  MonitorIcon,
  PhoneIcon,
  PlusIcon,
  RedoIcon,
  TabletIcon,
  UndoIcon,
} from '@/components/icons';
import type { SaveStatus } from '@/lib/editor/use-autosave';
import type { Breakpoint } from '@/lib/editor/types';
import type { PageSummary } from '@/lib/types';

const BREAKPOINTS: { id: Breakpoint; label: string; icon: React.ReactNode }[] = [
  { id: 'desktop', label: 'Escritorio', icon: <MonitorIcon size={17} /> },
  { id: 'tablet', label: 'Tablet', icon: <TabletIcon size={17} /> },
  { id: 'mobile', label: 'Móvil', icon: <PhoneIcon size={17} /> },
];

const icon =
  'flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

function statusView(status: SaveStatus, message: string, savedAt: Date | null) {
  switch (status) {
    case 'saved':
      return {
        text: savedAt ? `Guardado ✓ ${savedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : 'Guardado ✓',
        dot: 'bg-[#5ee0a0]',
      };
    case 'dirty':
      return { text: 'Cambios sin guardar', dot: 'bg-[#f7cb58]' };
    case 'saving':
      return { text: 'Guardando…', dot: 'bg-primary animate-pulse' };
    case 'offline':
      return { text: 'Sin conexión: copia local guardada', dot: 'bg-[#ff9479]' };
    case 'unauthorized':
      return { text: 'Sesión expirada', dot: 'bg-destructive' };
    case 'error':
      return { text: message || 'No se pudo guardar', dot: 'bg-destructive' };
  }
}

export function Toolbar({
  siteName,
  pages,
  pageId,
  breakpoint,
  preview,
  canUndo,
  canRedo,
  status,
  message,
  savedAt,
  onUndo,
  onRedo,
  onBreakpoint,
  onPreview,
  onVersions,
  onSwitchPage,
  onNewPage,
  onSave,
  onPublish,
  publishing,
  publishedUrl,
}: {
  siteName: string;
  pages: PageSummary[];
  pageId: string;
  breakpoint: Breakpoint;
  preview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  status: SaveStatus;
  message: string;
  savedAt: Date | null;
  onUndo: () => void;
  onRedo: () => void;
  onBreakpoint: (bp: Breakpoint) => void;
  onPreview: () => void;
  onVersions: () => void;
  onSwitchPage: (id: string) => void;
  onNewPage: () => void;
  onSave: () => void;
  onPublish: () => void;
  publishing: boolean;
  publishedUrl: string | null;
}) {
  const view = statusView(status, message, savedAt);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#04080d] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/admin" aria-label="Volver al panel" className={icon}>
          <ArrowLeftIcon size={18} />
        </Link>
        <span className="hidden max-w-[160px] truncate text-[14px] font-medium text-foreground sm:block" title={siteName}>
          {siteName}
        </span>
        <span className="hidden text-white/20 sm:block">/</span>
        <label className="sr-only" htmlFor="page-select">
          Página
        </label>
        <select
          id="page-select"
          value={pageId}
          onChange={(event) => onSwitchPage(event.target.value)}
          className="max-w-[160px] rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id} className="bg-[#0a131a]">
              {page.title}
            </option>
          ))}
        </select>
        <button type="button" aria-label="Nueva página" title="Nueva página" onClick={onNewPage} className={icon}>
          <PlusIcon size={17} />
        </button>
      </div>

      <div role="group" aria-label="Tamaño de pantalla" className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
        {BREAKPOINTS.map((bp) => (
          <button
            key={bp.id}
            type="button"
            aria-label={bp.label}
            aria-pressed={breakpoint === bp.id}
            title={bp.label}
            onClick={() => onBreakpoint(bp.id)}
            className={`flex size-8 items-center justify-center rounded-full transition ${breakpoint === bp.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {bp.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button type="button" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} className={icon}>
          <UndoIcon size={17} />
        </button>
        <button type="button" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo} className={icon}>
          <RedoIcon size={17} />
        </button>
        <button type="button" aria-label="Versiones" title="Versiones" onClick={onVersions} className={icon}>
          <HistoryIcon size={17} />
        </button>
        <button
          type="button"
          aria-pressed={preview}
          onClick={onPreview}
          className={`ml-1 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition ${preview ? 'border-primary bg-primary text-primary-foreground' : 'border-white/[0.08] text-foreground hover:bg-white/[0.06]'}`}
        >
          <EyeIcon size={15} />
          {preview ? 'Salir de vista previa' : 'Vista previa'}
        </button>
        {publishedUrl ? (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 hidden rounded-full px-3 py-1.5 text-[13px] text-primary transition hover:bg-white/[0.06] lg:block"
          >
            Ver sitio ↗
          </a>
        ) : null}
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className="ml-1 rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
        >
          {publishing ? 'Publicando…' : 'Publicar'}
        </button>
        <button
          type="button"
          onClick={onSave}
          role="status"
          aria-live="polite"
          title="Guardar ahora (Ctrl+S)"
          className="ml-2 hidden items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-white/[0.06] md:flex"
        >
          <span className={`size-2 rounded-full ${view.dot}`} aria-hidden="true" />
          {view.text}
        </button>
        {status === 'unauthorized' && (
          <Link href="/login?expired=1" className="ml-1 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground">
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  );
}
