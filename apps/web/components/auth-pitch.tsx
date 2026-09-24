import Link from 'next/link';
import { DevicesIcon, GlobeIcon, HistoryIcon, PointerIcon, TemplateIcon } from '@/components/icons';

const POINTS = [
  { icon: <TemplateIcon />, text: 'Diseño a tu medida, no una plantilla genérica' },
  { icon: <DevicesIcon />, text: 'Se ve bien en celular, tablet y computador' },
  { icon: <PointerIcon />, text: 'Tú no tocas nada técnico — nosotros hacemos todo' },
  { icon: <GlobeIcon />, text: 'Te ayudamos con tu dominio y hosting' },
  { icon: <HistoryIcon />, text: 'Sigues el avance de tu pedido en tiempo real' },
];

/** Lo que ve alguien a punto de crear cuenta: por qué le conviene, no solo el formulario. */
export function RegisterPitch() {
  return (
    <div>
      <p className="text-[12.75px] uppercase tracking-[0.3em] text-muted-foreground">Antes de entrar</p>
      <h2 className="mt-4 font-display text-[34px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[42px]">
        Tu negocio se merece verse{' '}
        <span className="text-spectrum">tan bien en internet</span> como en persona
      </h2>
      <p className="mt-4 max-w-[440px] text-[16px] leading-[1.6] text-muted-foreground">
        Miles de personas buscan negocios como el tuyo todos los días en Google y en redes. Si no tienes página, la
        mitad ni te encuentra. Nosotros te la diseñamos, construimos y publicamos — tú solo cuentas de qué trata tu
        negocio.
      </p>
      <ul className="mt-7 space-y-3.5">
        {POINTS.map((p) => (
          <li key={p.text} className="flex items-center gap-3 text-[15px] text-foreground/90">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">{p.icon}</span>
            {p.text}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
        <p className="font-display text-[22px] font-bold text-foreground">Desde $350.000</p>
        <p className="text-[13.5px] text-muted-foreground">pago único, sin mensualidad obligatoria</p>
      </div>
      <Link href="/#trabajos" className="mt-5 inline-block text-[14px] text-primary hover:underline">
        Mira páginas reales que ya entregamos ↗
      </Link>
    </div>
  );
}

/** Lo que ve alguien que vuelve a entrar: ya está convencido, aquí solo un empujón cálido. */
export function LoginPitch() {
  return (
    <div>
      <p className="text-[12.75px] uppercase tracking-[0.3em] text-muted-foreground">Bienvenido de nuevo</p>
      <h2 className="mt-4 font-display text-[34px] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[42px]">
        Tu página, en <span className="text-spectrum">buenas manos</span>
      </h2>
      <p className="mt-4 max-w-[440px] text-[16px] leading-[1.6] text-muted-foreground">
        Entra para ver en qué va tu pedido, hablar con nosotros y revisar tu página en cuanto esté lista.
      </p>
      <ul className="mt-7 space-y-3.5">
        {POINTS.slice(0, 3).map((p) => (
          <li key={p.text} className="flex items-center gap-3 text-[15px] text-foreground/90">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">{p.icon}</span>
            {p.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
