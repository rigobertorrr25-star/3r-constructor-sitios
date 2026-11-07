import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal';
import { getLang } from '@/lib/lang';

export const metadata: Metadata = { title: 'Política de privacidad — Asistencia 3R' };

// Política de privacidad (8 nov 2026, pedido de Rigoberto). Si cambia el español, cambiar también el inglés.
const WA = 'https://wa.me/573107907194';

export default async function PrivacyPage() {
  const lang = await getLang();
  return lang === 'en' ? (
    <LegalPage lang={lang} title="Privacy policy" version="Effective November 8, 2026. Complies with Colombian Law 1581 of 2012 and Decree 1377 of 2013.">
      <section>
        <h2>1. Who is responsible</h2>
        <p>Each business that uses 3R Attendance is responsible for its employees&apos; data. 3R (Rigoberto Rincón, Cartagena, Colombia) runs the system on the business&apos;s behalf. Contact: <a href={WA}>WhatsApp +57 310 790 7194</a> or <a href="mailto:rigoberto.rrr25@gmail.com">rigoberto.rrr25@gmail.com</a>.</p>
      </section>
      <section>
        <h2>2. What data we keep</h2>
        <ul>
          <li><strong>Employees:</strong> name, PIN (stored encrypted, never as typed), the time of each clock-in and clock-out, and any manual correction.</li>
          <li><strong>Managers:</strong> name and password (stored encrypted).</li>
        </ul>
        <p>We do not take photos, location or fingerprints.</p>
      </section>
      <section>
        <h2>3. What we use it for</h2>
        <p>Only to record attendance and give the business its hours report. We do not sell data or use it for advertising.</p>
      </section>
      <section>
        <h2>4. Who else sees it</h2>
        <p>The business&apos;s managers and the hosting providers (Vercel, Neon), whose servers may be outside Colombia.</p>
      </section>
      <section>
        <h2>5. Cookies</h2>
        <p>Only the cookies needed to keep the session open and remember the language. No advertising or tracking cookies.</p>
      </section>
      <section>
        <h2>6. Your rights</h2>
        <p>You can ask at any time, free of charge, to see, correct or delete your data. Write to your employer or to us. We answer queries within 10 business days and claims within 15 business days. You can also go to Colombia&apos;s Superintendencia de Industria y Comercio.</p>
      </section>
      <section>
        <h2>7. How long we keep it</h2>
        <p>While the business uses the system, plus what labor law requires.</p>
      </section>
    </LegalPage>
  ) : (
    <LegalPage lang={lang} title="Política de privacidad" version="Vigente desde el 8 de noviembre de 2026. Cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.">
      <section>
        <h2>1. Quién es el responsable</h2>
        <p>Cada negocio que usa Asistencia 3R es responsable de los datos de sus empleados. 3R (Rigoberto Rincón, Cartagena, Colombia) maneja el sistema por encargo del negocio. Contacto: <a href={WA}>WhatsApp +57 310 790 7194</a> o <a href="mailto:rigoberto.rrr25@gmail.com">rigoberto.rrr25@gmail.com</a>.</p>
      </section>
      <section>
        <h2>2. Qué datos guardamos</h2>
        <ul>
          <li><strong>De los empleados:</strong> nombre, PIN (guardado cifrado, nunca tal cual), la hora de cada entrada y salida, y las correcciones hechas a mano.</li>
          <li><strong>De los jefes:</strong> nombre y clave (guardada cifrada).</li>
        </ul>
        <p>No tomamos fotos, ubicación ni huellas.</p>
      </section>
      <section>
        <h2>3. Para qué los usamos</h2>
        <p>Solo para registrar la asistencia y darle al negocio el reporte de horas. No vendemos datos ni los usamos para publicidad.</p>
      </section>
      <section>
        <h2>4. Quién más los ve</h2>
        <p>Los jefes del negocio y los proveedores donde está el sistema (Vercel, Neon), cuyos servidores pueden estar fuera de Colombia.</p>
      </section>
      <section>
        <h2>5. Cookies</h2>
        <p>Solo las necesarias para mantener la sesión abierta y recordar el idioma. Nada de publicidad ni seguimiento.</p>
      </section>
      <section>
        <h2>6. Tus derechos</h2>
        <p>Puedes pedir en cualquier momento, sin costo, ver, corregir o borrar tus datos. Escríbele a tu empleador o a nosotros. Respondemos consultas en máximo 10 días hábiles y reclamos en 15 días hábiles. También puedes acudir a la Superintendencia de Industria y Comercio.</p>
      </section>
      <section>
        <h2>7. Cuánto tiempo los guardamos</h2>
        <p>Mientras el negocio use el sistema, más lo que exija la ley laboral.</p>
      </section>
    </LegalPage>
  );
}
