import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';
import { LangProvider } from '@/components/i18n';
import { getLang } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Restaurant Control — 3R',
  description: 'Mesas, pedidos, cocina, caja e inventario de tu restaurante o bar, en un solo lugar.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#000103' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
