'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createSiteAction } from '@/app/actions';
import type { Template } from '@/lib/types';
import { Field } from './field';
import { SubmitButton } from './submit-button';

const categoryLabel: Record<string, string> = {
  basic: 'Básico',
  restaurant: 'Restaurante',
  portfolio: 'Portafolio',
};

export function NewSiteForm({ templates }: { templates: Template[] }) {
  const [state, action] = useActionState(createSiteAction, undefined);

  return (
    <form action={action} className="space-y-8">
      <Field label="Nombre del sitio" name="name" required minLength={2} maxLength={150} placeholder="Restaurante Caribe" defaultValue={state?.values?.name} />

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Plantilla</legend>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {templates.map((template) => (
            <label key={template.id} className="cursor-pointer">
              <input
                type="radio"
                name="templateSlug"
                value={template.slug}
                defaultChecked={(state?.values?.templateSlug ?? 'blank') === template.slug}
                className="peer sr-only"
              />
              <span className="block rounded-[24px] border border-white/[0.08] bg-card p-4 transition peer-checked:border-primary/70 peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)] hover:border-white/[0.16]">
                <span className="block text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
                  {categoryLabel[template.category ?? ''] ?? template.category ?? 'General'}
                </span>
                <span className="mt-2 block font-display text-[17px] font-semibold text-foreground">{template.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[#ffb4b5]">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <SubmitButton pendingText="Creando…">Crear sitio</SubmitButton>
        </div>
        <Link href="/admin/sitios" className="rounded-full px-5 py-3 text-[14.875px] text-muted-foreground transition hover:text-foreground">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
