import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './logo';

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundImage: 'var(--gradient-hero)' }}
    >
      <Link href="/" aria-label="3R — Inicio" className="mb-8 text-foreground">
        <Logo size={44} />
      </Link>
      <main className="w-full max-w-[420px] rounded-[32px] border border-white/[0.08] bg-card p-8 shadow-[var(--shadow-glass)]">
        <h1 className="font-display text-[28px] font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </main>
      <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}
