'use client';

import { useCallback, useEffect, useState } from 'react';
import { XIcon } from '@/components/icons';
import type { VersionSummary } from '@/lib/types';

const dateTime = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

export function VersionsPanel({
  pageId,
  onClose,
  flush,
  onRestored,
}: {
  pageId: string;
  onClose: () => void;
  /** Guarda lo pendiente antes de crear un punto de restauración. */
  flush: () => Promise<boolean>;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bff/pages/${pageId}/versions`);
      if (!res.ok) throw new Error();
      setVersions((await res.json()) as VersionSummary[]);
    } catch {
      setError('No se pudo cargar el historial.');
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const request = async (path: string) => {
    const res = await fetch(`/api/bff/pages/${pageId}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw new Error();
  };

  const saveVersion = async () => {
    setBusy(true);
    setError('');
    try {
      if (!(await flush())) throw new Error('No se pudo guardar tu trabajo antes de crear la versión.');
      await request('/versions');
      await load();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo crear la versión.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (version: VersionSummary) => {
    if (!window.confirm(`¿Restaurar la versión ${version.versionNumber}? Tu trabajo actual queda guardado como una versión más reciente.`)) return;
    setBusy(true);
    setError('');
    try {
      if (!(await flush())) throw new Error('No se pudo guardar tu trabajo antes de restaurar.');
      // Guarda lo actual como versión propia para poder volver, y luego restaura la elegida.
      await request('/versions');
      await request(`/versions/${version.id}/restore`);
      onRestored();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo restaurar la versión.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Versiones de la página"
        className="flex h-full w-full max-w-[380px] flex-col border-l border-white/[0.08] bg-[#04080d] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-display text-[18px] font-semibold text-foreground">Versiones</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/[0.08] hover:text-foreground">
            <XIcon size={17} />
          </button>
        </div>

        <div className="space-y-3 border-b border-white/[0.06] px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={saveVersion}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            Guardar versión ahora
          </button>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            El guardado automático actualiza tu borrador. Crea una versión cuando quieras un punto al que volver.
          </p>
          {error ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-[#ffb4b5]">
              {error}
            </p>
          ) : null}
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {versions === null && !error ? <li className="text-[14px] text-muted-foreground">Cargando…</li> : null}
          {versions?.map((version, i) => (
            <li key={version.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-[14px] font-medium text-foreground">
                  Versión {version.versionNumber}
                  {i === 0 ? <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">Actual</span> : null}
                </p>
                <p className="text-[12px] text-muted-foreground">{dateTime.format(new Date(version.createdAt))}</p>
              </div>
              {i > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => restore(version)}
                  className="rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[13px] text-foreground transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Restaurar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
