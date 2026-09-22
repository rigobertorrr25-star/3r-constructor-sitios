import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/actions';
import { Logo } from '@/components/logo';
import { authedApi } from '@/lib/api';
import type { CurrentUser } from '@/lib/types';

const nav = [
  { href: '/admin', label: 'Pedidos' },
  { href: '/admin/paquetes', label: 'Paquetes' },
  { href: '/admin/portafolio', label: 'Portafolio' },
  { href: '/admin/sitios', label: 'Sitios' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { data: user } = await authedApi<CurrentUser>('/auth/me');
  // Quien no es del equipo ve un 404, no una pantalla que confirme que el panel existe.
  if (!user.roles.includes('ADMIN') && !user.roles.includes('SUPER_ADMIN')) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[1224px] flex-wrap items-center justify-between gap-y-3 px-4 py-5 sm:px-[34px]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link href="/admin" aria-label="3R — Administración" className="flex items-center gap-3 text-foreground">
            <Logo size={36} />
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">Equipo</span>
          </Link>
          <nav aria-label="Administración" className="flex items-center gap-5">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-[14.875px] text-muted-foreground transition hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden text-[14px] text-muted-foreground transition hover:text-foreground sm:block">
            Ver como cliente
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full border border-white/[0.08] bg-white/[0.014] px-[17px] py-[8.5px] text-[14.875px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1224px] px-4 pb-24 pt-6 sm:px-[34px]">{children}</main>
    </div>
  );
}
