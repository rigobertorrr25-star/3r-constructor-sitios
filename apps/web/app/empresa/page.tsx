import type { Metadata } from 'next';
import Link from 'next/link';
import { CompanyForm } from '@/components/company-forms';
import { authedApi } from '@/lib/api';
import { ROLE_LABEL, type CompanySummary } from '@/lib/companies';

export const metadata: Metadata = { title: 'Mi empresa — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export default async function CompaniesPage() {
  const { data: companies } = await authedApi<CompanySummary[]>('/companies');

  if (companies.length === 0) {
    return (
      <div className="grid gap-10 lg:grid-cols-[1fr_440px] lg:items-start">
        <div className="max-w-xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Plataforma 3R</p>
          <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-[44px]">
            Tu empresa, <span className="text-spectrum">en un solo lugar</span>
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            Crea tu empresa, invita a tu equipo y dale a cada persona su rol. Después activas los módulos que necesites: clientes y ventas, tickets,
            permisos y vacaciones, documentos y más.
          </p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-foreground/90">
            <li className="flex gap-2.5">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Cada persona entra con su propia cuenta.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Cinco roles: dueño, administrador, recursos humanos, supervisor y empleado.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Cada rol ve solo lo que le toca.
            </li>
          </ul>
        </div>
        <div className={card}>
          <h2 className="font-display text-[20px] font-semibold text-foreground">Crea tu empresa</h2>
          <p className="mt-1 mb-5 text-[14px] text-muted-foreground">Quedas como dueño. Lo puedes cambiar todo después.</p>
          <CompanyForm />
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Mis empresas</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <li key={c.id}>
            <Link
              href={`/empresa/${c.id}`}
              className={`${card} block h-full transition duration-300 ease-[var(--ease-emphasized)] hover:-translate-y-0.5 hover:border-white/[0.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]`}
            >
              <p className="text-[13px] text-muted-foreground">{[c.industry, c.city].filter(Boolean).join(' · ') || 'Empresa'}</p>
              <h2 className="mt-1 font-display text-[21px] font-semibold text-foreground">{c.name}</h2>
              <p className="mt-3 text-[14px] text-muted-foreground">
                {ROLE_LABEL[c.role]} · {c.memberCount} {c.memberCount === 1 ? 'persona' : 'personas'} · {c.moduleCount}{' '}
                {c.moduleCount === 1 ? 'módulo activo' : 'módulos activos'}
              </p>
              {c.status === 'suspended' ? <p className="mt-2 text-[13px] text-[#ffb4b5]">Suspendida</p> : null}
            </Link>
          </li>
        ))}
      </ul>
      <details className={`${card} mt-8 max-w-xl`}>
        <summary className="cursor-pointer font-display text-[17px] font-semibold text-foreground">Crear otra empresa</summary>
        <div className="mt-5">
          <CompanyForm />
        </div>
      </details>
    </>
  );
}
