import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/editor', '/api', '/s/'] }],
    sitemap: 'https://3rpaginas.com/sitemap.xml',
  };
}
