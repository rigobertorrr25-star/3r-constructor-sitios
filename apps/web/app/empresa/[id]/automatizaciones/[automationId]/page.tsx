import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutomationEditor } from '@/components/automation-editor';
import { authedApi } from '@/lib/api';
import type { AutomationList } from '@/lib/automations';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Editar automatización — 3R' };

export default async function EditAutomationPage({ params }: { params: Promise<{ id: string; automationId: string }> }) {
  const { id, automationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(automationId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<AutomationList>(`/companies/${id}/automations`);
  const automation = res.ok ? res.data.automations.find((a) => a.id === automationId) : undefined;
  if (!automation) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/automatizaciones`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Automatizaciones
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">{automation.name}</h2>
        <AutomationEditor companyId={id} data={res.data} automation={automation} />
      </div>
    </div>
  );
}
