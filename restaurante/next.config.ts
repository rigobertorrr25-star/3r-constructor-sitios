import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // No generar AGENTS.md / CLAUDE.md propios: las reglas del proyecto están en la raíz del repositorio.
  agentRules: false,
  // La foto de fondo se achica en el teléfono; la carta o las recetas en PDF pueden llegar hasta 4 MB (Vercel recibe 4,5 MB).
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
  // Herramienta interna de cada negocio: que ningún buscador la indexe.
  async headers() {
    // Protecciones del navegador (8 nov 2026, pedido de Rigoberto): solo HTTPS, no adivinar tipos de archivo, no mandar la
    // dirección completa a otras páginas y no dejar que otra página la meta en un marco.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
