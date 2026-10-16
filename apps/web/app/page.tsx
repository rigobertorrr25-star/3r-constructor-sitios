import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  ChatIcon,
  ClockIcon,
  DevicesIcon,
  GlobeIcon,
  HistoryIcon,
  ImageIcon,
  InstagramIcon,
  MegaphoneIcon,
  PhoneIcon,
  PointerIcon,
  QrIcon,
  SearchIcon,
  SheetIcon,
  PlayIcon,
  SparkIcon,
  StarIcon,
  ShoppingBagIcon,
  TemplateIcon,
  UtensilsIcon,
} from '@/components/icons';
import { Logo } from '@/components/logo';
import { MascotGreeter } from '@/components/mascot-greeter';
import { Reveal } from '@/components/reveal';
import { SpotlightCard } from '@/components/spotlight-card';
import { whatsappLink } from '@/components/whatsapp-button';
import { currentUserOrNull, rawApi } from '@/lib/api';
import { ATTENDANCE_PRICE, ATTENDANCE_SETUP, ATTENDANCE_SETUP_WITH_PAGE, READY_MADE, SERVICES, type ServiceKey } from '@/lib/services';
import { PackageGrid } from '@/components/package-grid';
import type { CurrentUser, Package, PortfolioItem } from '@/lib/types';

const steps = [
  { n: '1', title: 'Elige lo que necesitas', text: 'Un paquete de página, un menú con QR, tu tienda o el contenido de tus redes. Si no sabes cuál, te ayudamos.' },
  { n: '2', title: 'Escríbenos por WhatsApp', text: 'Nos cuentas de tu negocio y te respondemos qué incluye, cuánto tarda y el precio final, sin compromiso.' },
  { n: '3', title: 'Recibe tu proyecto', text: 'Lo diseñamos y lo construimos. Te mandamos avances por WhatsApp y ajustamos hasta que te guste.' },
];

// Ícono y tono de cada servicio (los textos y precios están en lib/services.ts).
const serviceLook: Record<ServiceKey, { hue: number; icon: ReactNode }> = {
  chatbot: { hue: 150, icon: <ChatIcon /> },
  loyalty: { hue: 88, icon: <SparkIcon /> },
  menu: { hue: 25, icon: <QrIcon /> },
  restaurant: { hue: 200, icon: <UtensilsIcon /> },
  store: { hue: 120, icon: <ShoppingBagIcon /> },
  social: { hue: 330, icon: <MegaphoneIcon /> },
  design: { hue: 275, icon: <ImageIcon /> },
  video: { hue: 0, icon: <PlayIcon /> },
  brand: { hue: 50, icon: <TemplateIcon /> },
  google: { hue: 240, icon: <StarIcon /> },
  domain: { hue: 175, icon: <GlobeIcon /> },
};

const industries: { hue: number; icon: ReactNode; title: string; text: string }[] = [
  { hue: 25, icon: <UtensilsIcon />, title: 'Restaurantes y cafés', text: 'Tu menú, fotos de tus platos, ubicación y un botón directo a WhatsApp para pedidos y reservas.' },
  { hue: 150, icon: <ShoppingBagIcon />, title: 'Tiendas y negocios locales', text: 'Muestra tu catálogo con fotos y precios, y deja que te escriban por WhatsApp para comprar.' },
  { hue: 275, icon: <ChatIcon />, title: 'Servicios y profesionales', text: 'Cuenta qué haces, muestra tu trabajo y facilita que te agenden una cita o te escriban.' },
];

// Lo que le pasa hoy a un negocio sin página, y cómo lo resuelve tener una.
const problems: { hue: number; icon: ReactNode; title: string; text: string; fix: string }[] = [
  {
    hue: 25,
    icon: <SearchIcon />,
    title: 'Te buscan y no apareces',
    text: 'Antes de salir de casa la gente busca en Google y en Maps. Si no te encuentra, llega donde la competencia.',
    fix: 'apareces cuando te buscan',
  },
  {
    hue: 330,
    icon: <PhoneIcon />,
    title: 'Tu Instagram no alcanza',
    text: 'Las redes sirven para mostrar, pero ahí nadie encuentra rápido tus precios, tu horario o cómo llegar.',
    fix: 'todo lo importante en un solo enlace',
  },
  {
    hue: 275,
    icon: <ChatIcon />,
    title: 'Respondes lo mismo todo el día',
    text: '¿Cuánto vale? ¿Dónde quedan? ¿Hacen domicilios? Cada pregunta repetida es tiempo que no le dedicas a tu negocio.',
    fix: 'te escriben listos para comprar',
  },
];

