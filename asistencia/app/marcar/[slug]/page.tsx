import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LangSwitch } from '@/components/lang-switch';
import { PunchForm } from '@/components/punch-form';
import { Alert, Lion, card } from '@/components/ui';
import { t, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { AppError, getPublicBusiness, getPunchScreen } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'punchTitle') };
}

function Shell({ title, lang, children }: { title: string; lang: Lang; children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-14" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <LangSwitch lang={lang} className="absolute top-4 right-4" />
      <div className={`${card} w-full max-w-[420px]`}>
        <h1 className="mb-6 text-center font-display text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
        {children}
      </div>
    </main>
  );
}

const scanAgain = (lang: Lang) => (
  <div className="space-y-4 text-center">
    <Lion size={72} className="mx-auto" alt={t(lang, 'lionAlt')} />
    <p className="text-[15px] text-muted-foreground">{t(lang, 'scanPrompt')}</p>
  </div>
);

export default async function PunchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { slug } = await params;
  const { c } = await searchParams;
  const code = typeof c === 'string' ? c : '';
  const lang = await getLang();

  // notFound() se llama fuera del try: por dentro lanza un error propio de Next que el catch atraparía.
  let business: { name: string } | null = null;
  let screen: Awaited<ReturnType<typeof getPunchScreen>> | null = null;
  let problem: 'expired' | 'offline' | null = null;
  try {
    business = await getPublicBusiness(slug);
    if (business && code) screen = await getPunchScreen(slug, code);
  } catch (error) {
    if (!(error instanceof AppError)) console.error(error);
    problem = error instanceof AppError && error.code === 'CODE_EXPIRED' ? 'expired' : 'offline';
  }

  if (problem === 'offline') {
    return (
      <Shell title={t(lang, 'punchFallbackTitle')} lang={lang}>
        <p className="text-center text-[15px] text-muted-foreground">{t(lang, 'offline')}</p>
      </Shell>
    );
  }
  if (!business) notFound();
  if (problem === 'expired') {
    return (
      <Shell title={business.name} lang={lang}>
        <div className="space-y-4">
          <Alert>{t(lang, 'errCodeExpired')}</Alert>
          {scanAgain(lang)}
        </div>
      </Shell>
    );
  }
  if (!screen) return <Shell title={business.name} lang={lang}>{scanAgain(lang)}</Shell>;
  return (
    <Shell title={screen.name} lang={lang}>
      <PunchForm slug={slug} code={code} employees={screen.employees} lang={lang} />
    </Shell>
  );
}
