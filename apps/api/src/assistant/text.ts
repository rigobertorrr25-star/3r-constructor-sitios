import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

/** Hasta este tamaño de texto por documento (un manual largo cabe de sobra). */
const MAX_TEXT = 400_000;
const CHUNK = 1500;

/** Minúsculas y sin tildes, para buscar. */
export const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** El texto de un PDF o un Word. Vacío si no tiene (p. ej. un escaneo). */
export async function readText(buffer: Buffer, contentType: string): Promise<string> {
  let text = '';
  if (contentType === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const out = await extractText(pdf, { mergePages: false });
    text = out.text.join('\n\n');
  } else {
    text = (await mammoth.extractRawText({ buffer })).value;
  }
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT);
}

/** Parte el texto en pedazos de ~1.500 letras, cortando en párrafos o frases. */
export function chunks(text: string): string[] {
  const out: string[] = [];
  let current = '';
  const push = () => {
    if (current.trim()) out.push(current.trim());
    current = '';
  };
  for (const para of text.split(/\n\s*\n/)) {
    if (para.length > CHUNK) {
      push();
      for (const sentence of para.split(/(?<=[.!?])\s+/)) {
        if (current.length + sentence.length > CHUNK) push();
        current += (current ? ' ' : '') + sentence.slice(0, CHUNK * 2);
      }
      push();
      continue;
    }
    if (current.length + para.length > CHUNK) push();
    current += (current ? '\n\n' : '') + para;
  }
  push();
  return out;
}

const STOP = new Set(
  'que como cual cuales cuando donde quien quienes para por con sin sobre entre desde hasta los las del una uno unos unas este esta estos estas ese esa eso esto hay tiene tengo tienen puedo puede pueden debo debe hacer hace mas muy pero porque cuanto cuantos cuanta cuantas son ser esta estan nos les mis tus sus mi tu su al lo le se si no ya the and'.split(
    ' ',
  ),
);

/** Palabras de la pregunta que sirven para buscar (sin tildes, sin palabras vacías, un poco recortadas). */
export function terms(question: string): string[] {
  const words = fold(question)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words.map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w)))].slice(0, 20);
}

const count = (haystack: string, needle: string) => {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1 && n < 5; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
};

/** Qué tanto tiene que ver un pedazo con la pregunta. */
export function score(words: string[], title: string, searchText: string) {
  const t = fold(title);
  let s = 0;
  let hits = 0;
  for (const w of words) {
    const n = count(searchText, w);
    const inTitle = t.includes(w);
    if (n || inTitle) hits++;
    s += n + (inTitle ? 3 : 0);
  }
  // Pesa más que salgan varias palabras distintas que una sola muchas veces.
  return hits ? s * hits : 0;
}
