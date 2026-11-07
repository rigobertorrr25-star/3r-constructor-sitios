import Link from 'next/link';
import type { ReactNode } from 'react';
import { Lion } from '@/components/ui';
import { LegalLinks } from '@/components/legal-links';

/** Marco de las páginas de privacidad y términos (8 nov 2026, pedido de Rigoberto: los 20 puntos antes de publicar). */
export function LegalPage({ title, version, back, children }: { title: string; version: string; back: string; children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[760px] items-center justify-between px-4 py-6">
        <Link href="/" aria-label="Restaurant Control">
          <Lion size={40} />
        </Link>
        <Link href="/" className="text-sm text-muted-foreground transition hover:text-foreground">
          {back}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[760px] space-y-8 px-4 pb-16 pt-4 text-[15.5px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <div className="space-y-2">
          <h1 className="font-display text-[32px] font-bold leading-tight text-foreground sm:text-[40px]">{title}</h1>
          <p>{version}</p>
        </div>
        {children}
      </main>
      <footer className="border-t border-white/[0.06] py-8">
        <LegalLinks />
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