const includes: { hue: number; icon: ReactNode; title: string; text: string }[] = [
  { hue: 150, icon: <TemplateIcon />, title: 'Diseño a tu medida', text: 'Con tus colores, tu logo y tus textos. No es una plantilla genérica.' },
  { hue: 275, icon: <DevicesIcon />, title: 'Celular y computadora', text: 'Tu página se ve bien en cualquier pantalla, desde el primer día.' },
  { hue: 88, icon: <GlobeIcon />, title: 'Dominio y hosting', text: 'Te ayudamos a conectar tu dominio. Hosting y mantenimiento son opcionales.' },
  { hue: 200, icon: <PointerIcon />, title: 'Tú no tocas nada técnico', text: 'Nosotros nos encargamos de todo. Tú solo revisas y apruebas.' },
  { hue: 25, icon: <HistoryIcon />, title: 'Hablas directo con nosotros', text: 'Todo por WhatsApp: te mandamos avances y nos pides cambios ahí mismo.' },
];

const faqs = [
  { q: '¿Cuánto tarda mi página?', a: 'Depende del paquete: cada uno muestra sus días de entrega. Empezamos a trabajar cuando se confirma el pago.' },
  { q: '¿Cómo pago?', a: 'Cuando acordamos por WhatsApp lo que necesitas, te pasamos los datos para pagar por transferencia o en línea. Empezamos cuando se confirma el pago.' },
  { q: '¿Qué es la mensualidad?', a: 'Es opcional: mantiene tu página en línea y cubre soporte y pequeños cambios. Puedes decidirlo al pedir o después.' },
  { q: '¿Puedo pedir cambios?', a: 'Sí. Nos escribes por WhatsApp lo que quieras ajustar y lo vemos contigo.' },
  { q: '¿Puedo pedir varias cosas juntas?', a: 'Sí. Por ejemplo tu página, el menú con QR y el contenido de tus redes. Te armamos una sola cotización con todo.' },
  { q: '¿El menú con QR reemplaza la carta física?', a: 'No del todo: la Superintendencia de Industria y Comercio pide que el cliente también pueda ver los precios en una carta física. El menú digital la complementa y debe tener los mismos precios.' },
  { q: '¿Necesito tener un dominio?', a: 'No. Si todavía no tienes uno, te ayudamos a elegirlo y conectarlo.' },
];

const attendanceFeatures: { hue: number; icon: ReactNode; text: string }[] = [
  { hue: 275, icon: <QrIcon />, text: 'Una tablet en la entrada muestra un QR que cambia cada 30 segundos: solo se puede marcar estando en el local.' },
  { hue: 150, icon: <PhoneIcon />, text: 'Cada empleado marca con su celular y su propio PIN. Nada que instalar.' },
  { hue: 25, icon: <ClockIcon />, text: 'Ves quién llegó tarde, quién salió antes y las horas trabajadas de cada uno.' },
  { hue: 200, icon: <SheetIcon />, text: 'Descargas la semana en Excel y le das acceso de solo lectura a los dueños o socios.' },
];

