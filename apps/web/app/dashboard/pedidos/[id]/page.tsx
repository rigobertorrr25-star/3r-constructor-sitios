import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CancelOrderButton } from '@/components/cancel-order-button';
import { MessageForm } from '@/components/message-form';
import { Alert, PaymentBadge, Progress, StatusBadge, Timeline, card } from '@/components/shop';
import { authedApi } from '@/lib/api';
import { formatDate, formatMoney, orderCode } from '@/lib/orders';
import type { Brief, OrderDetail } from '@/lib/types';

export const metadata: Metadata = { title: 'Mi pedido — 3R' };

// Cómo se paga se configura con PAYMENT_INSTRUCTIONS (en el servidor de la web), sin tocar código.
const PAYMENT_INSTRUCTIONS =
  process.env.PAYMENT_INSTRUCTIONS ??
  'Te escribiremos por este mismo pedido para coordinar el pago. Empezamos a trabajar en cuanto se confirma.';

const BRIEF_LABELS: [keyof Brief, string][] = [
  ['businessName', 'Negocio'],
  ['businessType', 'Rubro'],
  ['description', 'Descripción'],
  ['city', 'Ciudad'],
  ['phone', 'Teléfono'],
  ['domainWanted', 'Dominio'],
  ['pagesWanted', 'Secciones'],
  ['styleNotes', 'Estilo'],
  ['references', 'Referencias'],
  ['extra', 'Notas'],
];

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  const res = await authedApi<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
  if (!res.ok) notFound();
  const order = res.data;

  const pending = Math.max(0, order.priceCents - order.amountPaidCents);
  const canCancel = (order.status === 'new' || order.status === 'awaiting_payment') && order.paymentStatus === 'unpaid';
  const showPayment = order.status !== 'cancelled' && order.paymentStatus !== 'paid';

  return (
    <div className="max-w-[860px]">
      <Link href="/dashboard" className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Mis pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {orderCode(order.orderNumber)} · {formatDate(order.createdAt)}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-bold tracking-tight text-foreground">{order.package.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>

      {nuevo ? (
        <div className="mt-6">
          <Alert tone="ok">¡Recibimos tu pedido! Abajo ves cómo pagar y el avance. Puedes escribirnos aquí cuando quieras.</Alert>
        </div>
      ) : null}

      <div className="mt-8">
        <Progress status={order.status} />
      </div>

      {order.status === 'delivered' && order.deliveryUrl ? (
        <section className={`${card} mt-8 border-[#5ee0a0]/30`}>
          <h2 className="font-display text-[20px] font-semibold text-foreground">¡Tu página está lista!</h2>
          <a
            href={order.deliveryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block break-all text-[16px] text-primary hover:underline"
          >
            {order.deliveryUrl}
          </a>
        </section>
      ) : null}

      <section className={`${card} mt-8`}>
        <h2 className="font-display text-[20px] font-semibold text-foreground">Pago</h2>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-[14px]">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="mt-1 font-display text-[20px] font-semibold text-foreground">{formatMoney(order.priceCents, order.currency)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Recibido</dt>
            <dd className="mt-1 font-display text-[20px] font-semibold text-foreground">{formatMoney(order.amountPaidCents, order.currency)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pendiente</dt>
            <dd className="mt-1 font-display text-[20px] font-semibold text-foreground">{formatMoney(pending, order.currency)}</dd>
          </div>
        </dl>
        {order.monthlyPriceCents !== null ? (
          <p className="mt-4 text-[14px] text-muted-foreground">
            Incluye hosting y mantenimiento: {formatMoney(order.monthlyPriceCents, order.currency)} al mes.
          </p>
        ) : null}
        {showPayment ? (
          <p className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-[14.5px] leading-relaxed text-foreground/90">{PAYMENT_INSTRUCTIONS}</p>
        ) : null}
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-display text-[20px] font-semibold text-foreground">Lo que nos contaste</h2>
        <dl className="mt-4 space-y-3 text-[14.5px]">
          {BRIEF_LABELS.map(([key, label]) => {
            const value = order.brief[key];
            if (value === undefined || value === '') return null;
            return (
              <div key={key} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap break-words text-foreground">{String(value)}</dd>
              </div>
            );
          })}
          {order.brief.hasDomain !== undefined ? (
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <dt className="text-muted-foreground">¿Tiene dominio?</dt>
              <dd className="text-foreground">{order.brief.hasDomain ? 'Sí' : 'No'}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-display text-[20px] font-semibold text-foreground">Conversación</h2>
        <div className="mt-5">
          <Timeline events={order.events} viewer="client" />
        </div>
        {order.status !== 'cancelled' ? (
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <MessageForm orderId={order.id} />
          </div>
        ) : null}
      </section>

      {canCancel ? (
        <div className="mt-6 flex justify-end">
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </div>
  );
}
