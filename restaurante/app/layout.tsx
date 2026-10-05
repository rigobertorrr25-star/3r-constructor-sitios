import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';

export const metadata: Metadata = {
  title: 'Restaurant Control — 3R',
  description: 'Mesas, pedidos, cocina, caja e inventario de tu restaurante o bar, en un solo lugar.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#000103' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
