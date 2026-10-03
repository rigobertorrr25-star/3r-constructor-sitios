import type { Metadata } from 'next';
import Link from 'next/link';
import { moveContactAction } from '@/app/empresa/crm-actions';
import { NewContactPanel } from '@/components/crm-forms';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import type { CompanyMember } from '@/lib/companies';
import { CRM_STAGES, STAGE_HUE, STAGE_LABEL, type CrmContact, type CrmSummary } from '@/lib/crm';
import { formatMoney } from '@/lib/orders';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'CRM — 3R' };

const memberName = (m: CompanyMember) => [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;
const shortDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

export default async function CrmPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'crm')?.enabled) {
    return <ModuleOff companyName={company.name} name="CRM" text="Con el CRM llevas tus clientes, el embudo de ventas y el historial de cada uno." />;
  }

  const base = `/companies/${id}/crm`;
  const [{ data: contacts }, { data: summary }, { data: members }] = await Promise.all([
    authedApi<CrmContact[]>(`${base}/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    authedApi<CrmSummary>(`${base}/summary`),
    authedApi<CompanyMember[]>(`/companies/${id}/members`),
  ]);
  const owners = new Map(members.map((m) => [m.id, memberName(m)]));
  const options = members.filter((m) => m.status === 'active').map((m) => ({ id: m.id, name: memberName(m) }));

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ['Negocios abiertos', String(summary.openCount)],
          ['Valor en juego', formatMoney(summary.openValueCents, 'COP')],
          ['Ganado', formatMoney(summary.wonValueCents, 'COP')],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-white/[0.08] bg-card p-5">
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <NewContactPanel companyId={id} members={options} />
        <form className="flex w-full max-w-sm gap-2" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, empresa, correo…"
            aria-label="Buscar clientes"
            className="w-full rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
          <button type="submit" className="shrink-0 rounded-full border border-white/[0.12] px-4 py-2.5 text-[14px] hover:bg-white/[0.06]">
            Buscar
          </button>
        </form>
      </div>

      {contacts.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {q ? 'Nadie coincide con esa búsqueda.' : 'Todavía no hay clientes. Agrega el primero con «Nuevo cliente».'}
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <ol className="grid min-w-[1100px] grid-cols-6 gap-3">
            {CRM_STAGES.map((stage) => {
              const items = contacts.filter((c) => c.stage === stage);
              const total = summary.stages.find((s) => s.stage === stage);
              return (
                <li key={stage} className="flex flex-col rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between px-1 pb-3">
                    <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                      <span className="size-2 rounded-full" style={{ backgroundColor: `oklch(0.75 0.15 ${STAGE_HUE[stage]})` }} aria-hidden="true" />
                      {STAGE_LABEL[stage]}
                    </h2>
                    <span className="text-[12.5px] text-muted-foreground">{items.length}</span>
                  </div>
                  {total && total.valueCents > 0 ? (
                    <p className="-mt-2 px-1 pb-3 text-[12.5px] text-muted-foreground">{formatMoney(total.valueCents, 'COP')}</p>
                  ) : null}
                  <ul className="space-y-2">
                    {items.map((c) => (
                      <li key={c.id} className="rounded-2xl border border-white/[0.08] bg-card p-3">
                        <Link href={`/empresa/${id}/crm/${c.id}`} className="block focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                          <p className="text-[14px] font-medium leading-snug text-foreground">{c.name}</p>
                          {c.organization ? <p className="text-[12.5px] text-muted-foreground">{c.organization}</p> : null}
                          {c.valueCents ? <p className="mt-1.5 text-[13px] text-foreground">{formatMoney(c.valueCents, 'COP')}</p> : null}
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {c.ownerMemberId ? (owners.get(c.ownerMemberId) ?? 'Sin responsable') : 'Sin responsable'}
                            {c.lastContactAt ? ` · ${shortDate.format(new Date(c.lastContactAt))}` : ''}
                          </p>
                        </Link>
                        <form action={moveContactAction} className="mt-2">
                          <input type="hidden" name="companyId" value={id} />
                          <input type="hidden" name="contactId" value={c.id} />

                          <div className="flex flex-col gap-1.5">
                            <select
                              name="stage"
                              aria-label={`Mover a ${c.name} a otra etapa`}
                              defaultValue={c.stage}
                              className="w-full rounded-full border border-white/[0.1] bg-transparent px-2.5 py-1 text-[12px] text-muted-foreground"
                            >
                              {CRM_STAGES.map((s) => (
                                <option key={s} value={s} className="bg-[#0a131a]">
                                  {STAGE_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="shrink-0 rounded-full border border-white/[0.1] px-2.5 py-1 text-[12px] hover:bg-white/[0.06]"
                            >
                              Mover
                            </button>
                          </div>
                        </form>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
