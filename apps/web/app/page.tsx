import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  ChatIcon,
  DevicesIcon,
  GlobeIcon,
  HistoryIcon,
  PointerIcon,
  ShoppingBagIcon,
  TemplateIcon,
  UtensilsIcon,
} from '@/components/icons';
import { Logo } from '@/components/logo';
import { MascotGreeter } from '@/components/mascot-greeter';
import { Reveal } from '@/components/reveal';
import { SpotlightCard } from '@/components/spotlight-card';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { currentUserOrNull, rawApi } from '@/lib/api';
import { formatMoney } from '@/lib/orders';
import type { CurrentUser, Package, PortfolioItem } from '@/lib/types';

const steps = [
  { n: '1', title: 'Elige tu paquete', text: 'Compara lo que incluye cada uno y escoge el que va con tu negocio.' },
  { n: '2', title: 'Cuéntanos de tu negocio', text: 'Llenas un formulario corto: a qué te dedicas, qué quieres mostrar y cómo te gustaría verte.' },
  { n: '3', title: 'Recibe tu página', text: 'Nosotros la diseñamos y la construimos. Sigues el avance desde tu cuenta y pides cambios cuando quieras.' },
];

const industries: { hue: number; icon: ReactNode; title: string; text: string }[] = [
  { hue: 25, icon: <UtensilsIcon />, title: 'Restaurantes y cafés', text: 'Tu menú, fotos de tus platos, ubicación y un botón directo a WhatsApp para pedidos y reservas.' },
  { hue: 150, icon: <ShoppingBagIcon />, title: 'Tiendas y negocios locales', text: 'Muestra tu catálogo con fotos y precios, y deja que te escriban por WhatsApp para comprar.' },
  { hue: 275, icon: <ChatIcon />, title: 'Servicios y profesionales', text: 'Cuenta qué haces, muestra tu trabajo y facilita que te agenden una cita o te escriban.' },
];

const includes: { hue: number; icon: ReactNode; title: string; text: string }[] = [
  { hue: 150, icon: <TemplateIcon />, title: 'Diseño a tu medida', text: 'Con tus colores, tu logo y tus textos. No es una plantilla genérica.' },
  { hue: 275, icon: <DevicesIcon />, title: 'Celular y computadora', text: 'Tu página se ve bien en cualquier pantalla, desde el primer día.' },
  { hue: 88, icon: <GlobeIcon />, title: 'Dominio y hosting', text: 'Te ayudamos a conectar tu dominio. Hosting y mantenimiento son opcionales.' },
  { hue: 200, icon: <PointerIcon />, title: 'Tú no tocas nada técnico', text: 'Nosotros nos encargamos de todo. Tú solo revisas y apruebas.' },
  { hue: 25, icon: <HistoryIcon />, title: 'Seguimiento de tu pedido', text: 'Ves en qué etapa va tu página y hablas con nosotros desde tu cuenta.' },
];

const faqs = [
  { q: '¿Cuánto tarda mi página?', a: 'Depende del paquete: cada uno muestra sus días de entrega. Empezamos a trabajar cuando se confirma el pago.' },
  { q: '¿Cómo pago?', a: 'Al enviar tu pedido te explicamos cómo pagar. No pagas en el momento de pedir.' },
  { q: '¿Qué es la mensualidad?', a: 'Es opcional: mantiene tu página en línea y cubre soporte y pequeños cambios. Puedes decidirlo al pedir o después.' },
  { q: '¿Puedo pedir cambios?', a: 'Sí. Desde tu pedido nos escribes lo que quieras ajustar y lo vemos contigo.' },
  { q: '¿Necesito tener un dominio?', a: 'No. Si todavía no tienes uno, te ayudamos a elegirlo y conectarlo.' },
];

const pill =
  'inline-flex items-center justify-center gap-2 rounded-full px-[25.5px] py-[12.75px] text-[14.875px] transition duration-300 ease-[var(--ease-emphasized)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';
const card = 'rounded-[32px] border border-white/[0.08] bg-card shadow-[var(--shadow-glass)]';

async function loadPortfolio(): Promise<PortfolioItem[]> {
  try {
    const res = await rawApi<PortfolioItem[]>('/portfolio');
    return res.ok ? res.data : [];
  } catch {
    return [];
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www./, '');
  } catch {
    return url;
  }
};

