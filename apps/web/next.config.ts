import type { NextConfig } from 'next';

// Protecciones del navegador en todas las páginas (8 nov 2026, pedido de Rigoberto): solo HTTPS por dos años (HSTS),
// no adivinar tipos de archivo, no mandar la dirección completa a otras páginas y no dejar que otra página meta esta
// dentro de un marco (evita engaños con clics).
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
