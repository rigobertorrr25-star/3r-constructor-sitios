// Lo demás que ofrece 3R además de la página. Los botones van a WhatsApp con el mensaje ya escrito:
// el control de asistencia vive en otra dirección y nunca se enlaza desde aquí.
import { ClockIcon, GlobeIcon, QrIcon } from '@/components/icons';
import { Reveal } from '@/components/reveal';
import { whatsappLink } from '@/components/whatsapp-button';
import { formatMoney } from '@/lib/orders';
import { ATTENDANCE_PRICE, ATTENDANCE_SETUP, ATTENDANCE_SETUP_WITH_PAGE } from '@/lib/services';

const pill =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] px-5 py-2.5 text-[14.5px] text-foreground transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export function MoreServices({
  monthlyFromCents,
  domainCents,
  currency,
}: {
  monthlyFromCents: number | null;
  domainCents: number | null;
  currency: string;
}) {
  const services = [
    {
      hue: 275,
      icon: <QrIcon />,
      title: 'Control de asistencia con QR',
      text: 'Tus empleados marcan entrada y salida con su celular escaneando un QR en la entrada. Tú ves horas, llegadas tarde y salidas temprano, y descargas la semana en Excel.',
      price: `${ATTENDANCE_PRICE} al mes`,
      note: `Instalación ${ATTENDANCE_SETUP}. Solo ${ATTENDANCE_SETUP_WITH_PAGE} si también haces tu página con nosotros.`,
      message: 'Hola, me interesa el control de asistencia con QR para mi negocio',
    },
    {
      hue: 150,
      icon: <ClockIcon />,
      title: 'Asistencia mensual de tu página',
      text: 'Mantenemos tu página en línea, te damos soporte y hacemos los cambios pequeños: precios, horarios, fotos y platos nuevos.',
      price: monthlyFromCents !== null ? `Desde ${formatMoney(monthlyFromCents, currency)} al mes` : null,
      note: 'Opcional. La puedes pedir al comprar tu página o después.',
      message: 'Hola, quiero la asistencia mensual para mi página',
    },
    {
      hue: 88,
      icon: <GlobeIcon />,
      title: 'Dominio propio',
      text: 'Tu página en una dirección solo tuya, como tunegocio.com, en vez de tunegocio.3rpaginas.com.',
      price: domainCents !== null ? `${formatMoney(domainCents, currency)} al año` : null,
      note: 'Lo eliges al pedir tu página o te ayudamos a conectarlo después.',
      message: 'Hola, quiero un dominio propio para mi página',
    },
  ];

  return (
    <section aria-labelledby="h-servicios">
      <Reveal>
        <h2 id="h-servicios" className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-[32px]">
          Más servicios
        </h2>
        <p className="mt-2 max-w-2xl text-[16px] text-muted-foreground">Para lo que tu negocio necesita además de la página.</p>
      </Reveal>
      <ul className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {services.map((service, i) => (
          <Reveal as="li" key={service.title} delayMs={i * 90} className="h-full">
            <div className="flex h-full flex-col rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
              <span
                className="flex size-[43px] items-center justify-center rounded-full"
                style={{
                  backgroundColor: `oklch(0.3 0.12 ${service.hue} / 0.5)`,
                  color: `oklch(0.92 0.08 ${service.hue})`,
                }}
              >
                {service.icon}
              </span>
              <h3 className="mt-5 font-display text-[20px] font-semibold text-foreground">{service.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">{service.text}</p>
              {service.price ? <p className="mt-5 font-display text-[22px] font-bold tracking-tight text-foreground">{service.price}</p> : null}
              <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{service.note}</p>
              <a href={whatsappLink(service.message)} target="_blank" rel="noopener noreferrer" className={`${pill} mt-5`}>
                Preguntar por WhatsApp
              </a>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
