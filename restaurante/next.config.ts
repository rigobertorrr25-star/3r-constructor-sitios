import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No generar AGENTS.md / CLAUDE.md propios: las reglas del proyecto están en la raíz del repositorio.
  agentRules: false,
  // La foto de fondo del restaurante se achica en el teléfono, pero se deja margen por si llega más pesada.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  // Herramienta interna de cada negocio: que ningún buscador la indexe.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default nextConfig;
