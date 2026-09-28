import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/actions';
import { Lion, quietButton } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/panel" className="flex items-center gap-3 text-foreground">
          <Lion size={40} />
          <span className="font-display text-[18px] font-semibold">Asistencia 3R</span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={quietButton}>
            Salir
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 sm:px-8">{children}</main>
    </div>
  );
}
