import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/actions';
import { LangSwitch } from '@/components/lang-switch';
import { Lion, glassDark, onDarkButton } from '@/components/ui';
import { requireViewer } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const lang = await getLang();
  const who = viewer.role === 'manager' ? viewer.name : t(lang, 'adminLabel');
  const initials = who
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <div className="min-h-dvh">
      <header className={`${glassDark} mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-[1280px] items-center justify-between gap-3 px-3 py-2.5 sm:w-[calc(100%-4rem)]`}>
        <Link href="/panel" className="flex items-center gap-3 rounded-2xl px-1 text-white">
          <Lion size={40} alt={t(lang, 'lionAlt')} />
          <span className="hidden leading-tight min-[430px]:block">
            <span className="block font-display text-[16px] font-semibold">{t(lang, 'appName')}</span>
            <span className="block text-[12px] text-white/60">{t(lang, 'controlCenter')}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LangSwitch lang={lang} />
          <span className="hidden items-center gap-2 rounded-full py-1 pr-3 pl-1 sm:flex">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#1aa3d9] text-[13px] font-semibold text-white">{initials}</span>
            <span className="leading-tight">
              <span className="block text-[13.5px] font-semibold text-white">{who}</span>
              <span className="block text-[11.5px] text-white/60">{viewer.role === 'manager' ? t(lang, 'viewOnly') : t(lang, 'fullAccess')}</span>
            </span>
          </span>
          <form action={logoutAction}>
            <button type="submit" className={onDarkButton}>
              {t(lang, 'signOut')}
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-[calc(100%-2rem)] max-w-[1280px] pt-5 pb-10 sm:w-[calc(100%-4rem)]">{children}</main>
      <footer className="mx-auto w-[calc(100%-2rem)] max-w-[1280px] pb-10 text-[12px] text-white/55 sm:w-[calc(100%-4rem)]">{t(lang, 'avatarCredit')}</footer>
    </div>
  );
}
