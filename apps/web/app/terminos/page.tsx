import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Términos y condiciones — 3R',
  description: 'Las reglas claras para comprar una página web, un servicio o un módulo de software con 3R: pagos, entregas, cambios y garantía.',
};

// Términos y condiciones (8 nov 2026, pedido de Rigoberto). Mismos datos del responsable que /privacidad.
const VERSION = '8 de noviembre de 2026';
const WHATSAPP = 'https://wa.me/573107907194?text=' + encodeURIComponent('Hola, tengo una pregunta sobre los términos de 3R');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-4 py-6">
        <Link href="/" aria-label="3R — Inicio" className="text-foreground">
          <Logo size={36} />
        </Link>
        <Link href="/" className="text-sm text-muted-foreground transition hover:text-foreground">
          Volver al inicio
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] space-y-10 px-4 pb-20 pt-6 text-[15.5px] leading-relaxed text-muted-foreground">
        <div className="space-y-3">
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-tight text-foreground sm:text-[42px]">
            Términos y condiciones
          </h1>
          <p>Vigentes desde el {VERSION}.</p>
          <p>
            Estas son las reglas para comprar con 3R una página web, un servicio (flyers, dominio, chatbot y los demás) o un
            módulo de software. Al hacer un pedido o pagar, aceptas estos términos. Los escribimos sin letra chica.
          </p>
        </div>

        <Section title="1. Quiénes somos">
          <p>
            3R es la marca de Rigoberto Rincón (C.C. 1.007.401.985), en Cartagena, Colombia. Nos escribes por{' '}
            <a href={WHATSAPP} className="text-primary hover:underline">
              WhatsApp +57 310 790 7194
            </a>{' '}
            o a{' '}
            <a href="mailto:rigoberto.rrr25@gmail.com" className="text-primary hover:underline">
              rigoberto.rrr25@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Qué incluye cada paquete">
          <p>
            Lo que trae cada paquete y su precio está publicado en 3rpaginas.com o en la cotización que te mandamos. Si algo no
            aparece ahí, no está incluido y lo cotizamos aparte. Los precios están en pesos colombianos.
          </p>
        </Section>

        <Section title="3. Pagos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Pagas con Wompi (tarjeta, PSE, Nequi) o por transferencia.</li>
            <li>Empezamos a trabajar cuando el pago (o el anticipo acordado) está confirmado.</li>
            <li>El dominio propio se paga por año y se renueva cada año; te avisamos antes del vencimiento.</li>
            <li>Los módulos de software y los servicios mensuales se pagan mes a mes (o por año, si así lo escoges) y puedes cancelarlos cuando quieras: dejan de cobrarse el mes siguiente.</li>
          </ul>
        </Section>

        <Section title="4. Entrega y cambios">
          <ul className="list-disc space-y-1 pl-5">
            <li>Para empezar necesitamos tu información: logo, fotos, textos, precios y datos de contacto.</li>
            <li>El tiempo de entrega cuenta desde que tenemos esa información completa.</li>
            <li>Te mostramos la página antes de publicarla y hacemos los ajustes que pidas sobre lo acordado.</li>
            <li>Cambios grandes que no estaban en el paquete (secciones nuevas, otro diseño) se cotizan aparte.</li>
          </ul>
        </Section>

        <Section title="5. Tu contenido">
          <p>
            Tú eres dueño de tu marca, tus textos y tus fotos, y nos confirmas que tienes derecho a usarlos. No publicamos
            contenido ilegal, engañoso o que copie la marca de otro. Cuando la página esté pagada, el diseño y el contenido
            son tuyos.
          </p>
        </Section>

        <Section title="6. Retracto y devoluciones">
          <p>
            Por la Ley 1480 de 2011 (Estatuto del Consumidor), en compras a distancia tienes 5 días hábiles para retractarte
            y recibir tu dinero, siempre que no hayamos empezado a trabajar en tu pedido con tu autorización. Si ya empezamos,
            te devolvemos la parte del trabajo que no se ha hecho. Para pedirlo, escríbenos por WhatsApp o correo.
          </p>
        </Section>

        <Section title="7. Garantía y soporte">
          <p>
            Si algo de lo que entregamos no funciona como acordamos, lo arreglamos sin costo. No respondemos por fallas de
            servicios de terceros (pasarelas de pago, proveedores de dominio o de hosting, WhatsApp, redes sociales) ni por
            cambios que haga otra persona en la página.
          </p>
        </Section>

        <Section title="8. Tus datos">
          <p>
            Cómo tratamos tus datos personales está en la{' '}
            <Link href="/privacidad" className="text-primary hover:underline">
              política de privacidad
            </Link>
            .
          </p>
        </Section>

        <Section title="9. Cambios a estos términos">
          <p>
            Si cambiamos algo importante, lo publicamos aquí con la fecha nueva. Los pedidos ya pagados siguen con los
            términos del día en que se hicieron.
          </p>
        </Section>

        <Section title="10. Ley que aplica">
          <p>Estos términos se rigen por las leyes de Colombia.</p>
        </Section>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-sm text-muted-foreground">
        © 2026 3R — Páginas web para negocios ·{' '}
        <Link href="/privacidad" className="transition hover:text-foreground">
          Política de privacidad
        </Link>
      </footer>
    </div>
  );
}
