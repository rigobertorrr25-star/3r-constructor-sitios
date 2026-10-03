import Link from 'next/link';
import type { ReactNode } from 'react';
import { CompanyTabs } from '@/components/company-tabs';
import { Alert } from '@/components/shop';
import { MODULE_INFO, MODULE_ROUTE, ROLE_LABEL, atLeast } from '@/lib/companies';
import { authedApi } from '@/lib/api';
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
  const alertsOn = company.modules.some((m) => m.key === 'alerts' && m.enabled);
  const unread = alertsOn ? await authedApi<{ unread: number }>(`/companies/${company.id}/alerts/count`).then((r) => (r.ok ? r.data.unread : 0)) : 0;
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
        <div className="flex items-center gap-2">
          {alertsOn ? (
            <Link
              href={`/empresa/${company.id}/alertas`}
              aria-label={unread ? `Alertas: ${unread} sin leer` : 'Alertas'}
              className="relative inline-flex size-9 items-center justify-center rounded-full border border-white/[0.1] text-foreground transition hover:bg-white/[0.06]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-[18px]" aria-hidden="true">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
              </svg>
              {unread ? (
                <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[11px] font-semibold leading-[18px] text-primary-foreground">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          <span className="rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[13px] text-foreground">
            Tu rol: {ROLE_LABEL[company.me.role]}
          </span>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <CompanyTabs
            companyId={company.id}
            canEdit={atLeast(company.me.role, 'admin')}
            modules={company.modules
              .filter((m) => m.enabled && MODULE_ROUTE[m.key])
              .map((m) => ({ route: MODULE_ROUTE[m.key], label: MODULE_INFO[m.key]?.name ?? m.key, area: m.area }))}
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
