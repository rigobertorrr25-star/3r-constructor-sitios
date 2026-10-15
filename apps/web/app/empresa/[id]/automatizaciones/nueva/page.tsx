import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutomationEditor } from '@/components/automation-editor';
import { authedApi } from '@/lib/api';
import { RECIPES, type AutomationList } from '@/lib/automations';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Nueva automatización — 3R' };

export default async function NewAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ receta?: string }>;
}) {
  const { id } = await params;
  const { receta } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<AutomationList>(`/companies/${id}/automations`);
  if (!res.ok) notFound();
  const preset = receta && receta in RECIPES ? RECIPES[receta] : undefined;
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/automatizaciones`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Automatizaciones
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nueva automatización</h2>
        <AutomationEditor companyId={id} data={res.data} preset={preset} />
      </div>
    </div>
  );
}