const INSTAGRAM_URL = 'https://www.instagram.com/3r.paginas_/';

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
  const [packages, allWork, user] = await Promise.all([loadPackages(), loadPortfolio(), currentUserOrNull<CurrentUser>()]);
  // Las páginas de muestra que se venden hechas no van en «Trabajos»: no son de un cliente.
  const portfolio = allWork.filter((w) => !READY_MADE.some((r) => w.url.replace(/\/$/, '') === r.url.replace(/\/$/, '')));
  const isStaff = user?.roles.includes('ADMIN') || user?.roles.includes('SUPER_ADMIN');

  const prices = (packages ?? []).map((p) => p.priceCents / 100);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: '3R',
    description: 'Páginas web a medida, menús digitales con QR, chatbot de WhatsApp con IA, tarjeta de sellos, tiendas en línea, contenido para redes y una plataforma para empresas, para negocios en Colombia.',
    url: 'https://3rpaginas.com',
    telephone: '+573107907194',
    areaServed: 'CO',
    sameAs: [INSTAGRAM_URL],
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
            <a href="#como-funciona" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground lg:block">
              Cómo funciona
            </a>
            {portfolio.length > 0 ? (
              <a href="#trabajos" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground lg:block">
                Trabajos
              </a>
            ) : null}
            <a href="#paquetes" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Paquetes
            </a>
            <a href="#servicios" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Servicios
            </a>
            <Link href="/software" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground lg:block">
              Para empresas
            </Link>
            <a href="#preguntas" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground xl:block">
              Preguntas
            </a>
            {/* Sin «Iniciar sesión» por ahora: todo se pide por WhatsApp. El panel sigue en /login para el equipo. */}
            {user ? (
              <Link
                href={isStaff ? '/admin' : '/dashboard'}
                className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.014] px-[17px] py-[8.5px] text-[14.875px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {isStaff ? 'Administración' : 'Mi cuenta'}
              </Link>
            ) : (
              <a
                href={whatsappLink('Hola, quiero información sobre los servicios de 3R')}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.014] px-[17px] py-[8.5px] text-[14.875px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                WhatsApp
              </a>
            )}
            <a
              href="#paquetes"
              className="shine inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-[17px] py-[8.5px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Ver paquetes
              <span className="hidden sm:inline-flex">
                <ArrowRightIcon />
              </span>
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          {/* Los brillos se desvanecen hacia abajo: sin eso, el corte de la sección se veía como un bloque de otro color. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ maskImage: 'linear-gradient(to bottom, black 35%, transparent 90%)', WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 90%)' }}
          >
            <span className="orb orb-a absolute -top-20 right-[-6%] size-[380px] bg-primary/25 sm:size-[460px]" />
            <span className="orb orb-b absolute bottom-[-14%] left-[-8%] size-[340px] bg-secondary/15 sm:size-[420px]" />
          </div>

          <div className="relative mx-auto grid max-w-[1224px] grid-cols-1 items-center gap-6 px-4 pb-16 pt-8 sm:gap-10 sm:px-[34px] sm:pt-[68px] md:pb-20 lg:grid-cols-[1fr_460px] lg:gap-6">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <p className="rise text-[12.75px] uppercase tracking-[0.3em] text-muted-foreground">Páginas web para negocios</p>
              <h1
                className="rise mt-4 font-display font-bold tracking-[-0.025em] text-foreground sm:mt-6"
                style={{ fontSize: 'clamp(2.5rem, 6vw, 3.984rem)', lineHeight: 1.25, animationDelay: '80ms' }}
              >
                Tu página web <span className="text-spectrum">profesional</span>,
                <br />
                hecha por nosotros
              </h1>
              <p className="rise mt-6 max-w-[560px] text-[17px] leading-[1.55] text-muted-foreground sm:text-[19px]" style={{ animationDelay: '160ms' }}>
                Tú nos cuentas de tu negocio. Nosotros diseñamos, construimos y publicamos tu página, tu menú con QR o tu tienda. Sin complicarte con nada técnico.
              </p>
              <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 lg:justify-start" style={{ animationDelay: '240ms' }}>
                <a href="#paquetes" className={`${pill} shine bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}>
                  Ver paquetes
                  <ArrowRightIcon />
                </a>
                <a
                  href={whatsappLink('Hola, quiero una página web para mi negocio')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${pill} border border-white/[0.08] bg-white/[0.014] hover:bg-white/[0.06]`}
                >
                  Escríbenos por WhatsApp
                </a>
              </div>
            </div>

            {/* mix-blend-screen: el fondo negro del video no pinta, así el león se funde con los brillos de la página.
                Va en este contenedor (no en el video) porque la animación de entrada lo aísla del fondo. */}
            <div className="rise relative mx-auto w-full max-w-[290px] mix-blend-screen sm:max-w-[400px] lg:max-w-none" style={{ animationDelay: '120ms' }}>
              <video
                aria-label="Mascota de 3R: un león con sudadera negra y lentes de sol, saludando"
                autoPlay
                loop
                muted
                playsInline
                poster="/hero-lion.png"
                // El video es vertical con mucho negro arriba y abajo: el recorte cuadrado deja al león
                // completo y centrado, sin empujarlo fuera de la primera pantalla del celular.
                className="aspect-square w-full object-cover"
                style={{ maskImage: 'radial-gradient(closest-side, black 72%, transparent 100%)', WebkitMaskImage: 'radial-gradient(closest-side, black 72%, transparent 100%)' }}
              >
                <source src="/hero-lion.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        <section aria-labelledby="h-problema" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <p className="text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Lo que pasa hoy</p>
            <h2 id="h-problema" className="mx-auto mt-4 max-w-[720px] text-center font-display text-[32px] font-bold leading-[1.2] tracking-tight text-foreground sm:text-[40px]">
              Si no te encuentran en internet, <span className="text-spectrum">le compran a otro</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[16px] text-muted-foreground">
              Tu negocio puede ser el mejor de la zona. Si no se ve en internet, para muchos clientes no existe.
            </p>
          </Reveal>
          <ul className="mt-10 grid grid-cols-1 gap-[17px] lg:grid-cols-3">
            {problems.map((item, i) => (
              <Reveal as="li" key={item.title} delayMs={i * 100}>
                <SpotlightCard className={`${card} group flex h-full flex-col p-[26px] transition duration-300 hover:-translate-y-1 hover:border-white/[0.18]`}>
                  <span
                    className="flex size-[43px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `oklch(0.3 0.12 ${item.hue} / 0.5)`, color: `oklch(0.92 0.08 ${item.hue})` }}
                  >
                    {item.icon}
                  </span>
                  <h3 className="mt-5 font-display text-[21px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-[1.5] text-muted-foreground">{item.text}</p>
                  <p className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[14px] font-medium text-foreground">
                    <span className="text-primary">
                      <ArrowRightIcon />
                    </span>
                    Con tu página, {item.fix}
                  </p>
                </SpotlightCard>
              </Reveal>
            ))}
          </ul>
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
              <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">Páginas que hicimos para negocios de Cartagena. Haz clic para verlas en línea.</p>
            </Reveal>
            {/* Con 2 o 4 trabajos, dos columnas: en tres quedaría una tarjeta sola en la última fila. */}
            <ul
              className={`mx-auto mt-10 grid grid-cols-1 gap-[17px] sm:grid-cols-2 ${portfolio.length === 2 || portfolio.length === 4 ? 'max-w-[900px]' : 'lg:grid-cols-3'}`}
            >
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
                        // Sin captura todavía: una ventana de navegador con el nombre del negocio, no la dirección suelta.
                        <div className="flex size-full flex-col bg-[radial-gradient(ellipse_at_top_right,#8a9bff40,transparent_60%),radial-gradient(ellipse_at_bottom_left,#ff86db2b,transparent_60%)] p-4">
                          <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5" aria-hidden="true">
                            <span className="flex gap-1">
                              <span className="size-1.5 rounded-full bg-white/25" />
                              <span className="size-1.5 rounded-full bg-white/25" />
                              <span className="size-1.5 rounded-full bg-white/25" />
                            </span>
                            <span className="truncate text-[12px] text-muted-foreground">{hostOf(item.url)}</span>
                          </div>
                          <div className="flex flex-1 items-center justify-center px-4 text-center">
                            <span className="font-display text-[26px] font-bold leading-tight tracking-tight text-foreground/90 transition duration-500 group-hover:scale-[1.03]">
                              {item.title}
                            </span>
                          </div>
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

        <section id="lista" aria-labelledby="h-lista" className="mx-auto max-w-[1224px] scroll-mt-24 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-lista" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
              Páginas listas para estrenar
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">
              Ya están hechas y probadas: escoges una, le ponemos tu marca y tu menú, y sale en vivo mucho antes que una desde cero.
            </p>
          </Reveal>
          <ul className="mt-10 space-y-[17px]">
            {READY_MADE.map((r) => (
              <Reveal as="li" key={r.url}>
                <div className={`${card} grid overflow-hidden lg:grid-cols-[1.1fr_1fr]`}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[16/10] overflow-hidden bg-black lg:aspect-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.image}
                      alt={`Página de muestra ${r.title}`}
                      loading="lazy"
                      className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute bottom-4 left-4 rounded-full bg-black/60 px-4 py-2 text-[14px] text-foreground backdrop-blur">
                      Ver la página en vivo <span aria-hidden="true">↗</span>
                    </span>
                  </a>
                  <div className="flex flex-col p-[26px] sm:p-[34px]">
                    <p className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">{r.kind}</p>
                    <h3 className="mt-2 font-display text-[28px] font-bold tracking-tight text-foreground">{r.title}</h3>
                    <p className="mt-2 text-[15.5px] leading-[1.55] text-muted-foreground">{r.pitch}</p>
                    <ul className="mt-5 space-y-2.5">
                      {r.includes.map((line) => (
                        <li key={line} className="flex gap-2.5 text-[14.5px] leading-snug text-foreground/90">
                          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          {line}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-6">
                      <p className="flex items-baseline gap-2">
                        <span className="font-display text-[30px] font-bold leading-none tracking-tight text-foreground">{r.price}</span>
                        <span className="text-[14px] text-muted-foreground">pago único, con tu marca</span>
                      </p>
                      <p className="mt-2 text-[13.5px] text-muted-foreground">Es una página de muestra: el nombre 3R Burgers se cambia por el de tu negocio.</p>
                      <a
                        href={whatsappLink(r.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] sm:w-auto"
                      >
                        La quiero para mi negocio <ArrowRightIcon />
                      </a>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="paquetes" aria-labelledby="h-paquetes" className="mx-auto max-w-[1224px] scroll-mt-8 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-paquetes" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
              Elige tu paquete
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">
              Pagas una vez por tu página. La mensualidad de hosting y mantenimiento es opcional.
            </p>
          </Reveal>

          <PackageGrid packages={packages} />
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

        <section id="servicios" aria-labelledby="h-servicios" className="mx-auto max-w-[1224px] scroll-mt-24 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-servicios" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
              Más de lo que hacemos
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">
              Además de tu página: para atender por WhatsApp, para que tus clientes vuelvan, para manejar tu restaurante y para vender por redes.
              Pídelos solos o junto con tu paquete; los precios son en pesos y ya dicen qué incluye cada uno.
            </p>
          </Reveal>
          {/* 11 servicios: los 2 primeros en mitades y los otros 9 en tercios, sin una tarjeta sola al final. */}
          <ul className="mt-10 grid grid-cols-1 gap-[17px] md:grid-cols-2 lg:grid-cols-6">
            {SERVICES.map((svc, i) => (
              <Reveal as="li" key={svc.key} delayMs={(i % 3) * 90} className={`${i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'} ${i === SERVICES.length - 1 ? 'md:col-span-2' : ''}`}>
                <SpotlightCard className={`${card} group flex h-full flex-col p-[26px] transition duration-300 hover:-translate-y-1 hover:border-white/[0.18]`}>
                  <span
                    className="flex size-[43px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `oklch(0.3 0.12 ${serviceLook[svc.key].hue} / 0.5)`, color: `oklch(0.92 0.08 ${serviceLook[svc.key].hue})` }}
                  >
                    {serviceLook[svc.key].icon}
                  </span>
                  <h3 className="mt-5 font-display text-[21px] font-semibold text-foreground">{svc.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{svc.pitch}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {svc.includes.map((line) => (
                      <li key={line} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-foreground/90">
                        <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 border-t border-white/[0.06] pt-5">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-display text-[30px] font-bold leading-none tracking-tight text-foreground">{svc.price}</span>
                      <span className="text-[14px] text-muted-foreground">{svc.priceNote}</span>
                    </p>
                    {svc.extra ? <p className="mt-2 text-[13.5px] leading-snug text-muted-foreground">{svc.extra}</p> : null}
                    <a
                      href={whatsappLink(svc.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${pill} shine mt-5 w-full border border-white/[0.12] hover:bg-white/[0.06]`}
                    >
                      Pedir por WhatsApp
                      <ArrowRightIcon />
                    </a>
                    {svc.more ? (
                      <Link href={svc.more.href} className="mt-3 block text-center text-[14px] text-primary hover:underline">
                        {svc.more.label} →
                      </Link>
                    ) : null}
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="asistencia" aria-labelledby="h-asistencia" className="mx-auto max-w-[1224px] scroll-mt-8 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <div className={`${card} grid gap-8 p-[26px] sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center`}>
              <div>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Nuevo para restaurantes
                </span>
                <h2 id="h-asistencia" className="mt-5 font-display text-[30px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[38px]">
                  Control de asistencia con QR
                </h2>
                <p className="mt-3 max-w-xl text-[16px] text-muted-foreground">
                  Sabe a qué hora llega y sale cada empleado, sin reloj de huella ni planillas en papel.
                </p>
                <ul className="mt-7 grid gap-4 sm:grid-cols-2">
                  {attendanceFeatures.map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `oklch(0.3 0.12 ${item.hue} / 0.5)`, color: `oklch(0.92 0.08 ${item.hue})` }}
                      >
                        {item.icon}
                      </span>
                      <span className="text-[14.5px] leading-snug text-foreground/90">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 text-center">
                <p className="font-display text-[44px] font-bold leading-none tracking-tight text-foreground">{ATTENDANCE_PRICE}</p>
                <p className="mt-2 text-[14px] text-muted-foreground">al mes</p>
                <div className="mt-5 space-y-1.5 border-t border-white/[0.08] pt-5 text-[14px]">
                  <p className="text-muted-foreground">
                    Instalación: <span className="text-foreground">{ATTENDANCE_SETUP}</span>
                  </p>
                  <p className="rounded-2xl bg-primary/10 px-3.5 py-2.5 text-primary">
                    Solo {ATTENDANCE_SETUP_WITH_PAGE} si compras tu página con nosotros
                  </p>
                </div>
                <a
                  href={whatsappLink('Hola, me interesa el control de asistencia con QR para mi negocio')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${pill} shine mt-6 w-full bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}
                >
                  Lo quiero para mi negocio
                  <ArrowRightIcon />
                </a>
                <p className="mt-3 text-[13px] text-muted-foreground">Te escribimos por WhatsApp y lo dejamos funcionando.</p>
              </div>
            </div>
          </Reveal>
        </section>

        <section aria-labelledby="h-software" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <Link
              href="/software"
              className={`${card} group flex flex-col gap-6 p-[26px] transition duration-300 hover:border-white/[0.18] sm:p-10 lg:flex-row lg:items-center lg:justify-between`}
            >
              <div>
                <span className="rounded-full bg-secondary/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-secondary">Para empresas</span>
                <h2 id="h-software" className="mt-5 font-display text-[28px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[34px]">
                  ¿Tu empresa ya creció? Todo en un solo lugar
                </h2>
                <p className="mt-3 max-w-2xl text-[16px] text-muted-foreground">
                  Clientes, empleados, documentos, cotizaciones, tienda en línea, WhatsApp e inteligencia artificial. Activas solo los módulos que usas.
                </p>
              </div>
              <span className={`${pill} shrink-0 border border-white/[0.08] bg-white/[0.014] group-hover:bg-white/[0.06]`}>
                Conocer el software
                <ArrowRightIcon />
              </span>
            </Link>
          </Reveal>
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
            <p className="mx-auto mt-3 max-w-lg text-[16px] text-muted-foreground">Escríbenos por WhatsApp y cuéntanos de tu negocio. Nosotros nos encargamos del resto.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={whatsappLink('Hola, quiero una página web para mi negocio')}
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} shine bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}
              >
                Escríbenos por WhatsApp
                <ArrowRightIcon />
              </a>
              <a href="#paquetes" className={`${pill} border border-white/[0.08] bg-white/[0.014] hover:bg-white/[0.06]`}>
                Ver paquetes
              </a>
            </div>
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
        {/* En celular, espacio abajo para que la mascota flotante no tape el pie. */}
        <div className="flex flex-col items-center gap-4 border-t border-white/[0.06] pt-8 pb-24 text-center text-sm text-muted-foreground sm:pb-8">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-foreground transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <InstagramIcon size={18} />
            @3r.paginas_
          </a>
          <p>
            © 2026 3R — Páginas web para negocios ·{' '}
            <Link href="/privacidad" className="transition hover:text-foreground">
              Política de privacidad
            </Link>
          </p>
        </div>
      </footer>
      <MascotGreeter />
    </div>
  );
}
