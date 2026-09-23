import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/logo';
import { OrderForm } from '@/components/order-form';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { authedApi, rawApi } from '@/lib/api';
import { formatMoney } from '@/lib/orders';
import type { CurrentUser, Package } from '@/lib/types';

export const metadata: Metadata = { title: 'Pedir mi página — 3R' };

export default async function OrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // El proxy ya exigió sesión; esta llamada confirma que sigue válida.
  await authedApi<CurrentUser>('/auth/me');

  const { data: packages } = await rawApi<Package[]>('/packages');
  const pkg = packages?.find((p) => p.slug === slug);
  if (!pkg) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-4 py-5 sm:px-[34px]">
        <Link href="/" aria-label="3R — Inicio" className="text-foreground">
          <Logo size={38} />
        </Link>
        <Link href="/#paquetes" className="text-[14px] text-muted-foreground transition hover:text-foreground">
          ← Ver otros paquetes
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[760px] px-4 pb-24 pt-4 sm:px-[34px]">
        <p className="text-[12.75px] uppercase tracking-[0.3em] text-muted-foreground">Tu pedido</p>
        <h1 className="mt-3 font-display text-[34px] font-bold tracking-tight text-foreground sm:text-[42px]">{pkg.name}</h1>
        <p className="mt-2 text-[16px] text-muted-foreground">
          {formatMoney(pkg.priceCents, pkg.currency)} pago único
          {pkg.deliveryDays ? ` · entrega en ${pkg.deliveryDays} días hábiles` : ''}. Cuéntanos de tu negocio para empezar.
        </p>
        <div className="mt-8">
          <OrderForm pkg={pkg} />
        </div>
      </main>
      <WhatsAppButton />
    </div>
  );
}
