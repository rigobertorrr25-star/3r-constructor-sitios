import type { Metadata } from 'next';
import Link from 'next/link';
import { StoreTabs } from '@/components/store-tabs';
import { authedApi } from '@/lib/api';
import { OPEN_STATUSES, STATUS_LABEL, STATUS_TONE, cop, type OrderList, type SettingsResponse } from '@/lib/store';
import { loadCompany } from '../company';
import { storeGate } from './store-gate';

export const metadata: Metadata = { title: 'Tienda — 3R' };

const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

export default async function StoreOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status = 'open' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const [{ data: s }, { data }] = await Promise.all([
    authedApi<SettingsResponse>(`/companies/${id}/store/settings`),
    authedApi<OrderList>(`/companies/${id}/store/orders?status=${encodeURIComponent(status)}`),
  ]);
  const base = `/empresa/${id}/tienda`;
  const open = OPEN_STATUSES.reduce((n, st) => n + (data.counts[st] ?? 0), 0);

  return (
    <div className="space-y-6">
      <StoreTabs companyId={id} active="" />
      {!s.settings ? (
        <section className="rounded-[28px] border border-primary/30 bg-primary/[0.07] p-6">
          <h2 className="font-display text-[19px] font-semibold text-foreground">Crea tu tienda</h2>
          <p className="mt-1 text-[14.5px] text-foreground/85">
            Ponle nombre, dirección y cómo entregas. Después agregas los productos y compartes el enlace.
          </p>
          {s.canEdit ? (
            <Link
              href={`${base}/ajustes`}
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground"
            >
              Empezar
            </Link>
          ) : (
            <p className="mt-3 text-[13.5px] text-muted-foreground">Pídele a un administrador de la empresa que la cree.</p>
          )}
        </section>
      ) : null}
      <nav aria-label="Estado de los pedidos" className="flex flex-wrap gap-2">
        <Link href={base} className={chip(status === 'open')}>
          Por atender <span className="text-muted-foreground">{open}</span>
        </Link>
        {(['delivered', 'cancelled'] as const).map((st) => (
          <Link key={st} href={`${base}?status=${st}`} className={chip(status === st)}>
            {STATUS_LABEL[st]}s <span className="text-muted-foreground">{data.counts[st] ?? 0}</span>
          </Link>
        ))}
        <Link href={`${base}?status=all`} className={chip(status === 'all')}>
          Todos
        </Link>
      </nav>
      {data.orders.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {status === 'open' ? 'No hay pedidos por atender.' : 'No hay pedidos aquí.'}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {data.orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`${base}/pedidos/${o.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-foreground">
                    #{o.number} · {o.customerName}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {[
                      when.format(new Date(o.createdAt)),
                      o.delivery === 'delivery' ? 'Domicilio' : 'Recoge',
                      `${o.items.reduce((n, l) => n + l.qty, 0)} productos`,
                    ].join(' · ')}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display text-[16px] font-semibold text-foreground">{cop(o.total)}</span>
                  {o.paid ? <span className="text-[12px] text-[#9df0c6]">Pagado</span> : null}
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[12.5px] ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
