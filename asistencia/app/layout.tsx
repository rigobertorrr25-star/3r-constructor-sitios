import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, 'appName'), description: t(lang, 'appDescription'), robots: { index: false, follow: false } };
}

export const viewport: Viewport = { themeColor: '#000103' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
