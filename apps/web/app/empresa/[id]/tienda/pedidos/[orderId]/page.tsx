import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateOrderAction } from '@/app/empresa/store-actions';
import { authedApi } from '@/lib/api';
import { STATUS_LABEL, STATUS_TONE, cop, waLink, waNumber, type Order, type OrderStatus } from '@/lib/store';
import { loadCompany } from '../../../company';
import { storeGate } from '../../store-gate';

export const metadata: Metadata = { title: 'Pedido — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
/** El siguiente paso natural de cada estado. */
const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  new: ['confirmed'],
  confirmed: ['preparing'],
  preparing: ['ready', 'on_way'],
  ready: ['delivered'],
  on_way: ['delivered'],
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirmar',
  preparing: 'Empezar a preparar',
  ready: 'Está listo para recoger',
  on_way: 'Salió el domicilio',
  delivered: 'Entregado',
};

export default async function StoreOrderPage({ params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id, orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const res = await authedApi<Order>(`/companies/${id}/store/orders/${orderId}`);
  if (!res.ok) notFound();
  const o = res.data;
  const h = await headers();
  const publicUrl = o.slug ? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}/tienda/${o.slug}/pedido/${o.publicToken}` : null;
  const toClient = waLink(
    waNumber(o.customerPhone),
    `Hola ${o.customerName}, te escribimos de ${company.name} por tu pedido #${o.number}.${publicUrl ? ` Puedes ver cómo va aquí: ${publicUrl}` : ''}`,
  );
  // Al recoger, de preparación pasa a «Listo»; con domicilio, a «En camino».
  const next = (NEXT[o.status] ?? []).filter((s) => (o.delivery === 'pickup' ? s !== 'on_way' : s !== 'ready'));
  const hidden = (
    <>
      <input type="hidden" name="companyId" value={id} />
      <input type="hidden" name="orderId" value={o.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/tienda`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Pedidos
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[14px] text-muted-foreground">{when.format(new Date(o.createdAt))}</p>
          <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">
            Pedido #{o.number} · {o.customerName}
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[13.5px] ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6">
          <section className={card} aria-label="Productos">
            <ul className="divide-y divide-white/[0.06]">
              {o.items.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5 text-[15px]">
                  <span className="text-foreground">
                    <strong>{l.qty} ×</strong> {l.name}
                    {l.variant ? <span className="text-muted-foreground"> ({l.variant})</span> : null}
                    <span className="block text-[12.5px] text-muted-foreground">{cop(l.unit)} c/u</span>
                  </span>
                  <span className="text-foreground">{cop(l.line)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-white/[0.08] pt-3 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-foreground">{cop(o.subtotal)}</dd>
              </div>
              {o.discount ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cupón {o.couponCode}</dt>
                  <dd className="text-[#9df0c6]">−{cop(o.discount)}</dd>
                </div>
              ) : null}
              {o.delivery === 'delivery' ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Domicilio</dt>
                  <dd className="text-foreground">{o.shipping ? cop(o.shipping) : 'Gratis'}</dd>
                </div>
              ) : null}
              <div className="flex justify-between font-display text-[19px] font-semibold">
                <dt className="text-foreground">Total</dt>
                <dd className="text-foreground">{cop(o.total)}</dd>
              </div>
            </dl>
          </section>
          <section className={card} aria-label="Cliente">
            <dl className="grid gap-3 text-[14.5px] sm:grid-cols-2">
              <div>
                <dt className="text-[12.5px] text-muted-foreground">Celular</dt>
                <dd className="text-foreground">{o.customerPhone}</dd>
              </div>
              {o.customerEmail ? (
                <div>
                  <dt className="text-[12.5px] text-muted-foreground">Correo</dt>
                  <dd className="break-all text-foreground">{o.customerEmail}</dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-[12.5px] text-muted-foreground">Entrega</dt>
                <dd className="text-foreground">{o.delivery === 'delivery' ? `Domicilio a ${o.address}` : 'Recoge en el local'}</dd>
              </div>
              {o.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-[12.5px] text-muted-foreground">Notas del cliente</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{o.notes}</dd>
                </div>
              ) : null}
            </dl>
            {toClient ? (
              <a
                href={toClient}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]"
              >
                Escribirle por WhatsApp
              </a>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          {o.status !== 'cancelled' ? (
            <section className={card} aria-labelledby="h-avanzar">
              <h3 id="h-avanzar" className="mb-4 font-display text-[18px] font-semibold text-foreground">
                {o.status === 'delivered' ? 'Pedido entregado' : 'Siguiente paso'}
              </h3>
              <div className="flex flex-col gap-2">
                {next.map((st) => (
                  <form key={st} action={updateOrderAction}>
                    {hidden}
                    <input type="hidden" name="status" value={st} />
                    <button
                      type="submit"
                      className="w-full rounded-full bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                    >
                      {NEXT_LABEL[st]}
                    </button>
                  </form>
                ))}
                <form action={updateOrderAction}>
                  {hidden}
                  <input type="hidden" name="paid" value={o.paid ? 'false' : 'true'} />
                  <button
                    type="submit"
                    className="w-full rounded-full border border-white/[0.12] px-4 py-2.5 text-[14px] text-foreground hover:bg-white/[0.06]"
                  >
                    {o.paid ? 'Marcar como no pagado' : 'Marcar como pagado'}
                  </button>
                </form>
              </div>
              <p className="mt-3 text-[13px] text-muted-foreground">
                {o.paid ? 'Pagado.' : 'Todavía sin pagar.'} El cliente ve el estado en su enlace.
              </p>
            </section>
          ) : null}
          <section className={card} aria-labelledby="h-nota">
            <h3 id="h-nota" className="mb-3 font-display text-[17px] font-semibold text-foreground">
              Nota interna
            </h3>
            <form action={updateOrderAction} className="space-y-3">
              {hidden}
              <textarea
                name="staffNote"
                rows={3}
                maxLength={1000}
                defaultValue={o.staffNote ?? ''}
                aria-label="Nota interna"
                placeholder="Solo la ve el equipo"
                className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14.5px] text-foreground focus:border-primary/60 focus:outline-none"
              />
              <button type="submit" className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]">
                Guardar nota
              </button>
            </form>
          </section>
          {o.status !== 'cancelled' && o.status !== 'delivered' ? (
            <form action={updateOrderAction}>
              {hidden}
              <input type="hidden" name="status" value="cancelled" />
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Cancelar el pedido (devuelve las existencias)
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
