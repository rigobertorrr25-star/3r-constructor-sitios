import { createHash } from 'node:crypto';

/** Robots, vistas previas de enlaces (WhatsApp, Facebook…) y herramientas: no son visitas. */
const BOT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|curl|wget|python|axios|node-fetch|go-http|java\/|headless|lighthouse|pingdom|uptime/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);

export const deviceOf = (ua: string): 'mobile' | 'tablet' | 'desktop' =>
  /ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)
    ? 'tablet'
    : /mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)
      ? 'mobile'
      : 'desktop';

const KNOWN: [RegExp, string][] = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org)$/, 'otros buscadores'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
];
const UTM: Record<string, string> = {
  ig: 'instagram',
  instagram: 'instagram',
  fb: 'facebook',
  facebook: 'facebook',
  wa: 'whatsapp',
  whatsapp: 'whatsapp',
  google: 'google',
  tiktok: 'tiktok',
};

/**
 * De dónde llegó: `?utm_source=` manda (así se marcan los enlaces de Instagram o WhatsApp, que muchas veces no
 * dicen de dónde vienen); si no, el sitio anterior. `null` = navegación dentro de la misma página (no es una llegada).
 */
export function sourceOf(referer: string, query: string, ownHost: string): string | null {
  const utm = new URLSearchParams(query.replace(/^\?/, '')).get('utm_source')?.trim().toLowerCase();
  if (utm) return (UTM[utm] ?? utm.replace(/[^a-z0-9 ._-]/g, '')).slice(0, 60) || 'direct';
  let host = '';
  try {
    host = referer ? new URL(referer).hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  if (!host) return 'direct';
  if (
    ownHost &&
    host ===
      ownHost
        .toLowerCase()
        .replace(/^www\./, '')
        .split(':')[0]
  )
    return null;
  for (const [re, name] of KNOWN) if (re.test(host)) return name;
  return host.slice(0, 60);
}

/** Código del visitante para contar personas distintas en un día. Cambia cada día y no se puede volver a la IP. */
export const visitorOf = (day: string, ip: string, ua: string, salt: string) =>
  createHash('sha256').update(`${salt}|${day}|${ip}|${ua}`).digest('hex').slice(0, 16);
