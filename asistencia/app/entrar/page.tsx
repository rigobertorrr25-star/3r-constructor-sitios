import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LangSwitch } from '@/components/lang-switch';
import { LoginForm } from '@/components/login-form';
import { card } from '@/components/ui';
import { isLoggedIn } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${t(lang, 'signInTitle')} — ${t(lang, 'appName')}` };
}

export default async function LoginPage() {
  if (await isLoggedIn()) redirect('/panel');
  const lang = await getLang();
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <LangSwitch lang={lang} className="absolute top-4 right-4" />
      <div className="w-full max-w-[400px]">
        <Image
          src="/hero-lion.png"
          alt={t(lang, 'lionWavingAlt')}
          width={220}
          height={220}
          priority
          className="mx-auto -mb-6 rounded-full shadow-[var(--shadow-glow)]"
        />
        <div className={`${card} pt-10`}>
          <h1 className="text-center font-display text-[26px] font-bold tracking-tight text-foreground">{t(lang, 'appName')}</h1>
          <p className="mt-1 mb-6 text-center text-[15px] text-muted-foreground">{t(lang, 'signInSubtitle')}</p>
          <LoginForm lang={lang} />
        </div>
      </div>
    </main>
  );
}
