import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { NewRequestPanel } from '@/components/request-forms';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { STATUS_LABEL, TYPE_HUE, TYPE_LABEL, rangeText, type LeaveRequest, type RequestsSummary } from '@/lib/requests';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Permisos y vacaciones — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const until = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'requests')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Permisos y vacaciones"
        text="El empleado pide vacaciones, permisos, incapacidades o certificados; el supervisor aprueba y RR. HH. confirma. Todo queda por escrito."
      />
    );
  }
  const approver = atLeast(company.me.role, 'supervisor');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const views = [
    ...(approver ? [{ key: 'to_decide', label: 'Por decidir' }] : []),
    { key: 'mine', label: 'Mis solicitudes' },
    ...(approver ? [{ key: 'all', label: 'Todas' }] : []),
  ];
  const { view: asked } = await searchParams;
  const view = views.some((v) => v.key === asked) ? asked! : views[0].key;

  const [{ data: requests }, { data: summary }] = await Promise.all([
    authedApi<LeaveRequest[]>(`/companies/${id}/requests?view=${view}`),
    authedApi<RequestsSummary>(`/companies/${id}/requests/summary`),
  ]);

  const stats: [string, string][] = [
    ...(approver ? ([['Por decidir', String(summary.toDecide)]] as [string, string][]) : []),
    ['Mis solicitudes abiertas', String(summary.myOpen)],
    ['Mis días de vacaciones este año', String(summary.myVacationDaysThisYear)],
    ...(approver ? ([['Ausentes hoy', String(summary.absentToday.length)]] as [string, string][]) : []),
  ];

  return (
    <div className="space-y-8">
      <dl className={`grid grid-cols-2 gap-4 ${stats.length > 2 ? 'lg:grid-cols-4' : ''}`}>
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-white/[0.08] bg-card p-5">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {approver && summary.absentToday.length > 0 ? (
        <section className={card} aria-labelledby="h-ausentes">
          <h2 id="h-ausentes" className="font-display text-[18px] font-semibold text-foreground">
            Hoy no están
          </h2>
          <ul className="mt-3 space-y-2">
            {summary.absentToday.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 text-[14.5px]">
                <span className="text-foreground">{a.name}</span>
                <span className="text-muted-foreground">
                  {TYPE_LABEL[a.type]}
                  {a.until ? (a.until === today ? ' · solo hoy' : ` · hasta el ${until.format(new Date(`${a.until}T00:00:00Z`))}`) : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <NewRequestPanel companyId={id} />

      <nav aria-label="Filtrar solicitudes" className="flex gap-2 overflow-x-auto pb-1">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`/empresa/${id}/solicitudes?view=${v.key}`}
            aria-current={view === v.key ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-[13.5px] transition ${view === v.key ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {view === 'to_decide'
            ? 'No tienes solicitudes por decidir. ¡Al día!'
            : view === 'mine'
              ? 'Todavía no has pedido nada.'
              : 'No hay solicitudes.'}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/empresa/${id}/solicitudes/${r.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-[var(--ring)] sm:flex-row sm:items-center sm:gap-5"
              >
                <span
                  className="w-fit shrink-0 rounded-full px-2.5 py-1 text-[12.5px] sm:w-36 sm:text-center"
                  style={{ backgroundColor: `oklch(0.75 0.15 ${TYPE_HUE[r.type]} / 0.15)`, color: `oklch(0.85 0.1 ${TYPE_HUE[r.type]})` }}
                >
                  {TYPE_LABEL[r.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-foreground">{view === 'mine' ? rangeText(r) || r.reason : r.member.name}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {view === 'mine' ? (rangeText(r) ? r.reason : '') : [rangeText(r), r.reason].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="w-fit rounded-full border border-white/[0.1] px-2.5 py-1 text-[12.5px] text-foreground">
                  {STATUS_LABEL[r.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