async function loadPackages(): Promise<Package[] | null> {
  try {
    const res = await rawApi<Package[]>('/packages');
    return res.ok ? res.data : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [packages, portfolio, user] = await Promise.all([loadPackages(), loadPortfolio(), currentUserOrNull<CurrentUser>()]);
  const isStaff = user?.roles.includes('ADMIN') || user?.roles.includes('SUPER_ADMIN');

  const prices = (packages ?? []).map((p) => p.priceCents / 100);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: '3R',
    description: 'Diseño y construcción de páginas web a medida para negocios pequeños en Colombia.',
    url: 'https://3rpaginas.com',
    telephone: '+573107907194',
    areaServed: 'CO',
    ...(prices.length > 0 ? { priceRange: `${Math.min(...prices)}-${Math.max(...prices)} COP` } : {}),
  };

  return (
    <div className="min-h-screen overflow-x-clip" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1224px] items-center justify-between px-4 py-5 sm:px-[34px]">
          <Link href="/" aria-label="3R — Inicio" className="text-foreground">
            <Logo size={38} />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
            <a href="#como-funciona" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Cómo funciona
            </a>
            {portfolio.length > 0 ? (
              <a href="#trabajos" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
                Trabajos
              </a>
            ) : null}
            <a href="#paquetes" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Paquetes
            </a>
            <a href="#preguntas" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Preguntas
            </a>
            {user ? (
              <Link
                href={isStaff ? '/admin' : '/dashboard'}
                className="rounded-full border border-white/[0.08] bg-white/[0.014] px-[17px] py-[8.5px] text-[14.875px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {isStaff ? 'Administración' : 'Mi cuenta'}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-white/[0.08] bg-white/[0.014] px-[17px] py-[8.5px] text-[14.875px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Iniciar sesión
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="orb orb-a absolute -top-20 right-[-6%] size-[380px] bg-primary/25 sm:size-[460px]" />
            <span className="orb orb-b absolute bottom-[-14%] left-[-8%] size-[340px] bg-secondary/15 sm:size-[420px]" />
            <div className="absolute right-[-14%] top-1/2 hidden w-[640px] -translate-y-1/2 opacity-80 mix-blend-screen lg:block orb-a">
              <Image src="/hero-aurora.png" alt="" width={1344} height={576} priority className="h-auto w-full" style={{ maskImage: 'radial-gradient(closest-side, black 55%, transparent 90%)', WebkitMaskImage: 'radial-gradient(closest-side, black 55%, transparent 90%)' }} />
            </div>
          </div>

          <div className="relative mx-auto flex max-w-[816px] flex-col items-center px-4 pb-20 pt-12 text-center sm:pt-[68px] md:pb-28">
            <p className="rise text-[12.75px] uppercase tracking-[0.3em] text-muted-foreground">Páginas web para negocios</p>
            <h1
              className="rise mt-6 font-display font-bold tracking-[-0.025em] text-foreground"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 3.984rem)', lineHeight: 1.25, animationDelay: '80ms' }}
            >
              Tu página web <span className="text-spectrum">profesional</span>,
              <br />
              hecha por nosotros
            </h1>
            <p className="rise mt-6 max-w-[612px] text-[17px] leading-[1.55] text-muted-foreground sm:text-[19px]" style={{ animationDelay: '160ms' }}>
              Tú nos cuentas de tu negocio. Nosotros diseñamos, construimos y publicamos tu página. Sin complicarte con nada técnico.
            </p>
            <div className="rise mt-10 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '240ms' }}>
              <a href="#paquetes" className={`${pill} shine bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}>
                Ver paquetes
                <ArrowRightIcon />
              </a>
              <a href="#como-funciona" className={`${pill} border border-white/[0.08] bg-white/[0.014] hover:bg-white/[0.06]`}>
                Cómo funciona
              </a>
            </div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="h-como" className="mx-auto max-w-[1224px] scroll-mt-8 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-como" className="text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Así de fácil
            </h2>
          </Reveal>
          <ol className="relative mt-8 grid grid-cols-1 gap-[17px] md:grid-cols-3">
            <span
              aria-hidden="true"
              className="absolute top-[47px] left-[16.5%] right-[16.5%] hidden h-px md:block"
              style={{ backgroundImage: 'var(--gradient-spectrum)', opacity: 0.35 }}
            />
            {steps.map((step, i) => (
              <Reveal as="li" key={step.n} delayMs={i * 110}>
                <SpotlightCard className={`${card} block h-full p-[26px]`}>
                  <span className="relative flex size-[43px] items-center justify-center rounded-full bg-primary/15 font-display text-[18px] font-bold text-primary">
                    {step.n}
                  </span>
                  <h3 className="mt-5 font-display text-[21px] font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{step.text}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </ol>
        </section>

        <section aria-labelledby="h-negocios" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-negocios" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
              Hacemos páginas para tu tipo de negocio
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">Cada negocio necesita mostrar algo distinto. Así lo resolvemos según el tuyo.</p>
          </Reveal>
          <ul className="mt-10 grid grid-cols-1 gap-[17px] lg:grid-cols-3">
            {industries.map((item, i) => (
              <Reveal as="li" key={item.title} delayMs={i * 100}>
                <SpotlightCard className={`${card} group block h-full p-[26px] transition duration-300 hover:-translate-y-1 hover:border-white/[0.18]`}>
                  <span
                    className="flex size-[43px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `oklch(0.3 0.12 ${item.hue} / 0.5)`, color: `oklch(0.92 0.08 ${item.hue})` }}
                  >
                    {item.icon}
                  </span>
                  <h3 className="mt-5 font-display text-[21px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{item.text}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </ul>
        </section>

        {portfolio.length > 0 ? (
          <section id="trabajos" aria-labelledby="h-trabajos" className="mx-auto max-w-[1224px] scroll-mt-8 px-4 pb-24 sm:px-[34px]">
            <Reveal>
              <h2 id="h-trabajos" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
                Algunos de nuestros trabajos
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">Páginas reales de negocios reales. Haz clic para verlas en línea.</p>
            </Reveal>
            <ul className="mt-10 grid grid-cols-1 gap-[17px] sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.map((item, i) => (
                <Reveal as="li" key={item.id} delayMs={i * 90}>
                  <SpotlightCard
                    as="a"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-[32px] border border-white/[0.08] bg-card shadow-[var(--shadow-glass)] transition duration-300 ease-[var(--ease-emphasized)] hover:-translate-y-1 hover:border-white/[0.18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    <div className="aspect-[16/10] overflow-hidden bg-[#0a131a]">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnailUrl} alt={`Captura de ${item.title}`} loading="lazy" className="size-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-[radial-gradient(ellipse_at_top_right,#8a9bff40,transparent_60%),radial-gradient(ellipse_at_bottom_left,#ff86db2b,transparent_60%)] px-6 text-center font-display text-[20px] font-semibold text-foreground/90">
                          {hostOf(item.url)}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      {item.category ? <p className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">{item.category}</p> : null}
                      <h3 className="mt-1 font-display text-[20px] font-semibold text-foreground">{item.title}</h3>
                      {item.description ? <p className="mt-1 text-[14.5px] leading-snug text-muted-foreground">{item.description}</p> : null}
                      <p className="mt-3 text-[14px] text-primary transition-transform duration-300 group-hover:translate-x-1">
                        Ver página <span aria-hidden="true">↗</span>
                      </p>
                    </div>
                  </SpotlightCard>
                </Reveal>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="paquetes" aria-labelledby="h-paquetes" className="mx-auto max-w-[1224px] scroll-mt-8 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-paquetes" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
              Elige tu paquete
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">
              Pagas una vez por tu página. La mensualidad de hosting y mantenimiento es opcional.
            </p>
          </Reveal>

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
                        + <span className="text-foreground">{formatMoney(pkg.monthlyPriceCents, pkg.currency)}/mes</span> hosting y mantenimiento (opcional)
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
        </section>

        <section aria-labelledby="h-incluye" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-incluye" className="text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Con todos los paquetes
            </h2>
          </Reveal>
          <ul className="mt-8 grid grid-cols-1 gap-[17px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {includes.map((item, i) => (
              <Reveal as="li" key={item.title} delayMs={i * 80}>
                <SpotlightCard className={`${card} group block h-full p-[22px] transition duration-300 hover:-translate-y-1 hover:border-white/[0.18]`}>
                  <span
                    className="flex size-[43px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `oklch(0.3 0.12 ${item.hue} / 0.5)`, color: `oklch(0.92 0.08 ${item.hue})` }}
                  >
                    {item.icon}
                  </span>
                  <h3 className="mt-5 font-display text-[20px] font-semibold leading-[1.5] text-foreground">{item.title}</h3>
                  <p className="mt-1 text-[15px] leading-[1.45] text-muted-foreground">{item.text}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="preguntas" aria-labelledby="h-faq" className="mx-auto max-w-[760px] scroll-mt-8 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-faq" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <div className="mt-8 space-y-3">
            {faqs.map((item, i) => (
              <Reveal key={item.q} delayMs={i * 60}>
                <details className="group rounded-[24px] border border-white/[0.08] bg-card px-6 py-4 shadow-[var(--shadow-glass)] transition duration-300 hover:border-white/[0.16]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-primary transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-[1.55] text-muted-foreground">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden px-4 pb-24 sm:px-[34px]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-70">
            <Image src="/cta-spectrum.png" alt="" width={1344} height={756} className="w-full max-w-[1100px]" style={{ maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 80%)' }} />
          </div>
          <Reveal className="relative mx-auto max-w-[816px] text-center">
            <h2 className="font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">¿Listo para tener tu página?</h2>
            <p className="mx-auto mt-3 max-w-lg text-[16px] text-muted-foreground">Elige un paquete y cuéntanos de tu negocio. Nosotros nos encargamos del resto.</p>
            <a href="#paquetes" className={`${pill} shine mt-8 bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}>
              Ver paquetes
              <ArrowRightIcon />
            </a>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] text-muted-foreground">
              {['Sin compromiso al escribirnos', 'Hecha a tu medida', 'En línea cuando esté lista'].map((text) => (
                <li key={text} className="flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-primary" aria-hidden="true">
                    ✓
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1224px] px-4 sm:px-[34px]">
        <div className="border-t border-white/[0.06] py-8 text-center text-sm text-muted-foreground">
          © 2026 3R — Páginas web para negocios
        </div>
      </footer>
      <WhatsAppButton />
      <MascotGreeter />
    </div>
  );
}
