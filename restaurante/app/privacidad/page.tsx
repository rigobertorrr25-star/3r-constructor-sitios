import type { Metadata } from 'next';
import { LegalPage, Section } from '@/components/legal-page';
import { getLang } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Política de privacidad — Restaurant Control',
  description: 'Qué datos guarda Restaurant Control, para qué y cómo pedir que se consulten, corrijan o borren (Ley 1581 de 2012).',
};

// Política de privacidad (8 nov 2026, pedido de Rigoberto). Texto largo: va completo en los dos idiomas aquí mismo
// en vez de pasar por t(). Si cambia el español, cambiar también el inglés.
const WA = 'https://wa.me/573107907194';

export default async function PrivacyPage() {
  const en = (await getLang()) === 'en';
  return en ? (
    <LegalPage title="Privacy policy" version="Effective November 8, 2026. Complies with Colombian Law 1581 of 2012 and Decree 1377 of 2013." back="Back">
      <Section title="1. Who is responsible">
        <p>
          Each restaurant or bar that uses Restaurant Control is responsible for the data of its staff and its customers. 3R
          (Rigoberto Rincón, Cartagena, Colombia) runs the software and processes that data on the restaurant&apos;s behalf. Contact:{' '}
          <a href={WA}>WhatsApp +57 310 790 7194</a> or <a href="mailto:rigoberto.rrr25@gmail.com">rigoberto.rrr25@gmail.com</a>.
        </p>
      </Section>
      <Section title="2. What data we keep">
        <ul>
          <li><strong>Staff:</strong> name, role, PIN (stored encrypted), shifts, orders, payments and every change they make (audit log), and the network they sign in from when the restaurant limits sign-in to its own Wi-Fi.</li>
          <li><strong>Customers who book:</strong> name, phone, date, time and number of guests.</li>
          <li><strong>Customers who ask for an invoice:</strong> ID type and number, name and email.</li>
        </ul>
      </Section>
      <Section title="3. What we use it for">
        <p>Only to run the restaurant: take orders, collect payments, close the till, issue invoices, confirm bookings and keep a record of who did what. We do not sell data or use it for advertising.</p>
      </Section>
      <Section title="4. Who else sees it">
        <p>Hosting providers (Render, Vercel, Neon), whose servers may be outside Colombia. The daily summary for owners and reading stock from photos use Anthropic&apos;s AI: it receives sales figures, product names and the photos, never customer data.</p>
      </Section>
      <Section title="5. Cookies">
        <p>Only the cookies needed to keep your session open, remember your language and remember the last restaurant used on that device. No advertising or tracking cookies.</p>
      </Section>
      <Section title="6. Your rights">
        <p>You can ask at any time, free of charge, to see, correct or delete your data, or withdraw your consent. Write to the restaurant or to us. We answer queries within 10 business days and claims within 15 business days. You can also go to Colombia&apos;s Superintendencia de Industria y Comercio.</p>
      </Section>
      <Section title="7. How long we keep it">
        <p>While the restaurant uses Restaurant Control, plus what the law requires (such as sales and invoice records). Nothing is erased by accident: records are voided, not deleted.</p>
      </Section>
      <Section title="8. Security">
        <p>Encrypted connection (HTTPS), encrypted PINs, limited sign-in attempts and permissions by role.</p>
      </Section>
    </LegalPage>
  ) : (
    <LegalPage title="Política de privacidad" version="Vigente desde el 8 de noviembre de 2026. Cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia." back="Volver">
      <Section title="1. Quién es el responsable">
        <p>
          Cada restaurante o bar que usa Restaurant Control es responsable de los datos de su equipo y de sus clientes. 3R
          (Rigoberto Rincón, Cartagena, Colombia) maneja el programa y trata esos datos por encargo del restaurante. Contacto:{' '}
          <a href={WA}>WhatsApp +57 310 790 7194</a> o <a href="mailto:rigoberto.rrr25@gmail.com">rigoberto.rrr25@gmail.com</a>.
        </p>
      </Section>
      <Section title="2. Qué datos guardamos">
        <ul>
          <li><strong>Del equipo:</strong> nombre, rol, PIN (guardado cifrado), turnos, pedidos, cobros y cada cambio que hace (auditoría), y la red desde la que entra cuando el restaurante limita la entrada a su wifi.</li>
          <li><strong>De quien reserva:</strong> nombre, teléfono, fecha, hora y número de personas.</li>
          <li><strong>De quien pide factura:</strong> tipo y número de documento, nombre y correo.</li>
        </ul>
      </Section>
      <Section title="3. Para qué los usamos">
        <p>Solo para que el restaurante funcione: tomar pedidos, cobrar, cerrar la caja, hacer facturas, confirmar reservas y saber quién hizo qué. No vendemos datos ni los usamos para publicidad.</p>
      </Section>
      <Section title="4. Quién más los ve">
        <p>Los proveedores donde está el programa (Render, Vercel, Neon), cuyos servidores pueden estar fuera de Colombia. El resumen diario del dueño y la lectura del inventario desde fotos usan la IA de Anthropic: le llegan cifras de ventas, nombres de productos y las fotos, nunca datos de clientes.</p>
      </Section>
      <Section title="5. Cookies">
        <p>Solo las necesarias para mantener la sesión abierta, recordar el idioma y el último restaurante usado en ese equipo. Nada de publicidad ni seguimiento.</p>
      </Section>
      <Section title="6. Tus derechos">
        <p>Puedes pedir en cualquier momento, sin costo, ver, corregir o borrar tus datos, o retirar tu autorización. Escríbele al restaurante o a nosotros. Respondemos consultas en máximo 10 días hábiles y reclamos en 15 días hábiles. También puedes acudir a la Superintendencia de Industria y Comercio.</p>
      </Section>
      <Section title="7. Cuánto tiempo los guardamos">
        <p>Mientras el restaurante use Restaurant Control, más lo que la ley obliga a conservar (como ventas y facturas). Nada se borra por error: los registros se anulan, no se eliminan.</p>
      </Section>
      <Section title="8. Seguridad">
        <p>Conexión cifrada (HTTPS), PIN cifrados, intentos de entrada limitados y permisos según el rol.</p>
      </Section>
    </LegalPage>
  );
}
