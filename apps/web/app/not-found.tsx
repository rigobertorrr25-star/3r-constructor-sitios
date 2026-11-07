import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export const metadata: Metadata = { title: 'Página no encontrada — 3R', robots: { index: false } };

// Página 404 propia (8 nov 2026, pedido de Rigoberto).
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <Logo size={56} />
      <h1 className="font-display text-[34px] font-bold leading-tight tracking-tight text-foreground sm:text-[42px]">Esta página no existe</h1>
      <p className="max-w-[440px] text-[15.5px] text-muted-foreground">
        Puede que el enlace esté mal escrito o que la página ya no esté. Desde el inicio encuentras todo.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90">
          Ir al inicio
        </Link>
        <a
          href={'https://wa.me/573107907194?text=' + encodeURIComponent('Hola, llegué a una página de 3R que no existe')}
          className="rounded-xl border border-white/[0.12] px-5 py-3 font-semibold text-foreground transition hover:bg-white/[0.06]"
        >
          Escríbenos por WhatsApp
        </a>
      </div>
    </main>
  );
}
