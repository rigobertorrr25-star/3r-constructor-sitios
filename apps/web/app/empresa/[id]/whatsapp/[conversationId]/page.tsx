import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateWaConversationAction } from '@/app/empresa/whatsapp-actions';
import { AutoRefresh } from '@/components/auto-refresh';
import { WaComposer } from '@/components/whatsapp-forms';
import { authedApi } from '@/lib/api';
import { STATUS_MARK, prettyPhone, type WaConversationDetail, type WaOverview } from '@/lib/whatsapp';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Conversación de WhatsApp — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const time = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function WaConversationPage({ params }: { params: Promise<{ id: string; conversationId: string }> }) {
  const { id, conversationId } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) notFound();
  const [res, overview] = await Promise.all([
    authedApi<WaConversationDetail>(`/companies/${id}/whatsapp/conversations/${conversationId}`),
    authedApi<WaOverview>(`/companies/${id}/whatsapp`),
  ]);
  if (!res.ok || !overview.ok) notFound();
  const c = res.data;
  const { members, templates } = overview.data;
  const who = (memberId: string | null) => members.find((m) => m.id === memberId)?.name;

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <Link href={`/empresa/${id}/whatsapp`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← WhatsApp
      </Link>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[20px] font-semibold text-foreground">{c.name}</h2>
            <p className="text-[13.5px] text-muted-foreground">
              {prettyPhone(c.waId)}
              {c.contactId ? (
                <>
                  {' · '}
                  <Link href={`/empresa/${id}/crm/${c.contactId}`} className="text-primary hover:underline">
                    Ver en el CRM
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={updateWaConversationAction} className="flex items-center gap-2" key={c.assignedMemberId ?? 'nadie'}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="conversationId" value={c.id} />
              <select
                name="assignedMemberId"
                defaultValue={c.assignedMemberId ?? ''}
                aria-label="Quién la atiende"
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[13.5px] text-foreground"
              >
                <option value="" className="bg-[#0a131a]">
                  Sin asignar
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0a131a]">
                    {m.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-full border border-white/[0.12] px-3 py-2 text-[13px] text-foreground hover:bg-white/[0.06]">
                Asignar
              </button>
            </form>
            <form action={updateWaConversationAction}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="conversationId" value={c.id} />
              <input type="hidden" name="status" value={c.status === 'open' ? 'closed' : 'open'} />
              <button type="submit" className="rounded-full border border-white/[0.12] px-4 py-2 text-[13px] text-foreground hover:bg-white/[0.06]">
                {c.status === 'open' ? 'Cerrar conversación' : 'Reabrir'}
              </button>
            </form>
          </div>
        </div>

        <ol className="mt-6 space-y-2.5" aria-label="Mensajes">
          {c.messages.map((m) => (
            <li key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ${m.direction === 'out' ? 'rounded-br-md bg-[#1f6f4a]/35 text-foreground' : 'rounded-bl-md bg-white/[0.05] text-foreground/95'} ${m.status === 'failed' ? 'border border-[#ff6b6e]/40' : ''}`}
              >
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.body}</p>
                <p className="mt-1 text-right text-[11.5px] text-muted-foreground">
                  {m.type === 'template' ? 'Plantilla · ' : ''}
                  {m.direction === 'out' && who(m.sentById) ? `${who(m.sentById)} · ` : ''}
                  {time.format(new Date(m.createdAt))}
                  {m.direction === 'out' ? ` · ${STATUS_MARK[m.status]}` : ''}
                </p>
                {m.status === 'failed' && m.error ? <p className="mt-1 text-[12px] text-[#ffb4b5]">{m.error}</p> : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <WaComposer
            key={String(c.canReply)}
            companyId={id}
            conversationId={c.id}
            canReply={c.canReply}
            clientWrote={!!c.lastInboundAt}
            templates={templates}
          />
        </div>
      </section>
    </div>
  );
}
