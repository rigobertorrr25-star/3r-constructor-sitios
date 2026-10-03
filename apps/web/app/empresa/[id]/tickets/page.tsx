import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { NewTicketPanel } from '@/components/ticket-forms';
import { authedApi } from '@/lib/api';
import { atLeast, type CompanyMember } from '@/lib/companies';
import { CATEGORY_LABEL, PRIORITY_HUE, PRIORITY_LABEL, STATUS_LABEL, formatHours, type Ticket, type TicketSummary } from '@/lib/tickets';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Tickets — 3R' };

const memberName = (m: CompanyMember) => [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;
const shortDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

const VIEWS = [
  { key: 'active', label: 'Pendientes' },
  { key: 'mine', label: 'A mi cargo' },
  { key: 'requested', label: 'Los que pedí' },
  { key: 'done', label: 'Resueltos y cerrados' },
  { key: 'all', label: 'Todos' },
];

export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; category?: string; q?: string }>;
}) {
  const { id } = await params;
  const { view = 'active', category = '', q = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'tickets')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Tickets"
        text="Con los tickets, cada solicitud de soporte, mantenimiento o compras queda con número, responsable y estado, y nada se pierde en el chat."
      />
    );
  }

  const staff = atLeast(company.me.role, 'supervisor');
  const query = new URLSearchParams({ view, ...(category ? { category } : {}), ...(q ? { q } : {}) });
  const [{ data: tickets }, { data: summary }, { data: members }] = await Promise.all([
    authedApi<Ticket[]>(`/companies/${id}/tickets?${query}`),
    authedApi<TicketSummary>(`/companies/${id}/tickets/summary`),
    authedApi<CompanyMember[]>(`/companies/${id}/members`),
  ]);
  const names = new Map(members.map((m) => [m.id, memberName(m)]));
  const href = (next: Record<string, string>) => {
    const p = new URLSearchParams({ view, ...(category ? { category } : {}), ...(q ? { q } : {}), ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/empresa/${id}/tickets?${p}`;
  };

  const stats: [string, string][] = [
    ['Pendientes', String(summary.active)],
    ['Urgentes', String(summary.urgent)],
    staff ? ['Sin responsable', String(summary.unassigned)] : ['A mi cargo', String(summary.mine)],
    ['Tiempo para resolver', formatHours(summary.avgResolutionHours)],
  ];

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-white/[0.08] bg-card p-5">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-5 text-[13px] text-muted-foreground">
        {staff ? 'Ves todos los tickets de la empresa.' : 'Ves los tickets que pediste y los que tienes a tu cargo.'} El tiempo para resolver es el
        promedio de los últimos 30 días.
      </p>

      <NewTicketPanel companyId={id} />

      <div className="space-y-4">
        <nav aria-label="Filtrar tickets" className="flex gap-2 overflow-x-auto pb-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href({ view: v.key })}
              aria-current={view === v.key ? 'page' : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-[13.5px] transition ${view === v.key ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-col gap-2 sm:flex-row" role="search">
          <input type="hidden" name="view" value={view} />
          <select
            name="category"
            defaultValue={category}
            aria-label="Área"
            className="rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[14.5px] text-foreground sm:w-56"
          >
            <option value="" className="bg-[#0a131a]">
              Todas las áreas
            </option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value} className="bg-[#0a131a]">
                {label}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por título o número…"
            aria-label="Buscar tickets"
            className="w-full rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none sm:max-w-sm"
          />
          <button type="submit" className="shrink-0 rounded-full border border-white/[0.12] px-4 py-2.5 text-[14px] hover:bg-white/[0.06]">
            Buscar
          </button>
        </form>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {q || category
            ? 'Ningún ticket coincide con esa búsqueda.'
            : view === 'active'
              ? 'No hay tickets pendientes. ¡Todo al día!'
              : 'No hay tickets aquí.'}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/empresa/${id}/tickets/${t.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-[var(--ring)] sm:flex-row sm:items-center sm:gap-5"
              >
                <span className="w-14 shrink-0 text-[13.5px] text-muted-foreground">#{t.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">{t.title}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {CATEGORY_LABEL[t.category] ?? t.category} · Pidió{' '}
                    {t.requesterMemberId ? (names.get(t.requesterMemberId) ?? 'alguien que ya no está') : '—'} ·{' '}
                    {shortDate.format(new Date(t.createdAt))}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span
                    className="rounded-full px-2.5 py-1"
                    style={{
                      backgroundColor: `oklch(0.75 0.15 ${PRIORITY_HUE[t.priority]} / 0.15)`,
                      color: `oklch(0.85 0.1 ${PRIORITY_HUE[t.priority]})`,
                    }}
                  >
                    {PRIORITY_LABEL[t.priority]}
                  </span>
                  <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-foreground">{STATUS_LABEL[t.status]}</span>
                  <span className="text-muted-foreground">
                    {t.assigneeMemberId ? (names.get(t.assigneeMemberId) ?? 'Responsable') : 'Sin responsable'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
