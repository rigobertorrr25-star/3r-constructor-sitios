import type { Metadata } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';

export const metadata: Metadata = {
  title: '3R — Constructor de sitios web',
  description: 'Crea, edita y publica tu sitio web sin escribir código.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
