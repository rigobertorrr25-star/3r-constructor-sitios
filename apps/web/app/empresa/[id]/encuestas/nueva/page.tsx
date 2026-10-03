import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SurveyEditor } from '@/components/survey-editor';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Nueva encuesta — 3R' };

export default async function NewSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.some((m) => m.key === 'surveys' && m.enabled) || !atLeast(company.me.role, 'supervisor')) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/encuestas`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Encuestas
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nueva encuesta</h2>
        <SurveyEditor companyId={id} />
      </div>
    </div>
  );
}
