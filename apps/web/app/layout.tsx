import type { Metadata } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';

const title = '3R — Páginas web para negocios';
const description = 'Tu página web profesional, hecha por nosotros. Elige un paquete, cuéntanos de tu negocio y recibe tu página lista.';

export const metadata: Metadata = {
  metadataBase: new URL('https://3rpaginas.com'),
  title,
  description,
  keywords: ['páginas web para negocios', 'diseño web Colombia', 'página web para restaurante', 'página web para tienda', 'crear página web negocio'],
  openGraph: { title, description, siteName: '3R', locale: 'es_CO', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
