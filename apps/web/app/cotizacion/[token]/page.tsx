import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuoteRespond } from '@/components/quote-respond';
import { QuoteSheet } from '@/components/quote-sheet';
import { rawApi } from '@/lib/api';
import { STATUS_LABEL, dateText, type PublicQuote } from '@/lib/quotes';

export const metadata: Metadata = { title: 'Cotización', robots: { index: false, follow: false } };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8';

/** Lo que ve el cliente desde el enlace: la cotización, el PDF y los botones para responder. */
export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const res = await rawApi<PublicQuote>(`/public/quotes/${token}`).catch(() => null);
  if (!res || !res.ok) notFound();
  const q = res.data;
  const answered = ['accepted', 'rejected', 'changes_requested'].includes(q.status);

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[14px] text-muted-foreground">Cotización {q.code}</p>
          <h1 className="font-display text-[28px] font-bold tracking-tight text-foreground sm:text-[34px]">{q.company.name}</h1>
          <p className="text-[14px] text-muted-foreground">{[q.company.city, q.company.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <a
          href={`/cotizacion/${token}/pdf`}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
        >
          Descargar PDF
        </a>
      </header>

      <section className={`${card} mt-8`} aria-label="Cotización">
        <p className="text-[13px] text-muted-foreground">Para {[q.clientName, q.clientCompany].filter(Boolean).join(' · ')}</p>
        <h2 className="mt-1 font-display text-[22px] font-semibold text-foreground">{q.title}</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          {q.sentAt ? `Enviada el ${dateText(q.sentAt)}` : ''}
          {q.validUntil ? ` · Válida hasta el ${dateText(q.validUntil)}` : ''}
        </p>
        <div className="mt-6">
          <QuoteSheet items={q.items} subtotal={q.subtotal} discount={q.discount} taxRate={q.taxRate} tax={q.tax} total={q.total} />
        </div>
        {q.notes ? (
          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <p className="text-[13px] text-muted-foreground">Condiciones y notas</p>
            <p className="mt-1 whitespace-pre-wrap text-[14.5px] text-foreground/90">{q.notes}</p>
          </div>
        ) : null}
      </section>

      <section className={`${card} mt-6`} aria-labelledby="h-responder">
        <h2 id="h-responder" className="font-display text-[19px] font-semibold text-foreground">
          {answered ? 'Tu respuesta' : '¿Qué te parece?'}
        </h2>
        <div className="mt-4">
          {answered ? (
            <p className="text-[15px] text-foreground">
              {STATUS_LABEL[q.status]} por {q.responseName} el {dateText(q.respondedAt!)}.{q.responseMessage ? ` «${q.responseMessage}»` : ''}
            </p>
          ) : q.status === 'draft' ? (
            <p className="text-[15px] text-muted-foreground">La empresa está actualizando esta cotización. Te mandará la nueva versión.</p>
          ) : (
            <>
              {q.expired ? (
                <p className="mb-4 text-[14px] text-[#ffd27a]">Esta cotización venció. Puedes pedir cambios para que te manden una nueva.</p>
              ) : null}
              <QuoteRespond token={token} canAccept={!q.expired} />
            </>
          )}
        </div>
      </section>
      <p className="mt-8 text-center text-[12.5px] text-muted-foreground">Cotización hecha con 3R · 3rpaginas.com</p>
    </main>
  );
}
