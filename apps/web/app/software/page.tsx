import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  BoltIcon,
  BriefcaseIcon,
  ChatIcon,
  GlobeIcon,
  HistoryIcon,
  InstagramIcon,
  ShieldIcon,
  SparkIcon,
  UsersIcon,
} from '@/components/icons';
import { Logo } from '@/components/logo';
import { Reveal } from '@/components/reveal';
import { SpotlightCard } from '@/components/spotlight-card';
import { whatsappLink } from '@/components/whatsapp-button';
import { currentUserOrNull } from '@/lib/api';
import { AREA_LABEL, MODULE_INFO, ROLE_LABEL, type CompanyRole, type ModuleArea } from '@/lib/companies';
import type { CurrentUser } from '@/lib/types';

const title = 'Software para empresas — 3R';
const description =
  'Clientes, empleados, documentos, ventas, tienda en línea, WhatsApp e inteligencia artificial en una sola plataforma. Activas solo los módulos que tu empresa necesita.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/software' },
  openGraph: { title, description, siteName: '3R', locale: 'es_CO', type: 'website', url: '/software' },
  twitter: { card: 'summary_large_image', title, description },
};

const DEMO_MESSAGE = 'Hola, quiero conocer el software para empresas de 3R';
const INSTAGRAM_URL = 'https://www.instagram.com/3r.paginas_/';

// Mismo orden y áreas que el catálogo de la API (apps/api/src/companies/companies.constants.ts).
const areas: { area: ModuleArea; hue: number; icon: ReactNode; pitch: string; modules: string[] }[] = [
  { area: 'clientes', hue: 275, icon: <ChatIcon />, pitch: 'Que ningún cliente se te pierda entre chats y libretas.', modules: ['crm', 'quotes', 'marketing', 'whatsapp'] },
  {
    area: 'empresa',
    hue: 150,
    icon: <BriefcaseIcon />,
    pitch: 'El día a día de tu equipo, ordenado y sin papeles.',
    modules: ['employees', 'requests', 'announcements', 'documents', 'doc_generator', 'tickets', 'calendar', 'surveys', 'training', 'knowledge', 'inventory'],
  },
  { area: 'web', hue: 200, icon: <GlobeIcon />, pitch: 'Tu página y tu tienda, que tú mismo actualizas.', modules: ['web', 'store', 'analytics', 'seo'] },
  { area: 'automatizacion', hue: 88, icon: <BoltIcon />, pitch: 'Lo que hoy haces a mano, la plataforma lo hace sola.', modules: ['alerts', 'automations'] },
  { area: 'ia', hue: 330, icon: <SparkIcon />, pitch: 'Un asistente que conoce tu empresa y te ayuda a escribir.', modules: ['ai_assistant', 'ai_content'] },
];

const moduleCount = areas.reduce((n, a) => n + a.modules.length, 0);

const problems: { hue: number; icon: ReactNode; title: string; text: string; fix: string }[] = [
  {
    hue: 275,
    icon: <ChatIcon />,
    title: 'Los clientes viven en tu celular',
    text: 'Cotizaciones por WhatsApp, datos en una libreta, seguimientos que se olvidan. Si cambias de celular, pierdes clientes.',
    fix: 'cada cliente con su historial',
  },
  {
    hue: 150,
    icon: <UsersIcon />,
    title: 'Tu equipo pregunta lo mismo',
    text: '¿Me aprobaron las vacaciones? ¿Dónde está el manual? ¿Me das un certificado laboral? Y todo pasa por ti.',
    fix: 'cada empleado lo resuelve solo',
  },
  {
    hue: 88,
    icon: <HistoryIcon />,
    title: 'Diez programas que no se hablan',
    text: 'Una hoja de Excel para el inventario, otra para los clientes, el correo por un lado y la página por otro.',
    fix: 'todo en un solo lugar',
  },
];

const steps = [
  { n: '1', title: 'Nos cuentas de tu empresa', text: 'Por WhatsApp hablamos de cómo trabajas hoy y qué te quita más tiempo.' },
  { n: '2', title: 'Activamos tus módulos', text: 'Creamos tu empresa en la plataforma y encendemos solo lo que vas a usar.' },
  { n: '3', title: 'Tu equipo entra', text: 'Invitas a cada persona por correo y le das su rol. Desde ese día, todo queda en un solo lugar.' },
];

const roles: { role: CompanyRole; text: string }[] = [
  { role: 'owner', text: 'Ve y decide todo: módulos, plan, pagos y equipo.' },
  { role: 'admin', text: 'Maneja la empresa en el día a día.' },
  { role: 'hr', text: 'Empleados, permisos, documentos y certificados.' },
  { role: 'supervisor', text: 'Aprueba a su equipo y atiende clientes.' },
  { role: 'employee', text: 'Su perfil, sus solicitudes, comunicados y cursos.' },
];

