import type { Metadata } from 'next';
import { Kiosk } from '@/components/kiosk';
import { LangSwitch } from '@/components/lang-switch';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'tabletTitle') };
}

export default async function TabletPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const lang = await getLang();
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-8" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <LangSwitch lang={lang} className="absolute top-4 right-4" />
      <Kiosk secret={secret} lang={lang} />
    </main>
  );
}
