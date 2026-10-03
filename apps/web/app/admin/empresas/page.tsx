import type { Metadata } from 'next';
import Link from 'next/link';
import { authedApi } from '@/lib/api';
import type { AdminCompany } from '@/lib/companies';

export const metadata: Metadata = { title: 'Empresas — Administración 3R' };

const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });

export default async function AdminCompaniesPage() {
  const { data: companies } = await authedApi<AdminCompany[]>('/admin/companies');
  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Empresas</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">
        {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'} en la plataforma. Aquí activas sus módulos o las suspendes.
      </p>
      {companies.length === 0 ? (
        <p className="mt-8 rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Todavía nadie ha creado su empresa. Se crean desde «Mi empresa» en la cuenta de cada cliente.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {companies.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/empresas/${c.id}`}
                className="flex flex-col gap-2 rounded-[24px] border border-white/[0.08] bg-card p-5 transition hover:border-white/[0.16] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-[18px] font-semibold text-foreground">{c.name}</p>
                  <p className="truncate text-[13.5px] text-muted-foreground">
                    {c.owner?.email ?? 'Sin dueño'} · {[c.industry, c.city].filter(Boolean).join(' · ') || 'Sin sector'} · desde{' '}
                    {date.format(new Date(c.createdAt))}
                  </p>
                </div>
                <p className="shrink-0 text-[13.5px] text-muted-foreground">
                  {c.memberCount} personas · {c.modules.length} módulos
                  {c.status === 'suspended' ? <span className="ml-2 text-[#ffb4b5]">Suspendida</span> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
