import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteQuoteAction, reopenQuoteAction } from '@/app/empresa/quotes-actions';
import { QuoteSendPanel } from '@/components/quote-send';
import { QuoteSheet } from '@/components/quote-sheet';
import { authedApi } from '@/lib/api';
import { STATUS_HUE, STATUS_LABEL, dateText, type QuoteDetail } from '@/lib/quotes';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Cotización — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

export default async function QuotePage({ params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<QuoteDetail>(`/companies/${id}/quotes/${quoteId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const q = res.data;
  const base = `/empresa/${id}/cotizaciones`;
  const responded = ['accepted', 'rejected', 'changes_requested'].includes(q.status);

  return (
    <div className="space-y-6">
      <Link href={base} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Cotizaciones
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[14px] text-muted-foreground">
            {q.code} · {[q.clientName, q.clientCompany].filter(Boolean).join(' · ')}
          </p>
          <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{q.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: `oklch(0.75 0.15 ${STATUS_HUE[q.status]} / 0.15)`, color: `oklch(0.86 0.09 ${STATUS_HUE[q.status]})` }}
            >
              {q.expired ? 'Vencida' : STATUS_LABEL[q.status]}
            </span>
            {q.validUntil ? <span className="text-muted-foreground">Válida hasta el {dateText(q.validUntil)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${base}/${q.id}/pdf`}
            className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
          >
            Descargar PDF
          </a>
          {q.can.edit ? (
            <Link
              href={`${base}/${q.id}/editar`}
              className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
            >
              Editar
            </Link>
          ) : null}
          {q.status === 'sent' ? (
            <form action={reopenQuoteAction}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="quoteId" value={q.id} />
              <button
                type="submit"
                className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
              >
                Cambiarla
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className={card} aria-label="Detalle de la cotización">
          <QuoteSheet items={q.items} subtotal={q.subtotal} discount={q.discount} taxRate={q.taxRate} tax={q.tax} total={q.total} />
          {q.notes ? (
            <div className="mt-6 border-t border-white/[0.06] pt-4">
              <p className="text-[13px] text-muted-foreground">Condiciones y notas</p>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px] text-foreground/90">{q.notes}</p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          {responded ? (
            <section className={card} aria-labelledby="h-respuesta">
              <h3 id="h-respuesta" className="font-display text-[18px] font-semibold text-foreground">
                Respuesta del cliente
              </h3>
              <p className="mt-2 text-[14.5px] text-foreground">
                {STATUS_LABEL[q.status]} por {q.responseName} · {when.format(new Date(q.respondedAt!))}
              </p>
              {q.responseMessage ? <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-foreground/90">«{q.responseMessage}»</p> : null}
              {q.status === 'changes_requested' ? (
                <p className="mt-3 text-[13px] text-muted-foreground">Edítala con lo que pidió y vuelve a enviarla.</p>
              ) : null}
            </section>
          ) : null}

          {q.status !== 'accepted' && q.status !== 'rejected' ? (
            <section className={card} aria-labelledby="h-enviar">
              <h3 id="h-enviar" className="mb-2 font-display text-[18px] font-semibold text-foreground">
                {q.status === 'sent' ? 'Enviada' : 'Enviar al cliente'}
              </h3>
              <p className="mb-4 text-[13.5px] text-muted-foreground">
                {q.status === 'sent'
                  ? `Enviada ${when.format(new Date(q.sentAt!))}. ${q.viewedAt ? `El cliente la abrió ${when.format(new Date(q.viewedAt))}.` : 'Todavía no la abre.'}`
                  : 'Le llega un enlace donde la ve, la descarga y la acepta, la rechaza o pide cambios.'}
              </p>
              <QuoteSendPanel companyId={id} quoteId={q.id} hasEmail={!!q.clientEmail} resend={q.status === 'sent'} />
            </section>
          ) : null}

          <section className={card} aria-labelledby="h-datos">
            <h3 id="h-datos" className="font-display text-[17px] font-semibold text-foreground">
              Cliente
            </h3>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              {[q.clientName, q.clientCompany, q.clientEmail, q.clientPhone].filter(Boolean).map((v) => (
                <dd key={v} className="text-foreground">
                  {v}
                </dd>
              ))}
            </dl>
            {q.contactId ? (
              <Link href={`/empresa/${id}/crm/${q.contactId}`} className="mt-3 inline-block text-[13.5px] text-primary hover:underline">
                Ver en el CRM →
              </Link>
            ) : null}
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              Hecha {q.author ? `por ${q.author} ` : ''}el {when.format(new Date(q.createdAt))}.
            </p>
          </section>

          {q.can.delete ? (
            <form action={deleteQuoteAction}>
              <input type="hidden" name="companyId" value={id} />
              <input type="hidden" name="quoteId" value={q.id} />
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Borrar esta cotización
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
