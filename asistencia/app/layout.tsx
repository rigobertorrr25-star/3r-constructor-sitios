import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './globals.css';

export const metadata: Metadata = {
  title: 'Asistencia 3R',
  description: 'Control de entrada y salida de empleados con código QR.',
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
