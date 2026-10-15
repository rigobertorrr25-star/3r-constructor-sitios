// Convierte un documento del editor en una página HTML estática, con CSS en línea y responsive.
// El diseño debe verse igual que en el lienzo del editor (apps/web/components/editor/canvas.tsx).
import { color, escapeHtml, isExternal, num, resolve, safeImageUrl, safeUrl, type Breakpoint } from './values.js';

type Bag = Record<string, unknown>;
type Decl = Record<string, string>;

export interface RenderPage {
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  doc: unknown;
}

export interface NavLink {
  label: string;
  href: string;
  current: boolean;
}

export interface RenderContext {
  siteName: string;
  nav: NavLink[];
  isHomepage: boolean;
  /** A dónde postea el formulario de contacto (ver PublicSitesController#contact). */
  formAction: string;
}

const px = (value: number | undefined) => (value === undefined ? undefined : `${value}px`);
const put = (decl: Decl, prop: string, value: string | undefined) => {
  if (value !== undefined) decl[prop] = value;
};

/** Estilos comunes (los que toCss() del editor entiende) para un tamaño de pantalla. */
function common(styles: Bag | undefined, bp: Breakpoint): Decl {
  const s = styles ?? {};
  const decl: Decl = {};
  const paddingX = px(num(resolve(s.paddingX as never, bp), 0, 600));
  put(decl, 'font-size', px(num(resolve(s.fontSize as never, bp), 6, 300)));
  put(decl, 'font-weight', s.fontWeight === undefined ? undefined : String(num(s.fontWeight, 100, 900) ?? ''));
  if (decl['font-weight'] === '') delete decl['font-weight'];
  put(decl, 'text-align', ['left', 'center', 'right'].includes(s.textAlign as string) ? (s.textAlign as string) : undefined);
  put(decl, 'color', color(s.color));
  put(decl, 'background', color(s.background));
  put(decl, 'padding-top', px(num(resolve(s.paddingTop as never, bp), 0, 600)));
  put(decl, 'padding-bottom', px(num(resolve(s.paddingBottom as never, bp), 0, 600)));
  put(decl, 'padding-left', paddingX);
  put(decl, 'padding-right', paddingX);
  put(decl, 'margin-top', px(num(resolve(s.marginTop as never, bp), 0, 600)));
  put(decl, 'margin-bottom', px(num(resolve(s.marginBottom as never, bp), 0, 600)));
  put(decl, 'border-radius', px(num(s.borderRadius, 0, 999)));
  return decl;
}

const ORDER = ['tablet', 'mobile'] as const;
const QUERY: Record<(typeof ORDER)[number], string> = { tablet: '(max-width:1024px)', mobile: '(max-width:640px)' };

const toText = (decl: Decl) =>
  Object.entries(decl)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(';');

/** Reglas por clase: escritorio como base y, por tamaño, solo lo que cambia (con el mismo CSS que el editor). */
class Sheet {
  private base: string[] = [];
  private media: Record<(typeof ORDER)[number], string[]> = { tablet: [], mobile: [] };
  private counter = 0;

  next(prefix: string) {
    return `${prefix}${++this.counter}`;
  }

  rule(selector: string, build: (bp: Breakpoint) => Decl) {
    const desktop = build('desktop');
    const tablet = build('tablet');
    const mobile = build('mobile');
    if (Object.keys(desktop).length) this.base.push(`${selector}{${toText(desktop)}}`);
    const diff = (now: Decl, before: Decl): Decl => {
      const out: Decl = {};
      for (const [prop, value] of Object.entries(now)) if (before[prop] !== value) out[prop] = value;
      return out;
    };
    const tabletDiff = diff(tablet, desktop);
    const mobileDiff = diff(mobile, tablet);
    if (Object.keys(tabletDiff).length) this.media.tablet.push(`${selector}{${toText(tabletDiff)}}`);
    if (Object.keys(mobileDiff).length) this.media.mobile.push(`${selector}{${toText(mobileDiff)}}`);
  }

