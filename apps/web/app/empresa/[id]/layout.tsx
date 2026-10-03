import Link from 'next/link';
import type { ReactNode } from 'react';
import { CompanyTabs } from '@/components/company-tabs';
import { Alert } from '@/components/shop';
import { MODULE_INFO, MODULE_ROUTE, ROLE_LABEL, atLeast } from '@/lib/companies';
import { loadCompany } from './company';

export default async function CompanyLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company, error } = await loadCompany(id);
  if (!company) {
    return (
      <div className="max-w-xl space-y-4">
        <Link href="/empresa" className="text-[14px] text-muted-foreground transition hover:text-foreground">
          ← Mis empresas
        </Link>
        <Alert>{error}</Alert>
      </div>
    );
  }
  return (
    <>
      <Link href="/empresa" className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Mis empresas
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-tight text-foreground sm:text-[34px]">{company.name}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            {[company.industry, company.city].filter(Boolean).join(' · ') || 'Tu empresa en 3R'}
          </p>
        </div>
        <span className="rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[13px] text-foreground">
          Tu rol: {ROLE_LABEL[company.me.role]}
        </span>
      </div>
      <div className="mt-6">
        <CompanyTabs
          companyId={company.id}
          canEdit={atLeast(company.me.role, 'admin')}
          modules={company.modules
            .filter((m) => m.enabled && MODULE_ROUTE[m.key])
            .map((m) => ({ route: MODULE_ROUTE[m.key], label: MODULE_INFO[m.key]?.name ?? m.key }))}
        />
      </div>
      <div className="mt-8">{children}</div>
    </>
  );
}