const faqs = [
  {
    q: '¿Tengo que pagar los módulos que no uso?',
    a: 'No. Pagas solo los módulos que tienes encendidos. Puedes agregar o quitar módulos cuando tu empresa lo necesite.',
  },
  { q: '¿Cuánto cuesta?', a: 'Depende de los módulos que actives. Escríbenos por WhatsApp, nos cuentas qué necesitas y te armamos el plan.' },
  { q: '¿Cómo pago?', a: 'Cada mes recibes tu factura en la plataforma y la pagas en línea con Wompi o por transferencia.' },
  { q: '¿Hay que instalar algo?', a: 'No. Funciona en el navegador del celular o del computador. Cada persona entra con su correo y su contraseña.' },
  {
    q: '¿Ya tengo mi página con 3R, sirve?',
    a: 'Sí. La conectamos al módulo Página web y desde ahí cambias textos, fotos y botones sin depender de nosotros.',
  },
  { q: '¿Qué pasa con los datos de mi empresa?', a: 'Son tuyos. Solo los ve tu equipo, según el rol de cada persona, y los tratamos según la Ley 1581 de protección de datos.' },
];

const pill =
  'inline-flex items-center justify-center gap-2 rounded-full px-[25.5px] py-[12.75px] text-[14.875px] transition duration-300 ease-[var(--ease-emphasized)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';
const card = 'rounded-[32px] border border-white/[0.08] bg-card shadow-[var(--shadow-glass)]';
const iconStyle = (hue: number) => ({ backgroundColor: `oklch(0.3 0.12 ${hue} / 0.5)`, color: `oklch(0.92 0.08 ${hue})` });