  toString() {
    return [
      ...this.base,
      ...ORDER.filter((bp) => this.media[bp].length).map((bp) => `@media ${QUERY[bp]}{${this.media[bp].join('')}}`),
    ].join('\n');
  }
}

const STATIC_CSS = `*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fff;color:#111827;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.5}
img{display:inline-block;max-width:100%;height:auto}
video{display:inline-block;max-width:100%}
.in{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.box{display:flex;flex-direction:column}
.h{margin:0;line-height:1.15;overflow-wrap:anywhere;white-space:pre-wrap}
.t{margin:0;line-height:1.6;overflow-wrap:anywhere;white-space:pre-wrap}
.btn{display:inline-block;padding:12px 24px;text-decoration:none}
.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-bottom:1px solid #e5e7eb;background:#fff}
.top a{color:inherit;text-decoration:none}
.brand{font-weight:700;font-size:18px}
.top nav{display:flex;flex-wrap:wrap;gap:4px 20px}
.top nav a{font-size:15px;color:#4b5563;padding:4px 0}
.top nav a[aria-current=page]{color:#111827;font-weight:600;border-bottom:2px solid #111827}
.form-box{gap:16px}
.form-h{margin:0;font-size:18px;font-weight:700}
.form{display:flex;flex-direction:column;gap:12px}
.field{display:flex;flex-direction:column;gap:4px;font-size:14px;color:#374151}
.field input,.field textarea{font:inherit;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111827}
.field input:focus,.field textarea:focus{outline:2px solid #5b6cff;outline-offset:1px}
.field textarea{resize:vertical}
.form-submit{align-self:flex-start;padding:12px 24px;border:0;border-radius:999px;background:#5b6cff;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
.consent{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.45;color:#4b5563}
.consent input{margin-top:3px;flex-shrink:0}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}`;

class Renderer {
  readonly sheet = new Sheet();
  private seenHeading = false;

  constructor(
    private readonly formAction: string,
    private readonly siteName: string,
  ) {}

  section(raw: unknown): string {
    const node = (raw ?? {}) as Bag;
    const cls = this.sheet.next('s');
    this.sheet.rule(`.${cls}`, (bp) => common(node.styles as Bag, bp));
    return `<section class="${cls}"><div class="in">${this.children(node.components)}</div></section>`;
  }

  private children(list: unknown): string {
    return Array.isArray(list) ? list.map((child) => this.component(child)).join('') : '';
  }

