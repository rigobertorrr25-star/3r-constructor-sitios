import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/actions';
import { LangSwitch } from '@/components/lang-switch';
import { Lion, quietButton } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const lang = await getLang();
  return (
    <div className="min-h-dvh" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href="/panel" className="flex items-center gap-3 text-foreground">
          <Lion size={40} alt={t(lang, 'lionAlt')} />
          <span className="hidden font-display text-[18px] font-semibold min-[430px]:inline">{t(lang, 'appName')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch lang={lang} />
          <form action={logoutAction}>
            <button type="submit" className={quietButton}>
              {t(lang, 'signOut')}
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 sm:px-8">{children}</main>
    </div>
  );
}
