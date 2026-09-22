import type { Metadata } from 'next';
import Link from 'next/link';
import { PaymentBadge, StatusBadge } from '@/components/shop';
import { inputClass } from '@/components/field';
import { authedApi } from '@/lib/api';
import { STATUS_DOT, STATUS_LABEL, formatDate, formatMoney, orderCode } from '@/lib/orders';
import type { AdminOrderRow, AdminStats, OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Pedidos — Administración 3R' };

const FILTERS: OrderStatus[] = ['new', 'awaiting_payment', 'in_progress', 'in_review', 'delivered', 'cancelled'];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (q) query.set('q', q);

  const [{ data: orders }, { data: stats }] = await Promise.all([
    authedApi<AdminOrderRow[]>(`/admin/orders?${query}`),
    authedApi<AdminStats>('/admin/stats'),
  ]);

  const filterHref = (next?: string) => {
    const params = new URLSearchParams();
    if (next) params.set('status', next);
    if (q) params.set('q', q);
    const text = params.toString();
    return text ? `/admin?${text}` : '/admin';
  };

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Pedidos</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FILTERS.slice(0, 5).map((key) => (
          <div key={key} className="rounded-[24px] border border-white/[0.08] bg-card p-4 shadow-[var(--shadow-glass)]">
            <dt className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className={`size-2 rounded-full ${STATUS_DOT[key]}`} aria-hidden="true" />
              {STATUS_LABEL[key]}
            </dt>
            <dd className="mt-1 font-display text-[28px] font-bold text-foreground">{stats.counts[key]}</dd>
          </div>
        ))}
        <div className="rounded-[24px] border border-white/[0.08] bg-card p-4 shadow-[var(--shadow-glass)]">
          <dt className="text-[12.5px] text-muted-foreground">Cobrado</dt>
          <dd className="mt-1 font-display text-[28px] font-bold text-foreground">{formatMoney(stats.collectedCents)}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          <Link
            href={filterHref()}
            aria-current={!status ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${!status ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.08] text-muted-foreground hover:text-foreground'}`}
          >
            Todos
          </Link>
          {FILTERS.map((key) => (
            <Link
              key={key}
              href={filterHref(key)}
              aria-current={status === key ? 'page' : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${status === key ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.08] text-muted-foreground hover:text-foreground'}`}
            >
              {STATUS_LABEL[key]}
            </Link>
          ))}
        </nav>
        <form action="/admin" className="flex w-full gap-2 sm:w-auto">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="q" className="sr-only">
            Buscar pedidos
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Correo, negocio o 3R-0001" className={`${inputClass} !py-2 sm:w-[280px]`} />
          <button type="submit" className="rounded-full border border-white/[0.1] px-5 text-[14px] transition hover:bg-white/[0.06]">
            Buscar
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-[32px] border border-dashed border-white/[0.12] px-6 py-14 text-center text-muted-foreground">
          {q || status ? 'No hay pedidos con ese filtro.' : 'Todavía no hay pedidos. Cuando un cliente pida una página, aparecerá aquí.'}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/pedidos/${order.id}`}
                className="grid gap-3 rounded-[24px] border border-white/[0.08] bg-card p-4 shadow-[var(--shadow-glass)] transition duration-300 ease-[var(--ease-emphasized)] hover:-translate-y-0.5 hover:border-white/[0.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] md:grid-cols-[100px_1.5fr_1fr_auto_auto_90px] md:items-center"
              >
                <span className="text-[13px] text-muted-foreground">{orderCode(order.orderNumber)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{order.brief.businessName}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{order.user.email}</span>
                </span>
                <span className="truncate text-[14px] text-muted-foreground">{order.package.name}</span>
                <StatusBadge status={order.status} />
                <PaymentBadge status={order.paymentStatus} />
                <span className="text-[13px] text-muted-foreground md:text-right">{formatDate(order.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
