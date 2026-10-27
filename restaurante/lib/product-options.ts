// Opciones para armar un plato (p. ej. PROMO ALMUERZO): grupos con sus opciones, y cuántas se escogen de cada uno.
// Se escriben en la carta, una línea por grupo: «Arroz: Arroz de coco, Arroz de frijol». Si el grupo lleva «(elige 2)»
// se escogen dos. Una línea sin opciones («Sopa») es algo que el plato siempre trae.
// Sin imports del servidor: lo usa también la pantalla del mesero.

export type OptionGroup = { name: string; choose: number; options: string[] };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const same = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');
const capital = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);

/**
 * Separa las opciones como las escribe la gente: con coma, punto y coma, «/», «|» o la palabra «o»
 * («Limonada o panelada», «Papa francesa / Papas casco / Patacón»). En Azul se escribieron así y el mesero no veía
 * qué escoger, porque solo se separaba con coma.
 */
export const splitOptions = (text: string) =>
  String(text ?? '')
    .split(/\s*[,;/|]\s*|\s+[oó]\s+/i)
    .map(clean)
    .filter(Boolean)
    .map(capital);

/** Lo guardado antes de separar con «o» o «/» queda como una sola opción: se vuelve a separar al leer la carta. */
export function normalizeGroups(groups: OptionGroup[] | null | undefined): OptionGroup[] | null {
  if (!groups?.length) return null;
  return groups.map((g) => {
    if (g.options.length !== 1) return g;
    const parts = splitOptions(g.options[0]);
    return parts.length > 1 && parts.every((o, j) => parts.findIndex((x) => same(x, o)) === j) ? { ...g, options: parts } : g;
  });
}

/** Lee el texto de la carta. Devuelve los grupos o el error que hay que mostrar. */
export function parseOptionGroups(text: string): { groups: OptionGroup[]; error?: string } {
  const groups: OptionGroup[] = [];
  const lines = String(text ?? '').split(/\r?\n/).map(clean).filter(Boolean);
  if (lines.length > 10) return { groups: [], error: 'Opciones: hasta 10 grupos (una línea por grupo).' };
  for (const [i, line] of lines.entries()) {
    const n = i + 1;
    const colon = line.indexOf(':');
    let head = colon >= 0 ? clean(line.slice(0, colon)) : line;
    const rest = colon >= 0 ? line.slice(colon + 1) : '';
    let choose = 1;
    const pick = head.match(/\(\s*elige\s+(\d+)\s*\)/i);
    if (pick) {
      choose = Number(pick[1]);
      head = clean(head.replace(pick[0], ''));
    }
    if (head.length < 2 || head.length > 40) return { groups: [], error: `Opciones, línea ${n}: el nombre del grupo va de 2 a 40 letras.` };
    // Sin «:», la línea es algo que va siempre, salvo que traiga varias opciones («Sopa o crema»).
    const alone = colon >= 0 ? [] : splitOptions(head);
    const options = colon >= 0 ? splitOptions(rest) : alone.length > 1 ? alone : [head];
    if (!options.length) return { groups: [], error: `Opciones, línea ${n}: escribe las opciones después de «:», separadas por comas.` };
    if (options.length > 20) return { groups: [], error: `Opciones, línea ${n}: hasta 20 opciones por grupo.` };
    const bad = options.find((o) => o.length < 2 || o.length > 40);
    if (bad) return { groups: [], error: `Opciones, línea ${n}: «${bad.slice(0, 40)}» debe tener de 2 a 40 letras.` };
    if (options.some((o, j) => options.findIndex((x) => same(x, o)) !== j)) return { groups: [], error: `Opciones, línea ${n}: hay una opción repetida.` };
    if (choose < 1 || choose > options.length) return { groups: [], error: `Opciones, línea ${n}: no se pueden escoger ${choose} de ${options.length}.` };
    if (groups.some((g) => same(g.name, head))) return { groups: [], error: `Opciones: el grupo «${head}» está dos veces.` };
    groups.push({ name: head, choose, options });
  }
  return { groups };
}

/** El texto que se muestra para editar (lo contrario de parseOptionGroups). */
export function optionGroupsText(groups: OptionGroup[] | null | undefined) {
  return (groups ?? [])
    .map((g) => (isFixed(g) && same(g.options[0], g.name) ? g.name : `${g.name}${g.choose > 1 ? ` (elige ${g.choose})` : ''}: ${g.options.join(', ')}`))
    .join('\n');
}

/** Un grupo con una sola opción no se pregunta: va siempre. */
export const isFixed = (g: OptionGroup) => g.options.length === 1;

/** Lo que se escogió de cada grupo, completo con lo que va siempre. Null si falta o sobra algo. */
export function completeChoices(groups: OptionGroup[], choices: unknown): string[][] | null {
  const list = Array.isArray(choices) ? choices : [];
  const out: string[][] = [];
  for (const [i, g] of groups.entries()) {
    if (isFixed(g)) {
      out.push([g.options[0]]);
      continue;
    }
    const raw = Array.isArray(list[i]) ? (list[i] as unknown[]) : [];
    const picks = [...new Set(raw.map((x) => g.options.find((o) => typeof x === 'string' && same(o, clean(x)))).filter((x): x is string => Boolean(x)))];
    if (picks.length !== g.choose || picks.length !== raw.length) return null;
    out.push(picks);
  }
  return out;
}

/** Cómo sale en la comanda: «Sopa · Arroz: Arroz de coco · Proteína: Pechuga». */
export function describeChoices(groups: OptionGroup[], choices: string[][]) {
  return groups
    .map((g, i) => (isFixed(g) && same(g.options[0], g.name) ? g.name : `${g.name}: ${(choices[i] ?? []).join(', ')}`))
    .join(' · ');
}
