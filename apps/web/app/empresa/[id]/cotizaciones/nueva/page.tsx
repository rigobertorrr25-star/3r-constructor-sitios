import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuoteEditor } from '@/components/quote-editor';
import { authedApi } from '@/lib/api';
import type { CrmContact } from '@/lib/crm';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Nueva cotización — 3R' };

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contacto?: string }>;
}) {
  const { id } = await params;
  const { contacto } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.some((m) => m.key === 'quotes' && m.enabled)) notFound();
  const crmOn = company.modules.some((m) => m.key === 'crm' && m.enabled);
  const contacts = crmOn ? await authedApi<CrmContact[]>(`/companies/${id}/crm/contacts`).then((r) => (r.ok ? r.data : [])) : [];
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/cotizaciones`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Cotizaciones
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nueva cotización</h2>
        <QuoteEditor companyId={id} contacts={contacts} initialContact={contacto} />
      </div>
    </div>
  );
}