  private component(raw: unknown): string {
    const node = (raw ?? {}) as Bag;
    const styles = node.styles as Bag | undefined;
    const props = (node.props ?? {}) as Bag;

    switch (node.type) {
      case 'heading': {
        const tag = this.seenHeading ? 'h2' : 'h1';
        this.seenHeading = true;
        const cls = this.sheet.next('c');
        this.sheet.rule(`.${cls}`, (bp) => common(styles, bp));
        return `<${tag} class="h ${cls}">${escapeHtml(node.content)}</${tag}>`;
      }
      case 'text': {
        const cls = this.sheet.next('c');
        this.sheet.rule(`.${cls}`, (bp) => common(styles, bp));
        return `<p class="t ${cls}">${escapeHtml(node.content)}</p>`;
      }
      case 'button': {
        const wrap = this.sheet.next('c');
        const link = this.sheet.next('c');
        this.sheet.rule(`.${wrap}`, (bp) => {
          const d = common(styles, bp);
          return pick(d, ['text-align', 'margin-top', 'margin-bottom']);
        });
        this.sheet.rule(`.${link}`, (bp) => {
          const d = common(styles, bp);
          const out = pick(d, ['font-size', 'font-weight', 'border-radius']);
          out['background'] = d['background'] ?? '#5b6cff';
          out['color'] = d['color'] ?? '#ffffff';
          out['font-size'] ??= '15px';
          out['font-weight'] ??= '600';
          out['border-radius'] ??= '999px';
          return out;
        });
        const href = safeUrl(props.href);
        const external = isExternal(href);
        const attrs = href
          ? ` href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}`
          : '';
        return `<div class="${wrap}"><a class="btn ${link}"${attrs}>${escapeHtml(node.content || 'Botón')}</a></div>`;
      }
      case 'image': {
        const src = safeImageUrl(props.src);
        if (!src) return '';
        const wrap = this.sheet.next('c');
        const img = this.sheet.next('c');
        this.sheet.rule(`.${wrap}`, (bp) => pick(common(styles, bp), ['text-align', 'margin-top', 'margin-bottom']));
        this.sheet.rule(`.${img}`, (bp) => {
          const out = pick(common(styles, bp), ['border-radius']);
          out['width'] = `${num(resolve(styles?.width as never, bp), 5, 100) ?? 100}%`;
          return out;
        });
        return `<div class="${wrap}"><img class="${img}" src="${escapeHtml(src)}" alt="${escapeHtml(props.alt)}" loading="lazy"></div>`;
      }
      case 'video': {
        const src = safeImageUrl(props.src);
        if (!src) return '';
        const poster = safeImageUrl(props.poster);
        const wrap = this.sheet.next('c');
        const vid = this.sheet.next('c');
        this.sheet.rule(`.${wrap}`, (bp) => pick(common(styles, bp), ['text-align', 'margin-top', 'margin-bottom']));
        this.sheet.rule(`.${vid}`, (bp) => {
          const out = pick(common(styles, bp), ['border-radius']);
          out['width'] = `${num(resolve(styles?.width as never, bp), 5, 100) ?? 100}%`;
          out['background'] = '#000';
          return out;
        });
        const posterAttr = poster ? ` poster="${escapeHtml(poster)}"` : '';
        return `<div class="${wrap}"><video class="${vid}" src="${escapeHtml(src)}"${posterAttr} controls></video></div>`;
      }
      case 'map': {
        const address = typeof props.address === 'string' ? props.address.trim() : '';
        if (!address || address.length > 300) return '';
        const wrap = this.sheet.next('c');
        const frame = this.sheet.next('c');
        this.sheet.rule(`.${wrap}`, (bp) => pick(common(styles, bp), ['margin-top', 'margin-bottom']));
        this.sheet.rule(`.${frame}`, (bp) => {
          const out = pick(common(styles, bp), ['border-radius']);
          out['height'] = `${num(resolve(styles?.height as never, bp), 120, 800) ?? 320}px`;
          out['width'] = '100%';
          out['border'] = '0';
          out['display'] = 'block';
          return out;
        });
        const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
        return `<div class="${wrap}"><iframe class="${frame}" title="Mapa" src="${escapeHtml(src)}" loading="lazy"></iframe></div>`;
      }
      case 'divider': {
        const cls = this.sheet.next('c');
        this.sheet.rule(`.${cls}`, (bp) => {
          const d = common(styles, bp);
          const out = pick(d, ['margin-top', 'margin-bottom']);
          out['height'] = `${num(resolve(styles?.height as never, bp), 1, 40) ?? 1}px`;
          out['background'] = color(styles?.color) ?? '#e5e7eb';
          return out;
        });
        return `<div role="separator" class="${cls}"></div>`;
      }
      case 'spacer': {
        const cls = this.sheet.next('c');
        this.sheet.rule(`.${cls}`, (bp) => ({ height: `${num(resolve(styles?.height as never, bp), 0, 600) ?? 32}px` }));
        return `<div aria-hidden="true" class="${cls}"></div>`;
      }
      case 'container': {
        const cls = this.sheet.next('c');
        this.sheet.rule(`.${cls}`, (bp) => {
          const out = common(styles, bp);
          const gap = num(styles?.gap, 0, 200);
          if (gap !== undefined) out['gap'] = `${gap}px`;
          // "display" se fija siempre (no solo cuando hay columnas) para que la regla de un tamaño
          // más chico sí pueda volver a "flex" — si no, al comparar contra el tamaño anterior no
          // habría diferencia que registrar y el grid se quedaría puesto en el resto de tamaños.
          const columns = num(resolve(styles?.columns as never, bp), 1, 4) ?? 1;
          out['display'] = columns > 1 ? 'grid' : 'flex';
          if (columns > 1) out['grid-template-columns'] = `repeat(${columns}, 1fr)`;
          return out;
        });
        return `<div class="box ${cls}">${this.children(node.components)}</div>`;
      }
      case 'form': {
        const wrap = this.sheet.next('c');
        this.sheet.rule(`.${wrap}`, (bp) => pick(common(styles, bp), ['margin-top', 'margin-bottom', 'background', 'border-radius', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right']));
        const title = typeof props.title === 'string' ? props.title.trim() : '';
        const heading = title ? `<h3 class="form-h">${escapeHtml(title)}</h3>` : '';
        return `<div class="${wrap} form-box">${heading}<form class="form" method="post" action="${escapeHtml(this.formAction)}">
<label class="field"><span>Nombre</span><input type="text" name="name" required maxlength="150"></label>
<label class="field"><span>Correo</span><input type="email" name="email" required maxlength="255"></label>
<label class="field"><span>Teléfono / WhatsApp (opcional)</span><input type="tel" name="phone" maxlength="50"></label>
<label class="field"><span>Mensaje</span><textarea name="message" required maxlength="4000" rows="4"></textarea></label>
<label class="consent"><input type="checkbox" name="consent" value="1" required><span>Autorizo a ${escapeHtml(this.siteName)} a usar estos datos solo para responder mi mensaje (Ley 1581 de 2012).</span></label>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="form-submit" type="submit">Enviar mensaje</button>
</form></div>`;
      }
      // galería aún no se puede publicar: se omite en vez de romper la página.
      default:
        return '';
    }
  }
}

const pick = (decl: Decl, keys: string[]): Decl => {
  const out: Decl = {};
  for (const key of keys) if (decl[key] !== undefined) out[key] = decl[key];
  return out;
};

function nav(context: RenderContext): string {
  if (context.nav.length < 2) return '';
  const links = context.nav
    .map((link) => `<a href="${escapeHtml(link.href)}"${link.current ? ' aria-current="page"' : ''}>${escapeHtml(link.label)}</a>`)
    .join('');
  return `<header class="top"><a class="brand" href="/">${escapeHtml(context.siteName)}</a><nav aria-label="Principal">${links}</nav></header>`;
}

/** Página HTML completa. Devuelve siempre un documento válido, aunque el contenido esté vacío o dañado. */
export function renderPage(page: RenderPage, context: RenderContext): string {
  const renderer = new Renderer(context.formAction, context.siteName);
  const doc = (page.doc ?? {}) as Bag;
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  const body = sections.map((section) => renderer.section(section)).join('');

  const title = page.seoTitle?.trim() || (context.isHomepage ? context.siteName : `${page.title} — ${context.siteName}`);
  const description = page.seoDescription?.trim();

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">\n` : ''}<style>
${STATIC_CSS}
${renderer.sheet.toString()}
</style>
</head>
<body>
${nav(context)}<main>${body}</main>
</body>
</html>
`;
}

export function renderNotFound(siteName: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página no encontrada</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#111827;text-align:center}a{color:#4b5563}</style></head>
<body><div><h1>Página no encontrada</h1><p><a href="/">Volver a ${escapeHtml(siteName)}</a></p></div></body></html>
`;
}

export function renderSitemap(baseUrl: string, paths: string[]): string {
  const urls = paths.map((path) => `<url><loc>${escapeHtml(baseUrl + path)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function renderRobots(baseUrl: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`;
}
