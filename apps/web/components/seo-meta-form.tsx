'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveSeoMetaAction } from '@/app/empresa/seo-actions';
import type { SeoPage } from '@/lib/seo';
import { inputClass } from './field';

const Counter = ({ n, min, max }: { n: number; min: number; max: number }) => (
  <span className={`text-[12px] tabular-nums ${n && (n < min || n > max) ? 'text-[#ffd27a]' : 'text-muted-foreground'}`}>
    {n} letras · ideal {min} a {max}
  </span>
);

/** Título y descripción para Google, con la vista de cómo se vería el resultado. */
export function SeoMetaForm({ companyId, page, siteName, canEdit }: { companyId: string; page: SeoPage; siteName: string; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.seoTitle ?? '');
  const [desc, setDesc] = useState(page.seoDescription ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const shownTitle = title.trim() || (page.isHomepage ? siteName : `${page.title} — ${siteName}`);
  const dirty = title !== (page.seoTitle ?? '') || desc !== (page.seoDescription ?? '');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 text-left" aria-label="Así se vería en Google">
        <p className="truncate text-[12.5px] text-[#4d5156]">{page.url?.replace(/^https?:\/\//, '') ?? 'tu-pagina'}</p>
        <p className="mt-0.5 line-clamp-1 text-[18px] leading-snug text-[#1a0dab]">{shownTitle}</p>
        <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[#4d5156]">
          {desc.trim() || 'Sin descripción: Google escogerá un pedazo de texto de la página.'}
        </p>
      </div>
      {canEdit ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveSeoMetaAction(companyId, page.id, title, desc);
              setMsg(res.ok ? { ok: true, text: 'Guardado. Publica la página para que Google lo vea.' } : { ok: false, text: res.error });
              if (res.ok) router.refresh();
            });
          }}
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor={`t-${page.id}`} className="text-sm font-medium text-foreground">
                Título para Google
              </label>
              <Counter n={title.trim().length} min={25} max={65} />
            </div>
            <input
              id={`t-${page.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={`Qué vendes y dónde | ${siteName}`}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor={`d-${page.id}`} className="text-sm font-medium text-foreground">
                Descripción para Google
              </label>
              <Counter n={desc.trim().length} min={70} max={160} />
            </div>
            <textarea
              id={`d-${page.id}`}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Qué ofreces, para quién, dónde estás y cómo te contactan."
              className={`${inputClass} resize-y`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || !dirty}
              className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            {msg ? (
              <span className={`text-[13.5px] ${msg.ok ? 'text-[#9df0c6]' : 'text-[#ffb4b5]'}`} role={msg.ok ? 'status' : 'alert'}>
                {msg.text}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
