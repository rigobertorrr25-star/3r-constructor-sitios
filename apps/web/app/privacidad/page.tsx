import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Política de privacidad — 3R',
  description: 'Cómo 3R recoge, usa y protege tus datos personales, y cómo ejercer tus derechos (Ley 1581 de 2012).',
};

// Fecha de la versión vigente. Si cambias el texto, cambia también PRIVACY_POLICY_VERSION en
// apps/api/src/auth/auth.service.ts: así queda registrado qué versión aceptó cada cuenta.
const VERSION = '26 de septiembre de 2026';

// Datos del responsable. Los campos vacíos no se muestran.
const RESPONSABLE = {
  nombre: 'Rigoberto Rincón, bajo la marca 3R',
  documento: 'C.C. 1.007.401.985', // cédula o NIT
  ciudad: 'Cartagena, Colombia',
  correo: 'rigoberto.rrr25@gmail.com',
  whatsapp: '+57 310 790 7194',
  whatsappHref: 'https://wa.me/573107907194?text=' + encodeURIComponent('Hola, tengo una solicitud sobre mis datos personales'),
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  const channels = (
    <ul className="list-disc space-y-1 pl-5">
      <li>
        WhatsApp:{' '}
        <a href={RESPONSABLE.whatsappHref} className="text-primary hover:underline">
          {RESPONSABLE.whatsapp}
        </a>
      </li>
      {RESPONSABLE.correo ? (
        <li>
          Correo:{' '}
          <a href={`mailto:${RESPONSABLE.correo}`} className="text-primary hover:underline">
            {RESPONSABLE.correo}
          </a>
        </li>
      ) : null}
    </ul>
  );

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
            Política de privacidad y tratamiento de datos
          </h1>
          <p>Vigente desde el {VERSION}.</p>
          <p>
            Aquí te contamos, sin letra chica, qué datos tuyos recogemos, para qué los usamos y cómo puedes pedir que los
            consultemos, corrijamos o borremos. Esta política cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013 de
            Colombia.
          </p>
        </div>

        <Section title="1. Quién es el responsable">
          <ul className="list-disc space-y-1 pl-5">
            <li>{RESPONSABLE.nombre}</li>
            {RESPONSABLE.documento ? <li>Documento: {RESPONSABLE.documento}</li> : null}
            {RESPONSABLE.ciudad ? <li>Ciudad: {RESPONSABLE.ciudad}</li> : null}
            <li>
              Sitio web:{' '}
              <Link href="/" className="text-primary hover:underline">
                3rpaginas.com
              </Link>
            </li>
          </ul>
          <p>Para cualquier tema de tus datos puedes escribirnos por:</p>
          {channels}
        </Section>

        <Section title="2. Qué datos recogemos">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Tu cuenta:</strong> nombre, correo y contraseña. La contraseña se guarda
              cifrada: nadie, ni siquiera nosotros, puede leerla.
            </li>
            <li>
              <strong className="text-foreground">Tu pedido:</strong> el nombre y tipo de tu negocio, ciudad, teléfono o
              WhatsApp, la descripción de lo que quieres, referencias, textos, fotos y logo que nos compartas.
            </li>
            <li>
              <strong className="text-foreground">Lo que conversamos:</strong> los mensajes que nos escribes desde tu
              panel y el estado de tus pagos.
            </li>
            <li>
              <strong className="text-foreground">Datos técnicos:</strong> la dirección IP y la fecha de tus ingresos,
              para proteger tu cuenta y evitar abusos.
            </li>
          </ul>
          <p>No pedimos datos sensibles (salud, religión, orientación política, biometría) ni datos de niños.</p>
        </Section>

        <Section title="3. Para qué los usamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Crear y proteger tu cuenta.</li>
            <li>Diseñar, publicar y mantener la página web que nos pediste.</li>
            <li>Escribirte sobre tu pedido: avances, pagos, entregas y respuestas a tus mensajes.</li>
            <li>Llevar el registro de pagos que exige la ley.</li>
            <li>Mostrar tu página en nuestro portafolio, solo si tú nos lo autorizas aparte.</li>
          </ul>
          <p>No vendemos ni alquilamos tus datos, y no te mandamos publicidad sin tu permiso.</p>
        </Section>

        <Section title="4. Datos de los visitantes de las páginas que hacemos">
          <p>
            Las páginas de nuestros clientes pueden tener un formulario de contacto. Lo que escribe un visitante ahí
            (nombre, correo, teléfono y mensaje) le llega al negocio dueño de esa página, que es el responsable de esos
            datos. 3R solo los guarda y los entrega a ese negocio, como encargado. El formulario pide la autorización del
            visitante antes de enviar.
          </p>
        </Section>

        <Section title="5. Con quién los compartimos">
          <p>
            Para que la plataforma funcione usamos proveedores de tecnología que guardan o procesan datos por nosotros:
            alojamiento de la página y del servidor (Vercel y Render), base de datos (Neon), archivos e imágenes
            (Cloudflare) y envío de correos (Resend). Sus servidores pueden estar fuera de Colombia, principalmente en
            Estados Unidos. Solo usan tus datos para prestarnos ese servicio y con medidas de seguridad adecuadas. Al
            aceptar esta política autorizas esa transferencia.
          </p>
          <p>Fuera de eso, solo entregamos datos si una autoridad lo pide con una orden legal.</p>
        </Section>

        <Section title="6. Cookies">
          <p>
            Usamos solo las cookies necesarias para mantener tu sesión abierta. No usamos cookies de publicidad ni de
            seguimiento.
          </p>
        </Section>

        <Section title="7. Tus derechos">
          <p>Como titular de tus datos puedes, en cualquier momento y sin costo:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Conocer qué datos tuyos tenemos.</li>
            <li>Actualizarlos o corregirlos.</li>
            <li>Pedir que los borremos, si no hay una obligación legal o de contrato que nos obligue a guardarlos.</li>
            <li>Retirar la autorización que nos diste.</li>
            <li>Pedir prueba de la autorización que nos diste.</li>
            <li>
              Presentar una queja ante la Superintendencia de Industria y Comercio (SIC) si no atendemos tu solicitud.
            </li>
          </ul>
        </Section>

        <Section title="8. Cómo hacer una consulta o un reclamo">
          <p>Escríbenos por cualquiera de estos canales, con tu nombre, el correo de tu cuenta y lo que necesitas:</p>
          {channels}
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Consultas</strong> (saber qué datos tenemos): te respondemos en máximo
              10 días hábiles. Si necesitamos más tiempo te avisamos, y no pasará de 5 días hábiles más.
            </li>
            <li>
              <strong className="text-foreground">Reclamos</strong> (corregir, borrar o retirar la autorización): te
              respondemos en máximo 15 días hábiles. Si necesitamos más tiempo te avisamos, y no pasará de 8 días hábiles
              más.
            </li>
          </ul>
        </Section>

        <Section title="9. Cuánto tiempo los guardamos">
          <p>
            Mientras tengas tu cuenta o tu página activa con nosotros. Después los borramos, salvo lo que la ley nos obliga
            a conservar, como los registros de pagos.
          </p>
        </Section>

        <Section title="10. Seguridad">
          <p>
            Tu sesión viaja cifrada (HTTPS), las contraseñas se guardan cifradas, limitamos los intentos de inicio de
            sesión y solo el equipo de 3R puede ver tus pedidos. Ningún sistema es perfecto, pero si pasara algo que afecte
            tus datos te avisaríamos.
          </p>
        </Section>

        <Section title="11. Cambios a esta política">
          <p>
            Si cambiamos algo importante, lo publicamos aquí con la fecha nueva y te avisamos por correo antes de que
            empiece a aplicar.
          </p>
        </Section>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-sm text-muted-foreground">
        © 2026 3R — Páginas web para negocios
      </footer>
    </div>
  );
}
