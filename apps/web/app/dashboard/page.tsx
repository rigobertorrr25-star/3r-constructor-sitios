import type { Metadata } from 'next';
import Link from 'next/link';
import { DevicesIcon, PointerIcon, TemplateIcon } from '@/components/icons';
import { PaymentBadge, StatusBadge } from '@/components/shop';
import { authedApi } from '@/lib/api';
import { formatDate, formatMoney, orderCode } from '@/lib/orders';
import type { OrderSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Mis pedidos — 3R' };

const primaryLink =
  'inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition duration-300 ease-[var(--ease-emphasized)] hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

const steps = [
  { icon: <TemplateIcon />, title: 'Eliges tu paquete', text: 'Comparas lo que incluye cada uno y escoges el que va con tu negocio.' },
  { icon: <PointerIcon />, title: 'Nos cuentas de tu negocio', text: 'Un formulario corto: a qué te dedicas y cómo te gustaría verte.' },
  { icon: <DevicesIcon />, title: 'Recibes tu página', text: 'La diseñamos y construimos. La sigues aquí mismo hasta que esté lista.' },
];

export default async function DashboardPage() {
  const { data: orders } = await authedApi<OrderSummary[]>('/orders');

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Mis pedidos</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {orders.length === 0 ? 'Aún no has pedido ninguna página.' : `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`}
          </p>
        </div>
        <Link href="/#paquetes" className={primaryLink}>
          + Pedir una página
        </Link>
      </div>

      {orders.length === 0 ? (
        <>
          <div className="mt-10 rounded-[32px] border border-dashed border-white/[0.12] px-6 py-16 text-center">
            <p className="font-display text-xl font-semibold text-foreground">Pide tu primera página</p>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
              Elige un paquete, cuéntanos de tu negocio y nosotros nos encargamos del resto.
            </p>
            <Link href="/#paquetes" className={`${primaryLink} mt-6`}>
              Ver paquetes
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-[17px] sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-[24px] border border-white/[0.08] bg-card p-5 shadow-[var(--shadow-glass)]">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">{step.icon}</span>
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Paso {i + 1}</p>
                <h3 className="mt-1 font-display text-[17px] font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[14px] text-muted-foreground">
            ¿Todavía con dudas?{' '}
            <Link href="/#trabajos" className="text-primary hover:underline">
              Mira páginas reales que ya entregamos ↗
            </Link>
          </p>
        </>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/dashboard/pedidos/${order.id}`}
                className="flex flex-col gap-4 rounded-[28px] border border-white/[0.08] bg-card p-5 shadow-[var(--shadow-glass)] transition duration-300 ease-[var(--ease-emphasized)] hover:-translate-y-0.5 hover:border-white/[0.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-muted-foreground">
                    {orderCode(order.orderNumber)} · {formatDate(order.createdAt)}
                  </p>
                  <h2 className="mt-0.5 truncate font-display text-[20px] font-semibold text-foreground">{order.package.name}</h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">{formatMoney(order.priceCents, order.currency)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <PaymentBadge status={order.paymentStatus} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
