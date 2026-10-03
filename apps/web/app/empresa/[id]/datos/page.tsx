import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyForm } from '@/components/company-forms';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Datos de la empresa — 3R' };

export default async function CompanyDataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!atLeast(company.me.role, 'admin')) notFound();
  return (
    <section className="max-w-2xl rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
      <h2 className="mb-5 font-display text-[20px] font-semibold text-foreground">Datos de la empresa</h2>
      <CompanyForm company={company} />
    </section>
  );
}
