import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { CookieNotice } from '@/components/cookie-notice';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: t(lang, 'appName'), description: t(lang, 'appDescription'), robots: { index: false, follow: false },
    openGraph: { title: t(lang, 'appName'), description: t(lang, 'appDescription'), locale: lang === 'en' ? 'en_US' : 'es_CO', type: 'website' },
  };
}

export const viewport: Viewport = { themeColor: '#0d2c44' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        {children}
        <CookieNotice lang={lang} />
      </body>
    </html>
  );
}
