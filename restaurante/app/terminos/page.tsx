import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section } from '@/components/legal-page';
import { getLang } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Términos y condiciones — Restaurant Control',
  description: 'Las reglas de uso de Restaurant Control para restaurantes y bares: suscripción, datos, disponibilidad y soporte.',
};

// Términos y condiciones (8 nov 2026, pedido de Rigoberto). Mismo criterio que /privacidad: los dos idiomas aquí.
export default async function TermsPage() {
  const en = (await getLang()) === 'en';
  return en ? (
    <LegalPage title="Terms and conditions" version="Effective November 8, 2026." back="Back">
      <Section title="1. The service">
        <p>Restaurant Control is software by 3R (Rigoberto Rincón, Cartagena, Colombia) for restaurants and bars: tables, orders, kitchen, till, inventory, bookings and reports. By using it, the restaurant and its staff accept these terms.</p>
      </Section>
      <Section title="2. Plan and payment">
        <p>The restaurant pays the plan agreed with 3R, monthly or yearly, in Colombian pesos. It can cancel whenever it wants; it stops being charged from the next period.</p>
      </Section>
      <Section title="3. Accounts and PINs">
        <p>Each person signs in with their own PIN and must not share it. The owner decides who has access and with which role, and answers for what is done with their accounts.</p>
      </Section>
      <Section title="4. The restaurant's data">
        <p>Sales, menu, inventory and customer data belong to the restaurant. 3R uses them only to provide the service (see the <Link href="/privacidad">privacy policy</Link>) and hands them over if the restaurant leaves.</p>
      </Section>
      <Section title="5. Availability and support">
        <p>We work to keep the system running all the time, but we depend on internet and hosting providers. If something fails, we fix it as soon as possible. The restaurant keeps its own legal obligations (taxes, electronic invoicing with its provider).</p>
      </Section>
      <Section title="6. Proper use">
        <p>Do not use the system for illegal activities, do not try to access other restaurants&apos; data and do not try to break its security.</p>
      </Section>
      <Section title="7. Applicable law">
        <p>These terms are governed by the laws of Colombia.</p>
      </Section>
    </LegalPage>
  ) : (
    <LegalPage title="Términos y condiciones" version="Vigentes desde el 8 de noviembre de 2026." back="Volver">
      <Section title="1. El servicio">
        <p>Restaurant Control es un programa de 3R (Rigoberto Rincón, Cartagena, Colombia) para restaurantes y bares: mesas, pedidos, cocina, caja, inventario, reservas e informes. Al usarlo, el restaurante y su equipo aceptan estos términos.</p>
      </Section>
      <Section title="2. Plan y pago">
        <p>El restaurante paga el plan acordado con 3R, por mes o por año, en pesos colombianos. Puede cancelarlo cuando quiera; deja de cobrarse desde el periodo siguiente.</p>
      </Section>
      <Section title="3. Cuentas y PIN">
        <p>Cada persona entra con su propio PIN y no debe compartirlo. El dueño decide quién entra y con qué rol, y responde por lo que se haga con sus cuentas.</p>
      </Section>
      <Section title="4. Los datos del restaurante">
        <p>Las ventas, la carta, el inventario y los datos de sus clientes son del restaurante. 3R los usa solo para prestar el servicio (ver la <Link href="/privacidad">política de privacidad</Link>) y se los entrega si deja de usarlo.</p>
      </Section>
      <Section title="5. Disponibilidad y soporte">
        <p>Trabajamos para que el sistema funcione todo el tiempo, pero dependemos de internet y de los proveedores donde está alojado. Si algo falla, lo arreglamos lo antes posible. El restaurante sigue a cargo de sus obligaciones legales (impuestos, facturación electrónica con su proveedor).</p>
      </Section>
      <Section title="6. Buen uso">
        <p>No usar el sistema para actividades ilegales, no intentar entrar a los datos de otros restaurantes ni romper su seguridad.</p>
      </Section>
      <Section title="7. Ley que aplica">
        <p>Estos términos se rigen por las leyes de Colombia.</p>
      </Section>
    </LegalPage>
  );
}
