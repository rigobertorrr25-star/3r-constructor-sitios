import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteTicketAction, setTicketStatusAction } from '@/app/empresa/tickets-actions';
import { ManageTicketForm, TicketCommentForm } from '@/components/ticket-forms';
import { authedApi } from '@/lib/api';
import type { CompanyMember } from '@/lib/companies';
import { CATEGORY_LABEL, EVENT_LABEL, PRIORITY_HUE, PRIORITY_LABEL, STATUS_ACTION, STATUS_LABEL, type TicketDetail } from '@/lib/tickets';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Ticket — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
const memberName = (m: CompanyMember) => [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;

export default async function TicketPage({ params }: { params: Promise<{ id: string; ticketId: string }> }) {
  const { id, ticketId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const [res, { data: members }] = await Promise.all([
    authedApi<TicketDetail>(`/companies/${id}/tickets/${ticketId}`),
    authedApi<CompanyMember[]>(`/companies/${id}/members`),
  ]);
  if (res.status === 404 || res.status === 403) notFound();
  const t = res.data;
  const names = new Map(members.map((m) => [m.id, memberName(m)]));
  const options = members.filter((m) => m.status === 'active').map((m) => ({ id: m.id, name: memberName(m) }));
  const person = (memberId: string | null, none: string) => (memberId ? (names.get(memberId) ?? 'Ya no está en la empresa') : none);
  // Primero el paso que avanza el ticket; «Abrir de nuevo» siempre al final.
  const next = (['in_progress', 'resolved', 'closed', 'open'] as const).filter((s) => t.can.statuses.includes(s));

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/tickets`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Tickets
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">
          Ticket #{t.number} · {CATEGORY_LABEL[t.category] ?? t.category}
        </p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{t.title}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-full border border-white/[0.12] px-3 py-1 text-foreground">{STATUS_LABEL[t.status]}</span>
          <span
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: `oklch(0.75 0.15 ${PRIORITY_HUE[t.priority]} / 0.15)`, color: `oklch(0.85 0.1 ${PRIORITY_HUE[t.priority]})` }}
          >
            Prioridad {PRIORITY_LABEL[t.priority].toLowerCase()}
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-6">
          <section className={card} aria-labelledby="h-detalle">
            <h3 id="h-detalle" className="font-display text-[18px] font-semibold text-foreground">
              Lo que pidió {person(t.requesterMemberId, '—')}
            </h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{when.format(new Date(t.createdAt))}</p>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">{t.description}</p>
          </section>

          <section className={card} aria-labelledby="h-historial">
            <h3 id="h-historial" className="mb-5 font-display text-[18px] font-semibold text-foreground">
              Historial
            </h3>
            {t.events.length > 0 ? (
              <ol className="space-y-4">
                {t.events.map((e) => (
                  <li key={e.id} className={e.kind === 'comment' ? '' : 'text-muted-foreground'}>
                    <p className="text-[12.5px] text-muted-foreground">
                      <span className="text-foreground">{EVENT_LABEL[e.kind] ?? e.kind}</span> · {when.format(new Date(e.createdAt))}
                      {e.author ? ` · ${e.author}` : ''}
                    </p>
                    <p
                      className={`mt-1 whitespace-pre-wrap leading-relaxed ${e.kind === 'comment' ? 'text-[14.5px] text-foreground/90' : 'text-[13.5px]'}`}
                    >
                      {e.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[14px] text-muted-foreground">
                Aquí queda cada comentario y cada cambio: quién lo tomó, cuándo empezó y cuándo se resolvió.
              </p>
            )}
            {t.can.comment ? (
              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <TicketCommentForm companyId={id} ticketId={t.id} />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className={card} aria-labelledby="h-estado">
            <h3 id="h-estado" className="font-display text-[18px] font-semibold text-foreground">
              Estado
            </h3>
            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Responsable</dt>
                <dd className="text-right text-foreground">{person(t.assigneeMemberId, 'Sin responsable')}</dd>
              </div>
              {t.resolvedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Resuelto</dt>
                  <dd className="text-right text-foreground">{when.format(new Date(t.resolvedAt))}</dd>
                </div>
              ) : null}
              {t.closedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Cerrado</dt>
                  <dd className="text-right text-foreground">{when.format(new Date(t.closedAt))}</dd>
                </div>
              ) : null}
            </dl>
            {next.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {next.map((s, i) => (
                  <form key={s} action={setTicketStatusAction}>
                    <input type="hidden" name="companyId" value={id} />
                    <input type="hidden" name="ticketId" value={t.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      className={
                        i === 0
                          ? 'rounded-full bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]'
                          : 'rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]'
                      }
                    >
                      {STATUS_ACTION[s]}
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
            {t.status === 'resolved' && t.can.statuses.includes('closed') && !t.can.manage ? (
              <p className="mt-3 text-[13px] text-muted-foreground">Si quedó bien, ciérralo. Si no, ábrelo de nuevo y cuenta qué falta.</p>
            ) : null}
          </section>

          {t.can.manage ? (
            <section className={card} aria-labelledby="h-asignar">
              <h3 id="h-asignar" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                Asignar
              </h3>
              <ManageTicketForm companyId={id} ticket={t} members={options} />
            </section>
          ) : null}

          {t.can.delete ? (
            <form action={deleteTicketAction}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="ticketId" value={t.id} />
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Borrar este ticket
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
