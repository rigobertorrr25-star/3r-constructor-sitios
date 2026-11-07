import Link from 'next/link';
import type { ReactNode } from 'react';
import { Lion, card } from '@/components/ui';
import { t, type Lang } from '@/lib/i18n';

/** Enlaces a privacidad y términos (8 nov 2026, pedido de Rigoberto: los 20 puntos antes de publicar). */
export function LegalLinks({ lang, className = '' }: { lang: Lang; className?: string }) {
  return (
    <p className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-[12.5px] ${className}`}>
      <Link href="/privacidad" className="underline-offset-2 hover:underline">
        {t(lang, 'privacyLink')}
      </Link>
      <Link href="/terminos" className="underline-offset-2 hover:underline">
        {t(lang, 'termsLink')}
      </Link>
    </p>
  );
}

/** Marco de las páginas legales. El texto largo va en los dos idiomas en cada página. */
export function LegalPage({ lang, title, version, children }: { lang: Lang; title: string; version: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mb-6 flex w-full max-w-[720px] items-center justify-between">
        <Lion size={48} alt={t(lang, 'lionAlt')} />
        <Link href="/" className="text-[14px] text-white/80 hover:text-white">
          {t(lang, 'back')}
        </Link>
      </header>
      <article className={`${card} w-full max-w-[720px] space-y-6 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_h2]:font-display [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-foreground [&_section]:space-y-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5`}>
        <div className="space-y-1">
          <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">{title}</h1>
          <p>{version}</p>
        </div>
        {children}
      </article>
      <LegalLinks lang={lang} className="mt-6 text-white/80" />
    </main>
  );
}
