import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { rawApi } from '@/lib/api';
import { STATUS_LABEL, STATUS_TEXT, cop, orderMessage, waLink, type PublicOrder } from '@/lib/store';

export const metadata: Metadata = { title: 'Tu pedido', robots: { index: false, follow: false } };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
const STEPS = ['new', 'confirmed', 'preparing', 'ready', 'delivered'] as const;

/** Lo que ve el cliente después de pedir: el resumen, el estado y el botón para mandarlo por WhatsApp. */
export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { slug, token } = await params;
  const { nuevo } = await searchParams;
  if (!SLUG.test(slug) || !/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const res = await rawApi<PublicOrder>(`/public/store/${slug}/orders/${token}`).catch(() => null);
  if (!res?.ok) notFound();
  const o = res.data;
  const h = await headers();
  const url = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}/tienda/${slug}/pedido/${token}`;
  const wa = waLink(o.store.whatsapp, orderMessage(o, o.store.name, url));
  const step = o.status === 'on_way' ? 3 : STEPS.indexOf(o.status as (typeof STEPS)[number]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-8 sm:py-14">
      <Link href={`/tienda/${slug}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {o.store.name}
      </Link>
      <header className="mt-4">
        <p className="text-[14px] text-muted-foreground">
          Pedido #{o.number} · {when.format(new Date(o.createdAt))}
        </p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight text-foreground">
          {nuevo ? '¡Recibimos tu pedido!' : STATUS_LABEL[o.status]}
        </h1>
        <p className="mt-2 text-[15.5px] text-foreground/85">
          {nuevo && wa ? 'Envíalo también por WhatsApp para que te atiendan más rápido.' : STATUS_TEXT[o.status]}
        </p>
      </header>

      {o.status !== 'cancelled' ? (
        <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Estado del pedido">
          {STEPS.map((s, i) => (
            <li key={s} className="space-y-1.5">
              <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-white/[0.08]'}`} />
              <span className={`block text-[11.5px] ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s === 'ready' && o.status === 'on_way' ? 'En camino' : STATUS_LABEL[s]}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {wa && o.status !== 'cancelled' ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-6 flex w-full items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium transition ${nuevo ? 'bg-[#25d366] text-[#062b14] hover:brightness-105' : 'border border-white/[0.12] text-foreground hover:bg-white/[0.06]'}`}
        >
          {nuevo ? 'Enviar el pedido por WhatsApp' : 'Escribir por WhatsApp'}
        </a>
      ) : null}

      <section className="mt-6 rounded-[24px] border border-white/[0.08] bg-card p-5" aria-label="Resumen">
        <ul className="divide-y divide-white/[0.06]">
          {o.items.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-2.5 text-[15px]">
              <span className="text-foreground">
                {l.qty} × {l.name}
                {l.variant ? <span className="text-muted-foreground"> ({l.variant})</span> : null}
              </span>
              <span className="text-foreground">{cop(l.line)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-white/[0.08] pt-3 text-[14.5px]">
          {o.discount ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descuento {o.couponCode}</dt>
              <dd className="text-[#9df0c6]">−{cop(o.discount)}</dd>
            </div>
          ) : null}
          {o.delivery === 'delivery' ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Domicilio</dt>
              <dd className="text-foreground">{o.shipping ? cop(o.shipping) : 'Gratis'}</dd>
            </div>
          ) : null}
          <div className="flex justify-between font-display text-[18px] font-semibold">
            <dt className="text-foreground">Total</dt>
            <dd className="text-foreground">{cop(o.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 space-y-1 text-[14.5px] text-foreground/85">
        <p>
          {o.delivery === 'delivery' ? `Domicilio a: ${o.address}` : `Lo recoges en el local${o.store.pickupNote ? `: ${o.store.pickupNote}` : ''}`}
        </p>
        {o.store.paymentNote ? <p className="text-muted-foreground">Pago: {o.store.paymentNote}</p> : null}
        <p className="text-muted-foreground">Guarda este enlace para ver cómo va tu pedido.</p>
      </section>
    </main>
  );
}
