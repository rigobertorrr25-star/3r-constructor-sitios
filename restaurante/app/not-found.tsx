import type { Metadata } from 'next';
import Link from 'next/link';
import { Lion } from '@/components/ui';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Página no encontrada — Restaurant Control' };

// Página 404 propia (8 nov 2026, pedido de Rigoberto).
export default async function NotFound() {
  const t = await getT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <Lion size={64} />
      <h1 className="font-display text-[30px] font-bold leading-tight text-foreground">{t('Esta página no existe')}</h1>
      <p className="max-w-[420px] text-[15.5px] text-muted-foreground">{t('Puede que el enlace esté mal escrito o que la página ya no esté.')}</p>
      <Link href="/" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90">
        {t('Ir al inicio')}
      </Link>
    </main>
  );
}