export default async function SoftwarePage() {
  const user = await currentUserOrNull<CurrentUser>();
  const isStaff = user?.roles.includes('ADMIN') || user?.roles.includes('SUPER_ADMIN');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '3R — Software para empresas',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description,
    url: 'https://3rpaginas.com/software',
    provider: { '@type': 'Organization', name: '3R', url: 'https://3rpaginas.com', sameAs: [INSTAGRAM_URL] },
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
            <Link href="/" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Páginas web
            </Link>
            <a href="#modulos" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Módulos
            </a>
            <a href="#preguntas" className="hidden rounded-full px-4 py-2 text-[14.875px] text-muted-foreground transition hover:text-foreground md:block">
              Preguntas
            </a>
            <Link
              href={user ? (isStaff ? '/admin' : '/empresa') : '/login'}
              className="rounded-full border border-white/[0.08] bg-white/[0.014] px-[17px] py-[8.5px] text-[14.875px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              {user ? (isStaff ? 'Administración' : 'Mi empresa') : 'Iniciar sesión'}
            </Link>
            <a
              href={whatsappLink(DEMO_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className="shine hidden items-center gap-1.5 rounded-full bg-primary px-[17px] py-[8.5px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:inline-flex"
            >
              Hablemos
              <ArrowRightIcon />
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ maskImage: 'linear-gradient(to bottom, black 35%, transparent 90%)', WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 90%)' }}
          >
            <span className="orb orb-a absolute -top-20 right-[-6%] size-[380px] bg-primary/25 sm:size-[460px]" />
            <span className="orb orb-b absolute bottom-[-14%] left-[-8%] size-[340px] bg-secondary/15 sm:size-[420px]" />
          </div>

          <div className="relative mx-auto flex max-w-[860px] flex-col items-center px-4 pb-20 pt-12 text-center sm:px-[34px] sm:pt-[84px]">
            <p className="rise text-[12.75px] uppercase tracking-[0.3em] text-muted-foreground">Software para empresas</p>
            <h1
              className="rise mt-5 font-display font-bold tracking-[-0.025em] text-foreground sm:mt-6"
              style={{ fontSize: 'clamp(2.4rem, 6vw, 3.984rem)', lineHeight: 1.2, animationDelay: '80ms' }}
            >
              Toda tu empresa <span className="text-spectrum">en un solo lugar</span>
            </h1>
            <p className="rise mt-6 max-w-[620px] text-[17px] leading-[1.55] text-muted-foreground sm:text-[19px]" style={{ animationDelay: '160ms' }}>
              Clientes, empleados, documentos, ventas, tu página, WhatsApp y un asistente con inteligencia artificial. Enciendes solo lo que
              necesitas y pagas solo eso.
            </p>
            <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10" style={{ animationDelay: '240ms' }}>
              <a
                href={whatsappLink(DEMO_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} shine bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}
              >
                Quiero conocerlo
                <ArrowRightIcon />
              </a>
              <a href="#modulos" className={`${pill} border border-white/[0.08] bg-white/[0.014] hover:bg-white/[0.06]`}>
                Ver los {moduleCount} módulos
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="h-problema" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <p className="text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Lo que pasa hoy</p>
            <h2 id="h-problema" className="mx-auto mt-4 max-w-[720px] text-center font-display text-[32px] font-bold leading-[1.2] tracking-tight text-foreground sm:text-[40px]">
              Tu empresa creció, <span className="text-spectrum">tus herramientas no</span>.
            </h2>
          </Reveal>
          <ul className="mt-10 grid grid-cols-1 gap-[17px] lg:grid-cols-3">
            {problems.map((item, i) => (
              <Reveal as="li" key={item.title} delayMs={i * 100}>
                <SpotlightCard className={`${card} group flex h-full flex-col p-[26px] transition duration-300 hover:-translate-y-1 hover:border-white/[0.18]`}>
                  <span className="flex size-[43px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110" style={iconStyle(item.hue)}>
                    {item.icon}
                  </span>
                  <h3 className="mt-5 font-display text-[21px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-[1.5] text-muted-foreground">{item.text}</p>
                  <p className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[14px] font-medium text-foreground">
                    <span className="text-primary">
                      <ArrowRightIcon />
                    </span>
                    Con 3R, {item.fix}
                  </p>
                </SpotlightCard>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="modulos" aria-labelledby="h-modulos" className="mx-auto max-w-[1224px] scroll-mt-24 px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-modulos" className="text-center font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">
              {moduleCount} módulos, tú eliges cuáles
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[16px] text-muted-foreground">
              Empieza con dos o tres y agrega más cuando los necesites. Todos comparten la misma información.
            </p>
          </Reveal>
          <div className="mt-10 space-y-[17px]">
            {areas.map((group, gi) => (
              <Reveal key={group.area} delayMs={gi * 60}>
                <div className={`${card} grid gap-6 p-[26px] sm:p-8 lg:grid-cols-[280px_1fr] lg:gap-10`}>
                  <div>
                    <span className="flex size-[43px] items-center justify-center rounded-full" style={iconStyle(group.hue)}>
                      {group.icon}
                    </span>
                    <h3 className="mt-5 font-display text-[23px] font-bold text-foreground">{AREA_LABEL[group.area]}</h3>
                    <p className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{group.pitch}</p>
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {group.modules.map((key) => (
                      <li key={key} className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.14]">
                        <p className="flex items-center gap-2 font-display text-[16px] font-semibold text-foreground">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `oklch(0.8 0.12 ${group.hue})` }} aria-hidden="true" />
                          {MODULE_INFO[key].name}
                        </p>
                        <p className="mt-1.5 text-[14.5px] leading-snug text-muted-foreground">{MODULE_INFO[key].text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-roles" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <div className={`${card} grid gap-8 p-[26px] sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center`}>
              <div>
                <span className="flex size-[43px] items-center justify-center rounded-full" style={iconStyle(200)}>
                  <ShieldIcon />
                </span>
                <h2 id="h-roles" className="mt-5 font-display text-[30px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[36px]">
                  Cada quien ve lo suyo
                </h2>
                <p className="mt-3 max-w-md text-[16px] text-muted-foreground">
                  Le das a cada persona un rol. El empleado no ve los pagos, y el supervisor solo aprueba a su equipo.
                </p>
              </div>
              <ul className="divide-y divide-white/[0.06] rounded-[24px] border border-white/[0.08] bg-white/[0.02]">
                {roles.map((item) => (
                  <li key={item.role} className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="shrink-0 font-display text-[15.5px] font-semibold text-foreground sm:w-[170px]">{ROLE_LABEL[item.role]}</span>
                    <span className="text-[14.5px] text-muted-foreground">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        <section aria-labelledby="h-como" className="mx-auto max-w-[1224px] px-4 pb-24 sm:px-[34px]">
          <Reveal>
            <h2 id="h-como" className="text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Cómo empiezas
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

        <section id="preguntas" aria-labelledby="h-faq" className="mx-auto max-w-[760px] scroll-mt-24 px-4 pb-24 sm:px-[34px]">
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

        <section className="px-4 pb-24 sm:px-[34px]">
          <Reveal className="mx-auto max-w-[816px] text-center">
            <h2 className="font-display text-[32px] font-bold tracking-tight text-foreground sm:text-[40px]">¿Lo vemos con tu empresa?</h2>
            <p className="mx-auto mt-3 max-w-lg text-[16px] text-muted-foreground">
              Escríbenos, cuéntanos cómo trabajas hoy y te mostramos qué módulos te sirven.
            </p>
            <a
              href={whatsappLink(DEMO_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${pill} shine mt-8 bg-primary font-medium text-primary-foreground hover:shadow-[var(--shadow-glow)]`}
            >
              Hablar por WhatsApp
              <ArrowRightIcon />
            </a>
            <p className="mt-6 text-[14px] text-muted-foreground">
              ¿Solo necesitas una página web?{' '}
              <Link href="/#paquetes" className="text-primary hover:underline">
                Mira los paquetes
              </Link>
            </p>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1224px] px-4 sm:px-[34px]">
        <div className="flex flex-col items-center gap-4 border-t border-white/[0.06] py-8 text-center text-sm text-muted-foreground">
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
            © 2026 3R — Páginas web y software para empresas ·{' '}
            <Link href="/privacidad" className="transition hover:text-foreground">
              Política de privacidad
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
