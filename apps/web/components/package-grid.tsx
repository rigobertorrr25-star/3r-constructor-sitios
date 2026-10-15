// Los paquetes con su precio y el botón para pedir. Lo usan la portada y la cuenta del cliente, así los dos
// muestran siempre lo mismo.
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';
import { Reveal } from '@/components/reveal';
import { SpotlightCard } from '@/components/spotlight-card';
import { formatMoney } from '@/lib/orders';
import type { Package } from '@/lib/types';

const pill =
  'inline-flex items-center justify-center gap-2 rounded-full px-[25.5px] py-[12.75px] text-[14.875px] transition duration-300 ease-[var(--ease-emphasized)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export function PackageGrid({ packages }: { packages: Package[] | null }) {
  return (
    <>
      {packages === null ? (
        <p className="mt-10 rounded-[32px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          No pudimos cargar los paquetes en este momento. Inténtalo de nuevo en unos minutos.
        </p>
      ) : packages.length === 0 ? (
        <p className="mt-10 rounded-[32px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Pronto publicaremos nuestros paquetes.
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-[17px] lg:grid-cols-3">
          {packages.map((pkg, i) => (
            <Reveal as="li" key={pkg.id} delayMs={i * 110} className="h-full">
              <SpotlightCard
                className={`relative flex h-full flex-col rounded-[32px] border bg-card p-[26px] shadow-[var(--shadow-glass)] transition duration-300 ease-[var(--ease-emphasized)] hover:-translate-y-1 ${
                  pkg.isFeatured ? 'pulse-glow border-primary/60' : 'border-white/[0.08] hover:border-white/[0.18]'
                }`}
              >
                {pkg.isFeatured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-[12px] font-semibold text-primary-foreground">
                    Más elegido
                  </span>
                ) : null}
                <h3 className="font-display text-[22px] font-semibold text-foreground">{pkg.name}</h3>
                {pkg.tagline ? <p className="mt-1 text-[14.5px] text-muted-foreground">{pkg.tagline}</p> : null}
                <p className="mt-6 font-display text-[38px] font-bold leading-none tracking-tight text-foreground sm:text-[42px]">
                  {formatMoney(pkg.priceCents, pkg.currency)}
                </p>
                <p className="mt-1.5 text-[13.5px] text-muted-foreground">pago único</p>
                {pkg.monthlyPriceCents !== null ? (
                  <p className="mt-3 rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-muted-foreground">
                    + <span className="text-foreground">{formatMoney(pkg.monthlyPriceCents, pkg.currency)}/mes</span> hosting y mantenimiento
                    (opcional)
                  </p>
                ) : null}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-foreground/90">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/pedir/${pkg.slug}`}
                  className={`${pill} shine mt-8 ${pkg.isFeatured ? 'bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]' : 'border border-white/[0.12] hover:bg-white/[0.06]'}`}
                >
                  Pedir este paquete
                  <ArrowRightIcon />
                </Link>
              </SpotlightCard>
            </Reveal>
          ))}
        </ul>
      )}
    </>
  );
}
