import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/actions';
import { Logo } from '@/components/logo';
import { ResendVerificationButton } from '@/components/resend-verification-button';
import { authedApi } from '@/lib/api';
import type { CurrentUser } from '@/lib/types';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: user } = await authedApi<CurrentUser>('/auth/me');
  const name = user.firstName || user.email;
  const isStaff = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');

  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[1224px] items-center justify-between px-4 py-5 sm:px-[34px]">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="3R — Inicio" className="text-foreground">
            <Logo size={36} />
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-6 sm:flex">
            <Link href="/dashboard" className="text-[14.875px] text-foreground">
              Mis pedidos
            </Link>
            {isStaff ? (
              <Link href="/admin" className="text-[14.875px] text-primary hover:underline">
                Administración
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:block" title={user.email}>
            {name}
          </span>
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
      {!user.emailVerifiedAt ? (
        <div className="mx-auto w-full max-w-[1224px] px-4 sm:px-[34px]">
          <p className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f7cb58]/30 bg-[#f7cb58]/10 px-4 py-3 text-[13.5px] text-foreground">
            <span>Confirma tu correo para poder pedir tu página. Revisa tu bandeja de entrada.</span>
            <ResendVerificationButton className="shrink-0 rounded-full bg-[#f7cb58]/20 px-3.5 py-1.5 text-[12.5px] font-medium text-foreground transition hover:bg-[#f7cb58]/30" />
          </p>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-[1224px] px-4 pb-24 pt-6 sm:px-[34px]">{children}</main>
    </div>
  );
}
