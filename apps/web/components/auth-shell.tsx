import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './logo';

/**
 * Con `side`, la pantalla se parte en dos: a la izquierda el argumento de venta (por qué crear la
 * cuenta), a la derecha el formulario. Sin `side` (recuperar, restablecer, verificar — pantallas de
 * trámite, no de venta), se queda centrada como antes.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
  side,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
  side?: ReactNode;
}) {
  const card = (
    <main className="w-full max-w-[420px] rounded-[32px] border border-white/[0.08] bg-card p-8 shadow-[var(--shadow-glass)]">
      <h1 className="font-display text-[28px] font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p>
      <div className="mt-7">{children}</div>
    </main>
  );

  if (!side) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12" style={{ backgroundImage: 'var(--gradient-hero)' }}>
        <Link href="/" aria-label="3R — Inicio" className="mb-8 text-foreground">
          <Logo size={44} />
        </Link>
        {card}
        <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="orb orb-a absolute -top-24 right-[-8%] size-[420px] bg-primary/20 sm:size-[520px]" />
        <span className="orb orb-b absolute bottom-[-16%] left-[-10%] size-[380px] bg-secondary/15 sm:size-[460px]" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1180px] flex-col items-center justify-center gap-10 px-4 py-12 lg:flex-row lg:items-stretch lg:gap-16">
        <div className="flex w-full max-w-[520px] flex-col justify-center py-6 lg:py-12">
          <Link href="/" aria-label="3R — Inicio" className="mb-8 text-foreground">
            <Logo size={40} />
          </Link>
          {side}
        </div>
        <div className="flex w-full max-w-[420px] flex-col justify-center">
          {card}
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  );
}
