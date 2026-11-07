import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal';
import { getLang } from '@/lib/lang';

export const metadata: Metadata = { title: 'Términos y condiciones — Asistencia 3R' };

// Términos y condiciones (8 nov 2026, pedido de Rigoberto). Si cambia el español, cambiar también el inglés.
export default async function TermsPage() {
  const lang = await getLang();
  return lang === 'en' ? (
    <LegalPage lang={lang} title="Terms and conditions" version="Effective November 8, 2026.">
      <section><h2>1. The service</h2><p>3R Attendance is a system by 3R (Rigoberto Rincón, Cartagena, Colombia) to record employees&apos; clock-in and clock-out with a QR code. By using it, the business and its staff accept these terms.</p></section>
      <section><h2>2. Plan and payment</h2><p>The business pays the plan agreed with 3R, in Colombian pesos. It can cancel whenever it wants; it stops being charged from the next period.</p></section>
      <section><h2>3. PINs and passwords</h2><p>Each employee clocks in with their own PIN and must not share it or clock in for someone else. Managers keep their password private.</p></section>
      <section><h2>4. The data</h2><p>Attendance records belong to the business. 3R uses them only to provide the service (see the <Link href="/privacidad">privacy policy</Link>) and hands them over if the business leaves.</p></section>
      <section><h2>5. Availability</h2><p>We work to keep the system running all the time, but we depend on internet and hosting providers. If something fails, we fix it as soon as possible.</p></section>
      <section><h2>6. Applicable law</h2><p>These terms are governed by the laws of Colombia.</p></section>
    </LegalPage>
  ) : (
    <LegalPage lang={lang} title="Términos y condiciones" version="Vigentes desde el 8 de noviembre de 2026.">
      <section><h2>1. El servicio</h2><p>Asistencia 3R es un sistema de 3R (Rigoberto Rincón, Cartagena, Colombia) para registrar la entrada y salida de los empleados con código QR. Al usarlo, el negocio y su equipo aceptan estos términos.</p></section>
      <section><h2>2. Plan y pago</h2><p>El negocio paga el plan acordado con 3R, en pesos colombianos. Puede cancelarlo cuando quiera; deja de cobrarse desde el periodo siguiente.</p></section>
      <section><h2>3. PIN y claves</h2><p>Cada empleado marca con su propio PIN y no debe compartirlo ni marcar por otra persona. Los jefes cuidan su clave.</p></section>
      <section><h2>4. Los datos</h2><p>Los registros de asistencia son del negocio. 3R los usa solo para prestar el servicio (ver la <Link href="/privacidad">política de privacidad</Link>) y se los entrega si deja de usarlo.</p></section>
      <section><h2>5. Disponibilidad</h2><p>Trabajamos para que el sistema funcione todo el tiempo, pero dependemos de internet y de los proveedores donde está alojado. Si algo falla, lo arreglamos lo antes posible.</p></section>
      <section><h2>6. Ley que aplica</h2><p>Estos términos se rigen por las leyes de Colombia.</p></section>
    </LegalPage>
  );
}
