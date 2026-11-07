import type { MetadataRoute } from 'next';

// Herramienta interna de cada negocio: ningún buscador la recorre (8 nov 2026; además va X-Robots-Tag: noindex).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
