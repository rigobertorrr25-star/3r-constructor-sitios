import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { STATUS_HUE, STATUS_LABEL, pesos, type Quote, type QuoteStatus, type QuotesSummary } from '@/lib/quotes';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Cotizaciones — 3R' };

const short = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const FILTERS: { key: QuoteStatus | ''; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'draft', label: 'Borradores' },
  { key: 'sent', label: 'Enviadas' },
  { key: 'changes_requested', label: 'Pidieron cambios' },
  { key: 'accepted', label: 'Aceptadas' },
  { key: 'rejected', label: 'Rechazadas' },
];

export default async function QuotesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string }> }) {
  const { id } = await params;
  const { estado = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'quotes')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Cotizaciones"
        text="Arma cotizaciones con ítems, descuento e IVA, mándalas por correo o WhatsApp, y tu cliente las acepta, las rechaza o pide cambios desde el enlace."
      />
    );
  }
  const status = FILTERS.some((f) => f.key === estado) ? estado : '';
  const [{ data: quotes }, { data: summary }] = await Promise.all([
    authedApi<Quote[]>(`/companies/${id}/quotes${status ? `?status=${status}` : ''}`),
    authedApi<QuotesSummary>(`/companies/${id}/quotes/summary`),
  ]);
  const base = `/empresa/${id}/cotizaciones`;

  return (
    <div className="space-y-8">
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ['Abiertas', String(summary.open)],
          ['Valor abierto', pesos(summary.openValue)],
          ['Aceptadas', String(summary.accepted)],
          ['Valor aceptado', pesos(summary.acceptedValue)],
        ].map(([label, value]) => (
          <li key={label} className="rounded-[24px] border border-white/[0.08] bg-card p-5">
            <span className="block text-[13px] text-muted-foreground">{label}</span>
            <span className="mt-1 block font-display text-[24px] font-bold tracking-tight text-foreground">{value}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`${base}/nueva`}
          className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          + Nueva cotización
        </Link>
      </div>
      <nav aria-label="Filtrar cotizaciones" className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key || 'all'}
            href={f.key ? `${base}?estado=${f.key}` : base}
            aria-current={status === f.key ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-[13.5px] transition ${status === f.key ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {quotes.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {status ? 'No hay cotizaciones con ese estado.' : 'Todavía no hay cotizaciones. Haz la primera con «Nueva cotización».'}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`${base}/${q.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-5"
              >
                <span className="w-16 shrink-0 text-[13.5px] text-muted-foreground">{q.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">{q.title}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {[q.clientName, q.clientCompany, short.format(new Date(q.createdAt))].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-[15px] font-medium text-foreground">{pesos(q.total)}</span>
                <span
                  className="w-fit rounded-full px-2.5 py-1 text-[12.5px]"
                  style={{ backgroundColor: `oklch(0.75 0.15 ${STATUS_HUE[q.status]} / 0.15)`, color: `oklch(0.86 0.09 ${STATUS_HUE[q.status]})` }}
                >
                  {q.expired ? 'Vencida' : STATUS_LABEL[q.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
