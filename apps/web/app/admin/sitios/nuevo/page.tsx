import type { Metadata } from 'next';
import { NewSiteForm } from '@/components/new-site-form';
import { authedApi } from '@/lib/api';
import type { Template } from '@/lib/types';

export const metadata: Metadata = { title: 'Crear sitio — Administración 3R' };

export default async function NewSitePage() {
  const { data: templates } = await authedApi<Template[]>('/templates');

  return (
    <div className="max-w-[720px]">
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Crear sitio</h1>
      <p className="mt-1 mb-8 text-[15px] text-muted-foreground">Elige cómo quieres empezar.</p>
      <NewSiteForm templates={templates} />
    </div>
  );
}
