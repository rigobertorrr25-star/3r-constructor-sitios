import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CampaignEditor } from '@/components/campaign-editor';
import { authedApi } from '@/lib/api';
import { canUseAiText } from '@/lib/companies';
import type { MarketingOverview } from '@/lib/marketing';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Nueva campaña — 3R' };

export default async function NewCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<MarketingOverview>(`/companies/${id}/marketing`);
  if (!res.ok) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/marketing`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Marketing
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nueva campaña</h2>
        <CampaignEditor companyId={id} companyName={company.name} tags={res.data.tags} ai={canUseAiText(company)} />
      </div>
    </div>
  );
}
