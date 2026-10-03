'use client';

import { useState, useTransition } from 'react';
import { saveArticleAction } from '@/app/empresa/knowledge-actions';
import type { Article, ArticleAudience } from '@/lib/knowledge';
import { ArticleBody } from './article-body';
import { CheckField, Field, SelectField, inputClass } from './field';
import { Alert } from './shop';

export function ArticleEditor({ companyId, article, categories }: { companyId: string; article?: Article; categories: string[] }) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [category, setCategory] = useState(article?.category ?? '');
  const [audience, setAudience] = useState<ArticleAudience>(article?.audience ?? 'team');
  const [status, setStatus] = useState(article?.status ?? 'published');
  const [pinned, setPinned] = useState(article?.pinned ?? false);
  const [body, setBody] = useState(article?.body ?? '');
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveArticleAction(companyId, article?.id ?? null, { title, category, audience, status, pinned, body });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="Título" name="title" required minLength={3} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="category" className="text-sm font-medium text-foreground">
            Categoría (opcional)
          </label>
          <input
            id="category"
            name="category"
            list="categories"
            maxLength={60}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Caja, Cocina, Pedidos…"
            className={inputClass}
          />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <SelectField
          label="¿Para quién es?"
          name="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value as ArticleAudience)}
          options={[
            { value: 'team', label: 'Solo el equipo' },
            { value: 'public', label: 'Clientes (ayuda pública)' },
          ]}
        />
        <SelectField
          label="Estado"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
          options={[
            { value: 'published', label: 'Publicado' },
            { value: 'draft', label: 'Borrador' },
          ]}
        />
      </div>
      <CheckField
        name="pinned"
        label="Fijarlo arriba"
        hint="Sale de primero en la lista."
        checked={pinned}
        onChange={(e) => setPinned(e.target.checked)}
      />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="body" className="text-sm font-medium text-foreground">
            Contenido
          </label>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {preview ? 'Seguir escribiendo' : 'Ver cómo queda'}
          </button>
        </div>
        {preview ? (
          <div className="min-h-[200px] rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            {body.trim() ? <ArticleBody body={body} /> : <p className="text-muted-foreground">Todavía no hay texto.</p>}
          </div>
        ) : (
          <textarea
            id="body"
            name="body"
            required
            minLength={10}
            maxLength={50000}
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'## Antes de empezar\n- Primer paso\n- Segundo paso\n\nUn párrafo con lo que hay que saber.'}
            className={`${inputClass} resize-y font-[inherit]`}
          />
        )}
        <p className="text-[13px] text-muted-foreground">
          Formato: «## » al inicio de una línea para un subtítulo, «- » para una lista y una línea en blanco entre párrafos.
        </p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Guardando…' : article ? 'Guardar cambios' : 'Guardar artículo'}
      </button>
    </form>
  );
}
