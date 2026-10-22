// Leer la carta o las recetas de un PDF o de fotos con Claude (Carta → Importar carta, Inventario → Importar recetas).
// La IA solo pasa lo que ve a texto en el formato de cada importador; el dueño lo revisa y lo corrige antes de cargarlo,
// así que nada entra a la base sin que una persona lo mire.
import Anthropic from '@anthropic-ai/sdk';
import { AppError, requirePermission, type Actor } from './store';

const MODEL = 'claude-sonnet-5-5';

export const READ_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type ReadType = (typeof READ_TYPES)[number];
// Vercel no recibe más de 4,5 MB por envío: se deja margen.
export const READ_MAX_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 8;

export type ReadFile = { type: string; size: number; data: Buffer };
export type ReadKind = 'menu' | 'recipes';

const PROMPTS: Record<ReadKind, string> = {
  menu: `Te paso la carta de un restaurante o bar de Colombia (PDF o fotos). Pásala a texto con este formato exacto:
- El nombre de cada categoría en su propia línea (por ejemplo «Cervezas», «Entradas»).
- Debajo, un producto por línea: el nombre y al final el precio en pesos, solo dígitos, sin puntos ni signo (por ejemplo «Club Colombia 8000»).
- Si un producto tiene varios tamaños o presentaciones con precio distinto, una línea por cada uno con la presentación entre paréntesis: «Aguardiente Antioqueño (Media) 45000».
- Copia los nombres como están en la carta (con tildes). No pongas descripciones ni ingredientes.
- No inventes nada: si un producto no tiene precio visible, no lo pongas. Si algo no se lee bien, déjalo por fuera.
- Precios en miles: si la carta dice «12» o «12K» y es claro que son miles de pesos, escribe 12000.
Responde solo con la carta en ese formato, sin títulos, sin viñetas, sin comentarios y sin markdown.`,
  recipes: `Te paso las recetas o fichas técnicas de un restaurante o bar de Colombia (PDF o fotos). Pásalas a texto con este formato exacto:
- El nombre del plato o bebida en su propia línea (tal como lo vende el negocio).
- Debajo, un ingrediente por línea: el nombre y al final la cantidad que lleva UNA porción con su unidad, que solo puede ser g, ml o und (por ejemplo «Ron blanco 60 ml», «Hierbabuena 8 g», «Limón 1 und»).
- Convierte: 1 oz = 30 ml, 1 kg = 1000 g, 1 l = 1000 ml, 1 cl = 10 ml, 1 cucharada = 15 ml, 1 cucharadita = 5 ml. Si la receta es para varias porciones, divide para una.
- Usa números con punto para decimales (0.5). No pongas pasos de preparación ni notas.
- No inventes: si un ingrediente no tiene cantidad («al gusto», «c/n»), déjalo por fuera.
Responde solo con las recetas en ese formato, sin títulos, sin viñetas, sin comentarios y sin markdown.`,
};

/** Revisa los archivos que llegan (tipo, cantidad y peso) antes de mandarlos a la IA. */
export function checkReadFiles(files: ReadFile[]) {
  const real = files.filter((f) => f.size > 0);
  if (!real.length) throw new AppError('INVALID', 'Escoge el PDF o las fotos de la carta.');
  if (real.length > MAX_FILES) throw new AppError('INVALID', `Sube hasta ${MAX_FILES} archivos a la vez.`);
  for (const f of real) {
    if (!(READ_TYPES as readonly string[]).includes(f.type)) throw new AppError('INVALID', 'Solo se leen archivos PDF o fotos (JPG, PNG o WEBP).');
  }
  if (real.reduce((n, f) => n + f.size, 0) > READ_MAX_BYTES) {
    throw new AppError('INVALID', 'Los archivos pesan más de 4 MB. Sube el PDF por partes o fotos más livianas.');
  }
  return real;
}

/** Manda los archivos a Claude y devuelve el texto en el formato del importador (la persona lo revisa antes de cargarlo). */
export async function readWithAi(actor: Actor, kind: ReadKind, files: ReadFile[]): Promise<string> {
  requirePermission(actor, kind === 'menu' ? 'menu.edit' : 'inventory.manage');
  const real = checkReadFiles(files);
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError('INVALID', 'La lectura de archivos con IA no está activada en este sistema. Pega el texto a mano.');
  const content: Anthropic.Beta.BetaContentBlockParam[] = real.map((f) =>
    f.type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data.toString('base64') } }
      : { type: 'image', source: { type: 'base64', media_type: f.type as Exclude<ReadType, 'application/pdf'>, data: f.data.toString('base64') } },
  );
  content.push({ type: 'text', text: PROMPTS[kind] });
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Es copiar lo que se ve: esfuerzo bajo alcanza y responde más rápido.
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    });
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .replace(/^```[a-z]*\n?|```$/gm, '')
      .trim();
    if (response.stop_reason === 'refusal' || !text) throw new AppError('INVALID', 'No pudimos leer el archivo. Prueba con una foto más clara o pega el texto a mano.');
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Anthropic.AuthenticationError) console.error('ANTHROPIC_API_KEY no es válida');
    else console.error('Lectura con IA falló:', error instanceof Error ? error.message : error);
    throw new AppError('INVALID', 'No pudimos leer el archivo en este momento. Intenta de nuevo en un minuto o pega el texto a mano.');
  }
}
