// Textos en español e inglés. El idioma lo escoge cada persona (botón ES | EN, se guarda en una cookie); si nunca
// lo escogió, se usa el de su navegador. El texto en español es la llave: t('Mesa {n}', { n: 3 }) busca
// «Mesa {n}» en el diccionario de inglés y, si no está, deja el español. Sirve en el servidor y en el navegador.
//
// Los textos que ya vienen armados del servidor (errores, auditoría) se traducen con tr(): primero se busca el
// texto exacto y luego un molde con {huecos} que le calce, por ejemplo «Cambió la foto de {name}».
import { EN } from './dictionary';

export type Lang = 'es' | 'en';
export const LANG_COOKIE = 'rc_lang';
export const isLang = (value: unknown): value is Lang => value === 'es' || value === 'en';

/** Idioma cuando la persona no ha escogido: inglés solo si el navegador lo pide primero. */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  const first = (header ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'es';
}

export type Vars = Record<string, string | number | null | undefined>;

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (all, key: string) => (vars[key] === undefined || vars[key] === null ? all : String(vars[key]))) : text);

/** Un texto escrito en el código, en el idioma pedido. */
export function translate(lang: Lang, es: string, vars?: Vars) {
  return fill(lang === 'en' ? (EN[es] ?? es) : es, vars);
}

type Mold = { re: RegExp; keys: string[]; en: string };
let molds: Mold[] | null = null;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function getMolds() {
  if (molds) return molds;
  molds = [];
  for (const [es, en] of Object.entries(EN)) {
    if (!/\{\w+\}/.test(es)) continue;
    // Un molde con casi todo hueco («{a} de {b}») calzaría con cualquier frase que escribe la gente: no sirve para tr().
    if (es.replace(/\{\w+\}/g, '').replace(/[\s\p{P}\p{S}\d]/gu, '').length < 5) continue;
    const keys: string[] = [];
    const pattern = es
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escape(part);
        keys.push(m[1]);
        return '(.+?)';
      })
      .join('');
    molds.push({ re: new RegExp(`^${pattern}$`, 's'), keys, en });
  }
  // Los moldes con más texto fijo primero: calzan de forma más precisa.
  molds.sort((a, b) => b.re.source.length - a.re.source.length);
  return molds;
}

/** Un texto que ya viene armado (por ejemplo un error del servidor o una línea de la auditoría). */
export function tr(lang: Lang, text: string) {
  if (lang !== 'en' || !text) return text;
  const exact = EN[text];
  if (exact !== undefined) return exact;
  for (const mold of getMolds()) {
    const m = mold.re.exec(text);
    if (!m) continue;
    const vars: Vars = {};
    mold.keys.forEach((key, i) => (vars[key] = EN[m[i + 1]] ?? m[i + 1]));
    return fill(mold.en, vars);
  }
  return text;
}

export type T = (es: string, vars?: Vars) => string;
export const makeT = (lang: Lang): T => (es, vars) => translate(lang, es, vars);
