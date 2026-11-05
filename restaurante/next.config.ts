import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No generar AGENTS.md / CLAUDE.md propios: las reglas del proyecto están en la raíz del repositorio.
  agentRules: false,
  // La foto de fondo se achica en el teléfono; la carta o las recetas en PDF pueden llegar hasta 4 MB (Vercel recibe 4,5 MB).
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
  // Herramienta interna de cada negocio: que ningún buscador la indexe.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default nextConfig;
