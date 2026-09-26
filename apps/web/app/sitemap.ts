import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://3rpaginas.com';
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/registro`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacidad`, lastModified: new Date('2026-09-26'), changeFrequency: 'yearly', priority: 0.2 },
  ];
}
