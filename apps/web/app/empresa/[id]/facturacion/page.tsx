import type { Metadata } from 'next';
import { PayInvoiceButton } from '@/components/billing-forms';
import { InvoiceList } from '@/components/invoice-list';
import { Alert } from '@/components/shop';
import { whatsappLink } from '@/components/whatsapp-button';
import { authedApi } from '@/lib/api';
import { SUBSCRIPTION_LABEL, dateText, pesos, type BillingOverview } from '@/lib/billing';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Plan y facturación — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
// Mismos datos de transferencia que los pedidos (variable de la web, sin tocar código).
const PAYMENT_INSTRUCTIONS = process.env.PAYMENT_INSTRUCTIONS ?? 'Escríbenos por WhatsApp y te enviamos los datos para pagar por transferencia.';

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pago?: string; factura?: string; id?: string }>;
}) {
  const { id } = await params;
  const { pago, factura, id: transactionId } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!atLeast(company.me.role, 'admin')) {
    return <p className="text-[15px] text-muted-foreground">El plan y las facturas los ven el dueño y los administradores de la empresa.</p>;
  }
  // Al volver de Wompi se confirma el pago antes de mostrar las facturas.
  let paid: string | null = null;
  if (pago === 'wompi' && factura && transactionId && /^[0-9a-f-]{36}$/i.test(factura)) {
    const r = await authedApi<{ status?: string }>(`/companies/${id}/billing/invoices/${factura}/wompi/confirm`, {
      method: 'POST',
      body: { transactionId },
    });
    paid = r.ok ? (r.data.status ?? null) : 'error';
  }
  const { data } = await authedApi<BillingOverview>(`/companies/${id}/billing`);
  const pending = data.invoices.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-6">
      {paid === 'approved' ? <Alert tone="ok">¡Pago recibido! Gracias.</Alert> : null}
      {paid && paid !== 'approved' ? (
        <Alert>
          {paid === 'pending' ? 'Tu pago está en proceso. Lo verás aquí en unos minutos.' : 'El pago no se completó. Puedes intentarlo otra vez.'}
        </Alert>
      ) : null}

      <section className={card} aria-labelledby="h-plan">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="h-plan" className="font-display text-[20px] font-semibold text-foreground">
              Tu plan
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {data.subscription
                ? `${SUBSCRIPTION_LABEL[data.subscription.status]}${data.subscription.status === 'trial' && data.subscription.trialEndsAt ? ` hasta el ${dateText(data.subscription.trialEndsAt)}` : ''} · se factura el día ${data.subscription.billingDay} de cada mes`
                : 'Todavía no tienes un plan con cobro mensual. Te contamos cuando lo activemos.'}
            </p>
          </div>
          <p className="font-display text-[26px] font-bold tracking-tight text-foreground">
            {pesos(data.plan.total)}
            <span className="text-[14px] font-normal text-muted-foreground"> /mes</span>
          </p>
        </div>
        {data.plan.items.length ? (
          <ul className="mt-5 divide-y divide-white/[0.06] text-[14.5px]">
            {data.plan.items.map((i) => (
              <li key={i.key} className="flex justify-between gap-3 py-2.5">
                <span className="text-foreground">{i.name}</span>
                <span className="text-foreground">{pesos(i.price)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-[13px] text-muted-foreground">
          ¿Quieres activar o quitar un módulo?{' '}
          <a
            href={whatsappLink(`Hola, quiero cambiar el plan de ${company.name}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Escríbenos por WhatsApp
          </a>
          .
        </p>
      </section>

      {pending.length ? (
        <section className={card} aria-labelledby="h-pagar">
          <h2 id="h-pagar" className="font-display text-[18px] font-semibold text-foreground">
            Cómo pagar
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-foreground/90">{PAYMENT_INSTRUCTIONS}</p>
          {data.onlinePayment ? (
            <p className="mt-2 text-[14px] text-muted-foreground">O paga en línea con tarjeta, PSE o Nequi con el botón de cada factura.</p>
          ) : null}
        </section>
      ) : null}

      <section className={card} aria-labelledby="h-facturas">
        <h2 id="h-facturas" className="mb-2 font-display text-[18px] font-semibold text-foreground">
          Facturas
        </h2>
        <InvoiceList
          invoices={data.invoices}
          actions={(i) => (i.status === 'pending' && data.onlinePayment ? <PayInvoiceButton companyId={id} invoiceId={i.id} /> : null)}
        />
      </section>
    </div>
  );
}
