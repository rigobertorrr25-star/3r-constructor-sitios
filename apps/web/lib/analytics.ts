// Analítica web: tipos y textos visibles.

export type AnalyticsReport = {
  days: number;
  from: string;
  to: string;
  web: null | {
    siteName: string | null;
    views: number;
    visitors: number;
    previous: { views: number; visitors: number };
    contacts: number;
    daily: { day: string; views: number; visitors: number }[];
    pages: { path: string; views: number }[];
    sources: { source: string; visitors: number }[];
    devices: Partial<Record<'mobile' | 'tablet' | 'desktop', number>>;
  };
  store: null | { orders: number; sales: number; previous: { orders: number; sales: number } };
};

const SOURCE: Record<string, string> = {
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  'otros buscadores': 'Otros buscadores',
  direct: 'Directo',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};
export const sourceLabel = (s: string) => SOURCE[s] ?? s;
export const DEVICE_LABEL = { mobile: 'Celular', tablet: 'Tableta', desktop: 'Computador' } as const;

/** Cambio frente al periodo anterior: "+25 %", "−10 %" o null si antes no había nada. */
export const change = (now: number, before: number) => {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return { pct, text: `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)} %` };
};
