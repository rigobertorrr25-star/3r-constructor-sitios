import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { QuoteEditor } from '@/components/quote-editor';
import { authedApi } from '@/lib/api';
import type { CrmContact } from '@/lib/crm';
import type { QuoteDetail } from '@/lib/quotes';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Editar cotización — 3R' };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<QuoteDetail>(`/companies/${id}/quotes/${quoteId}`);
  if (!res.ok) notFound();
  if (!res.data.can.edit) redirect(`/empresa/${id}/cotizaciones/${quoteId}`);
  const crmOn = company.modules.some((m) => m.key === 'crm' && m.enabled);
  const contacts = crmOn ? await authedApi<CrmContact[]>(`/companies/${id}/crm/contacts`).then((r) => (r.ok ? r.data : [])) : [];
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/cotizaciones/${quoteId}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {res.data.code}
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Editar {res.data.code}</h2>
        <QuoteEditor companyId={id} quote={res.data} contacts={contacts} />
      </div>
    </div>
  );
}
