import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreateSiteForm, OrderUpdateForm, PublishPanel } from '@/components/admin-forms';
import { MessageForm } from '@/components/message-form';
import { PaymentBadge, StatusBadge, Timeline, card } from '@/components/shop';
import { authedApi } from '@/lib/api';
import { formatDate, formatMoney, orderCode } from '@/lib/orders';
import type { AdminOrderDetail, Brief, PublicationStatus, Template } from '@/lib/types';

export const metadata: Metadata = { title: 'Pedido — Administración 3R' };

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

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await authedApi<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`);
  if (!res.ok) notFound();
  const order = res.data;
  const templates = order.site ? [] : (await authedApi<Template[]>('/templates')).data;
  const publication = order.site ? (await authedApi<PublicationStatus>(`/sites/${order.site.id}/publication`)).data : null;

  return (
    <>
      <Link href="/admin" className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {orderCode(order.orderNumber)} · {formatDate(order.createdAt)}
          </p>
          <h1 className="mt-1 font-display text-[32px] font-bold tracking-tight text-foreground">{order.brief.businessName}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            {order.user.firstName ? `${order.user.firstName} · ` : ''}
            <a href={`mailto:${order.user.email}`} className="text-primary hover:underline">
              {order.user.email}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className={card}>
            <h2 className="font-display text-[20px] font-semibold text-foreground">Lo que pidió</h2>
            <p className="mt-2 text-[14.5px] text-muted-foreground">
              {order.package.name} · {formatMoney(order.priceCents, order.currency)}
              {order.monthlyPriceCents !== null ? ` + ${formatMoney(order.monthlyPriceCents, order.currency)}/mes de mantenimiento` : ' · sin mensualidad'}
            </p>
            <dl className="mt-5 space-y-3 text-[14.5px]">
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

          <section className={card}>
            <h2 className="font-display text-[20px] font-semibold text-foreground">Conversación e historial</h2>
            <div className="mt-5">
              <Timeline events={order.events} viewer="admin" />
            </div>
            <div className="mt-6 border-t border-white/[0.06] pt-6">
              <MessageForm orderId={order.id} admin />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <h2 className="font-display text-[20px] font-semibold text-foreground">Estado y pago</h2>
            <div className="mt-5">
              <OrderUpdateForm order={order} />
            </div>
          </section>

          <section className={card}>
            <h2 className="font-display text-[20px] font-semibold text-foreground">Página del cliente</h2>
            {order.site ? (
              <div className="mt-4 space-y-4">
                <p className="text-[14.5px] text-muted-foreground">
                  Sitio en construcción: <span className="text-foreground">{order.site.name}</span>
                </p>
                <Link
                  href={`/editor/${order.site.id}`}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                >
                  Abrir en el editor
                </Link>
                {publication ? <PublishPanel orderId={order.id} siteId={order.site.id} publication={publication} deliveryUrl={order.deliveryUrl} /> : null}
              </div>
            ) : (
              <div className="mt-4">
                <p className="mb-4 text-[14px] text-muted-foreground">Crea el sitio de este cliente y ábrelo en el editor. El cliente no lo ve hasta que lo entregues.</p>
                <CreateSiteForm orderId={order.id} templates={templates} />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
