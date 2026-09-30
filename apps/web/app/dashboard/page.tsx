import type { Metadata } from 'next';
import Link from 'next/link';
import { MoreServices } from '@/components/more-services';
import { PackageGrid } from '@/components/package-grid';
import { PaymentBadge, StatusBadge } from '@/components/shop';
import { WelcomeIntro } from '@/components/welcome-intro';
import { authedApi, rawApi } from '@/lib/api';
import { formatDate, formatMoney, orderCode } from '@/lib/orders';
import type { CurrentUser, OrderSummary, Package } from '@/lib/types';

export const metadata: Metadata = { title: 'Mis pedidos — 3R' };

const primaryLink =
  'inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition duration-300 ease-[var(--ease-emphasized)] hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

async function loadPackages(): Promise<Package[] | null> {
  try {
    const res = await rawApi<Package[]>('/packages');
    return res.ok ? res.data : null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [{ data: orders }, { data: user }, packages] = await Promise.all([
    authedApi<OrderSummary[]>('/orders'),
    authedApi<CurrentUser>('/auth/me'),
    loadPackages(),
  ]);
  const monthly = (packages ?? []).map((p) => p.monthlyPriceCents).filter((c): c is number => c !== null);
  const services = (
    <MoreServices
      monthlyFromCents={monthly.length > 0 ? Math.min(...monthly) : null}
      domainCents={packages?.[0]?.domainAddonCents ?? null}
      currency={packages?.[0]?.currency ?? 'COP'}
    />
  );

  // Sin pedidos: primero se cuenta qué es 3R y por qué le sirve, después los paquetes y los demás servicios.
  if (orders.length === 0) {
    return (
      <div className="space-y-20">
        <WelcomeIntro firstName={user.firstName} />
        <section id="paquetes" aria-labelledby="h-elige" className="scroll-mt-8">
          <h2 id="h-elige" className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-[32px]">
            Elige tu paquete
          </h2>
          <p className="mt-2 max-w-2xl text-[16px] text-muted-foreground">
            Pagas una vez por tu página. Después nos cuentas de tu negocio en un formulario corto y empezamos.
          </p>
          <PackageGrid packages={packages} />
          <p className="mt-6 text-center text-[14px] text-muted-foreground">
            ¿Quieres ver cómo quedan?{' '}
            <Link href="/#trabajos" className="text-primary hover:underline">
              Mira páginas reales que ya entregamos ↗
            </Link>
          </p>
        </section>
        {services}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Mis pedidos</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">{`${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}`}</p>
        </div>
        <Link href="/#paquetes" className={primaryLink}>
          + Pedir otra página
        </Link>
      </div>

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
      <div className="mt-20">{services}</div>
    </>
  );
}
