// Introducción para el cliente dentro de su cuenta: qué es 3R y por qué le sirve una página, contado con un día
// normal de su negocio (la portada lo cuenta con problemas; aquí se cuenta con horas del día).
import { Reveal } from '@/components/reveal';

const day = [
  {
    time: '11:40 a. m.',
    moment: 'Alguien que no te conoce busca «almuerzo cerca» en el celular.',
    without: 'Salen otros negocios con fotos y precios. El tuyo no aparece.',
    with: 'Sales tú, con tu menú, tu dirección y un botón para escribirte.',
  },
  {
    time: '3:15 p. m.',
    moment: 'Te escriben al WhatsApp: «¿cuánto vale?», «¿hasta qué hora abren?».',
    without: 'Respondes uno por uno mientras atiendes el local.',
    with: 'Mandas tu enlace. Ahí están los precios, el horario y cómo llegar.',
  },
  {
    time: '8:30 p. m.',
    moment: 'Un cliente contento quiere recomendarte a un amigo.',
    without: 'Le pasa tu Instagram y el amigo no encuentra ni el menú ni la dirección.',
    with: 'Le pasa tu página y el amigo ya sabe qué pedir antes de llegar.',
  },
];

const reasons = [
  {
    title: 'Tu página es tuya',
    text: 'Instagram y Facebook cambian sus reglas cuando quieren y deciden a quién le muestran tus publicaciones. Tu página y tu dirección no cambian.',
  },
  {
    title: 'La gente decide antes de salir de la casa',
    text: 'Busca en el celular, compara fotos y precios, y va a donde encontró lo que buscaba.',
  },
  {
    title: 'Trabaja cuando tú no',
    text: 'A medianoche o un domingo, tu página sigue mostrando tu menú, tu catálogo y tu WhatsApp.',
  },
  {
    title: 'No tienes que saber de tecnología',
    text: 'Nos cuentas cómo es tu negocio y nosotros hacemos lo demás. Tú revisas y apruebas desde aquí.',
  },
];

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

export function WelcomeIntro({ firstName }: { firstName: string | null }) {
  return (
    <div className="space-y-16">
      <Reveal>
        <section aria-labelledby="h-bienvenida" className="max-w-3xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Bienvenido a 3R</p>
          <h1 id="h-bienvenida" className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-[44px]">
            {firstName ? `${firstName}, antes` : 'Antes'} de elegir, <span className="text-spectrum">te contamos quiénes somos</span>
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            3R es un equipo de Cartagena que hace páginas web para negocios como el tuyo: restaurantes, bares, tiendas y servicios. Tú nos cuentas
            cómo es tu negocio y nosotros la diseñamos, la construimos y la publicamos.
          </p>
          <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
            No te vendemos una plantilla para que la llenes tú. Te entregamos tu página lista, con tus fotos, tus precios y tus colores, y la sigues
            aquí mismo mientras la hacemos.
          </p>
        </section>
      </Reveal>

      <section aria-labelledby="h-dia">
        <Reveal>
          <h2 id="h-dia" className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-[32px]">
            Un día normal de tu negocio
          </h2>
          <p className="mt-2 max-w-2xl text-[16px] text-muted-foreground">Lo mismo pasa todos los días. Lo que cambia es si tienes página o no.</p>
        </Reveal>
        <ol className="mt-8 space-y-4">
          {day.map((item, i) => (
            <Reveal as="li" key={item.time} delayMs={i * 90}>
              <div className={`${card} grid gap-5 lg:grid-cols-[180px_1fr_1fr] lg:items-start`}>
                <div>
                  <p className="font-display text-[22px] font-semibold tabular-nums text-foreground">{item.time}</p>
                  <p className="mt-1.5 text-[14.5px] leading-snug text-muted-foreground lg:pr-2">{item.moment}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] px-4 py-3.5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#ffb4b5]">Sin página</p>
                  <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">{item.without}</p>
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary/[0.08] px-4 py-3.5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-primary">Con tu página</p>
                  <p className="mt-1.5 text-[15px] leading-snug text-foreground">{item.with}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      <section aria-labelledby="h-porque">
        <Reveal>
          <h2 id="h-porque" className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-[32px]">
            Por qué dar el paso ahora
          </h2>
          <p className="mt-2 max-w-2xl text-[16px] text-muted-foreground">
            Tus redes sirven para mostrar. La página es donde el cliente encuentra lo que necesita para decidirse.
          </p>
        </Reveal>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reasons.map((reason, i) => (
            <Reveal as="li" key={reason.title} delayMs={i * 80}>
              <div className={`${card} h-full`}>
                <h3 className="font-display text-[19px] font-semibold text-foreground">{reason.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{reason.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>
    </div>
  );
}
