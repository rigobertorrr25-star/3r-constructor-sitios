import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SurveyEditor } from '@/components/survey-editor';
import { authedApi } from '@/lib/api';
import type { Survey } from '@/lib/surveys';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Editar encuesta — 3R' };

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string; surveyId: string }> }) {
  const { id, surveyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(surveyId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<Survey>(`/companies/${id}/surveys/${surveyId}`);
  if (!res.ok || !res.data.manage) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/encuestas/${surveyId}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {res.data.title}
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Editar encuesta</h2>
        <SurveyEditor companyId={id} survey={res.data} />
      </div>
    </div>
  );
}
