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

export const MATCH_MAX_PHOTOS = 20;

/**
 * Reconoce qué producto de la carta es cada foto (Carta → «Subir fotos de los platos»). Recibe fotos pequeñas y la lista de
 * productos; devuelve, en el mismo orden, el id del producto o null si la IA no está segura. La persona lo revisa antes de guardar.
 */
export async function matchPhotosWithAi(actor: Actor, photos: ReadFile[], products: { id: string; name: string }[]): Promise<(string | null)[]> {
  requirePermission(actor, 'menu.edit');
  if (!photos.length) throw new AppError('INVALID', 'Escoge las fotos de los platos.');
  if (photos.length > MATCH_MAX_PHOTOS) throw new AppError('INVALID', `Sube hasta ${MATCH_MAX_PHOTOS} archivos a la vez.`);
  for (const f of photos) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw new AppError('INVALID', 'Solo fotos JPG, PNG o WebP.');
  }
  if (photos.reduce((n, f) => n + f.size, 0) > READ_MAX_BYTES) throw new AppError('INVALID', 'Los archivos pesan más de 4 MB. Sube el PDF por partes o fotos más livianas.');
  if (!products.length) throw new AppError('INVALID', 'Primero carga la carta: no hay productos para reconocer.');
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError('INVALID', 'La lectura de archivos con IA no está activada en este sistema. Escoge el plato de cada foto a mano.');
  const list = products.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  photos.forEach((f, i) => {
    content.push({ type: 'text', text: `Foto ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: f.type as Exclude<ReadType, 'application/pdf'>, data: f.data.toString('base64') } });
  });
  content.push({
    type: 'text',
    text: `Estos son los productos de la carta de un restaurante o bar de Colombia:
${list}

Para cada foto, di qué producto de la lista es. Usa el nombre del producto, lo que se ve en el plato o la bebida, y lo que
diga la foto (si trae texto). Si no estás seguro o no está en la lista, usa 0. No repitas un producto en dos fotos salvo que
sea claramente el mismo. Responde solo con JSON, sin texto alrededor: [{"foto": 1, "producto": 3}, ...] con todas las fotos.`,
  });
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    });
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return photoMatches(text, photos.length, products);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Anthropic.AuthenticationError) console.error('ANTHROPIC_API_KEY no es válida');
    else console.error('Reconocer fotos con IA falló:', error instanceof Error ? error.message : error);
    throw new AppError('INVALID', 'No pudimos leer el archivo en este momento. Intenta de nuevo en un minuto o pega el texto a mano.');
  }
}

/** Lee la respuesta de la IA ([{foto, producto}]) y la pasa a ids; lo que no se entienda queda sin producto. */
export function photoMatches(text: string, count: number, products: { id: string }[]): (string | null)[] {
  const result: (string | null)[] = Array.from({ length: count }, () => null);
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  if (!json) return result;
  let rows: unknown;
  try {
    rows = JSON.parse(json);
  } catch {
    return result;
  }
  if (!Array.isArray(rows)) return result;
  for (const row of rows) {
    const foto = Number((row as { foto?: unknown })?.foto);
    const producto = Number((row as { producto?: unknown })?.producto);
    if (Number.isInteger(foto) && foto >= 1 && foto <= count && Number.isInteger(producto) && producto >= 1 && producto <= products.length) {
      result[foto - 1] = products[producto - 1].id;
    }
  }
  return result;
}

export type ReceiptLine = { name: string; quantity: number; unit: 'g' | 'ml' | 'und'; total: number | null };
export type ReceiptReading = { supplier: string; total: number | null; date: string | null; category: string; description: string; lines: ReceiptLine[]; bags: number };

const RECEIPT_CATEGORIES = ['suppliers', 'payroll', 'rent', 'utilities', 'maintenance', 'marketing', 'taxes', 'other'];

/**
 * Facturas → «Facturas de compra»: lee la foto de una factura o recibo de compra y redacta el gasto (proveedor, total,
 * fecha, tipo y una frase de qué se compró). La cajera lo revisa antes de guardarlo.
 */
export async function readReceiptWithAi(actor: Actor, file: ReadFile, inventoryNames: string[] = []): Promise<ReceiptReading> {
  requirePermission(actor, 'expenses.add');
  const [real] = checkReadFiles([file]);
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError('INVALID', 'La lectura de facturas con IA no está activada en este sistema. Llena el gasto a mano.');
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    real.type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: real.data.toString('base64') } }
      : { type: 'image', source: { type: 'base64', media_type: real.type as Exclude<ReadType, 'application/pdf'>, data: real.data.toString('base64') } },
    {
      type: 'text',
      text: `Es la foto de una factura o recibo de compra de un restaurante o bar de Colombia. Léela y responde solo con este JSON, sin texto alrededor:
{"proveedor": "nombre del negocio que vendió o null", "total": valor total pagado en pesos como número entero sin puntos o null, "fecha": "AAAA-MM-DD" o null, "tipo": uno de ${JSON.stringify(RECEIPT_CATEGORIES)}, "descripcion": "frase corta en español de Colombia que diga qué se compró", "productos": [{"nombre": "...", "cantidad": número, "unidad": "und" | "g" | "ml", "total": valor de esa línea en pesos como número entero o null}], "bolsas": valor en pesos de las bolsas o empaques que cobraron en la factura, como número entero, o 0}
Tipos: suppliers = insumos, comida, bebidas, licores, desechables o aseo para el negocio; payroll = pagos a personas por su trabajo; rent = arriendo; utilities = luz, agua, gas, internet, teléfono; maintenance = arreglos, repuestos, mantenimiento; marketing = publicidad; taxes = impuestos; other = lo demás.
La descripción: máximo 160 caracteres, sin el valor ni la fecha, nombrando lo principal que se compró, por ejemplo «Compra de 10 kg de limón, 5 kg de tomate y 2 bultos de hielo». Si es una factura de servicio público, di cuál y de qué mes.
Productos: una entrada por cada cosa comprada que el negocio guarda en su inventario (comida, bebidas, licores, desechables, aseo). No pongas servicios, domicilio, propina ni impuestos sueltos. Las bolsas (bolsa plástica, bolsa de papel, impuesto a la bolsa) no van en productos: suma su valor en "bolsas". La cantidad va en gramos (g), mililitros (ml) o unidades (und): 2 kg = 2000 g, 1,5 l = 1500 ml, una caja de 24 cervezas = 24 und, 3 botellas de aguardiente = 3 und, 2 bultos de hielo = 2 und. El nombre, corto y claro como lo llamaría el restaurante, sin códigos ni presentaciones raras (por ejemplo «Club Colombia», «Limón», «Aguardiente Antioqueño»).${
        inventoryNames.length
          ? ` Estos son los insumos que el negocio ya tiene; si un producto es uno de ellos, usa ese nombre exacto: ${JSON.stringify(inventoryNames.slice(0, 400))}.`
          : ''
      } Si la factura no trae productos de inventario (por ejemplo un servicio público), pon "productos": [].
No inventes: si no se lee el total, pon null. Si la foto no es una factura o recibo, pon "descripcion": "" y todo lo demás null.`,
    },
  ];
  const client = new Anthropic();
  let text: string;
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    });
    text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error('ANTHROPIC_API_KEY no es válida');
    else console.error('Leer factura con IA falló:', error instanceof Error ? error.message : error);
    throw new AppError('INVALID', 'No pudimos leer la factura en este momento. Intenta de nuevo en un minuto o llena el gasto a mano.');
  }
  const reading = receiptReading(text);
  if (!reading) throw new AppError('INVALID', 'No pudimos leer la factura. Toma la foto de cerca, derecha y con buena luz, o llena el gasto a mano.');
  return reading;
}

/** Pasa la respuesta de la IA a un gasto; lo que no venga bien se deja vacío para que la cajera lo llene. Null si no es una factura. */
export function receiptReading(text: string): ReceiptReading | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const description = clean(raw.descripcion, 200);
  if (description.length < 3) return null;
  const total = typeof raw.total === 'number' ? raw.total : Number(String(raw.total ?? '').replace(/[^\d]/g, ''));
  const date = typeof raw.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.fecha) ? raw.fecha : null;
  const category = typeof raw.tipo === 'string' && RECEIPT_CATEGORIES.includes(raw.tipo) ? raw.tipo : 'other';
  const lines: ReceiptLine[] = [];
  const rawBags = typeof raw.bolsas === 'number' ? raw.bolsas : Number(String(raw.bolsas ?? '').replace(/[^\d]/g, ''));
  let bags = Number.isInteger(rawBags) && rawBags > 0 && rawBags <= 10_000_000 ? rawBags : 0;
  for (const p of Array.isArray(raw.productos) ? raw.productos.slice(0, 60) : []) {
    const r = (p ?? {}) as Record<string, unknown>;
    const name = clean(r.nombre, 80);
    const quantity = typeof r.cantidad === 'number' ? r.cantidad : Number(String(r.cantidad ?? '').replace(',', '.'));
    const unit = r.unidad === 'g' || r.unidad === 'ml' || r.unidad === 'und' ? r.unidad : null;
    const lineTotal = typeof r.total === 'number' ? r.total : Number(String(r.total ?? '').replace(/[^\d]/g, ''));
    const validTotal = Number.isInteger(lineTotal) && lineTotal > 0 && lineTotal <= 10_000_000_000;
    // Si la IA dejó las bolsas como producto, se pasan a «bolsas» (son un gasto, no inventario).
    if (isBagLine(name)) {
      if (validTotal) bags += lineTotal;
      continue;
    }
    if (name.length < 2 || !unit || !(quantity > 0 && quantity <= 10_000_000)) continue;
    lines.push({ name, quantity: Math.round(quantity * 1000) / 1000, unit, total: Number.isInteger(lineTotal) && lineTotal > 0 && lineTotal <= 10_000_000_000 ? lineTotal : null });
  }
  return {
    supplier: clean(raw.proveedor === null ? '' : raw.proveedor, 120),
    total: Number.isInteger(total) && total > 0 && total <= 10_000_000_000 ? total : null,
    date,
    category,
    description,
    lines,
    bags,
  };
}

/** «Bolsa», «Bolsas plásticas», «Impuesto a la bolsa», «Impoconsumo bolsa»… pero no «Bolsa de hielo» ni «Leche en bolsa». */
export function isBagLine(name: string) {
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    /^(bolsas?|empaques?)( (plasticas?|de plastico|de papel|biodegradables?|kraft|ecologicas?|grandes?|medianas?|pequenas?|para llevar))*$/.test(n) ||
    /\b(impuesto|impoconsumo|ibua)\b.*\bbolsas?\b/.test(n)
  );
}

/** Un insumo como se cuenta en la tabla de existencias: «botellas», «und», «kg» o «L». */
export type StockListItem = { id: string; name: string; countUnit: 'botellas' | 'und' | 'kg' | 'L' };
export type StockReading = {
  /** Insumos que ya existen: cuántos hay, en la unidad en que se cuentan. */
  found: { itemId: string; count: number }[];
  /** Lo que se ve en la foto y no está en el inventario: se ofrece crearlo. */
  others: { name: string; count: number; unit: 'und' | 'kg' | 'L' }[];
};

/**
 * Inventario → «Llenar con una foto»: lee la foto de la bodega, la nevera, la barra o de la hoja donde anotaron el conteo y
 * dice cuántos hay de cada insumo. Solo llena la tabla de «Cargar existencias»: la persona revisa y guarda.
 */
export async function readStockWithAi(actor: Actor, files: ReadFile[], items: StockListItem[]): Promise<StockReading> {
  requirePermission(actor, 'inventory.load');
  const real = checkReadFiles(files);
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError('INVALID', 'La lectura de fotos con IA no está activada en este sistema. Escribe las cantidades a mano.');
  const list = items
    .slice(0, 500)
    .map((i, n) => `${n + 1}. ${i.name} (se cuenta en ${i.countUnit})`)
    .join('\n');
  const content: Anthropic.Beta.BetaContentBlockParam[] = real.map((f) =>
    f.type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data.toString('base64') } }
      : { type: 'image', source: { type: 'base64', media_type: f.type as Exclude<ReadType, 'application/pdf'>, data: f.data.toString('base64') } },
  );
  content.push({
    type: 'text',
    text: `Son fotos del inventario de un restaurante o bar de Colombia: puede ser la bodega, la nevera, la barra o una hoja donde anotaron el conteo a mano. Di cuántos hay de cada cosa.
${items.length ? `Estos son los insumos que el negocio ya tiene:\n${list}\n` : 'El negocio todavía no tiene insumos.\n'}
Responde solo con este JSON, sin texto alrededor:
{"hay": [{"insumo": número del insumo en la lista, "cantidad": número}], "otros": [{"nombre": "...", "cantidad": número, "unidad": "und" | "kg" | "L"}]}
- "hay": los insumos de la lista que se ven o están anotados, con la cantidad en la unidad en que se cuenta ese insumo. En botellas, una botella a medias es 0.5 (redondea a cuartos: 0.25, 0.5, 0.75). Si es una hoja, copia el número anotado.
- "otros": lo que se ve o está anotado y no está en la lista. El nombre corto y claro como lo llamaría el restaurante (por ejemplo «Club Colombia», «Aguardiente Antioqueño», «Limón»), en unidades (und) salvo que la hoja lo diga en kg o L.
- Cuenta con cuidado lo que se ve; si una caja cerrada dice cuántas trae, úsalo. No inventes: lo que no se alcance a ver o leer, déjalo por fuera.
- Un mismo insumo una sola vez (si sale en varias fotos, suma solo si son lugares distintos).`,
  });
  const client = new Anthropic();
  let text: string;
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // Contar botellas en una foto pide más cuidado que copiar texto.
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    });
    text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error('ANTHROPIC_API_KEY no es válida');
    else console.error('Leer inventario con IA falló:', error instanceof Error ? error.message : error);
    throw new AppError('INVALID', 'No pudimos leer la foto en este momento. Intenta de nuevo en un minuto o escribe las cantidades a mano.');
  }
  const reading = stockReading(text, items);
  if (!reading.found.length && !reading.others.length) {
    throw new AppError('INVALID', 'No vimos insumos en la foto. Tómala de frente, con buena luz y que se vean las etiquetas, o escribe las cantidades a mano.');
  }
  return reading;
}

/** Pasa la respuesta de la IA a cantidades por insumo; lo que no se entienda se deja por fuera. */
export function stockReading(text: string, items: { id: string; name: string }[]): StockReading {
  const out: StockReading = { found: [], others: [] };
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return out;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return out;
  }
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')));
  const ok = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1_000_000;
  const seen = new Set<string>();
  for (const r of Array.isArray(raw.hay) ? raw.hay.slice(0, 500) : []) {
    const row = (r ?? {}) as Record<string, unknown>;
    const index = num(row.insumo);
    const count = num(row.cantidad);
    if (!Number.isInteger(index) || index < 1 || index > items.length || !ok(count)) continue;
    const id = items[index - 1].id;
    if (seen.has(id)) continue;
    seen.add(id);
    out.found.push({ itemId: id, count: Math.round(count * 100) / 100 });
  }
  const names = new Set(items.map((i) => i.name.toLocaleLowerCase('es')));
  for (const r of Array.isArray(raw.otros) ? raw.otros.slice(0, 60) : []) {
    const row = (r ?? {}) as Record<string, unknown>;
    const name = typeof row.nombre === 'string' ? row.nombre.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    const count = num(row.cantidad);
    const unit = row.unidad === 'kg' || row.unidad === 'L' ? row.unidad : 'und';
    const key = name.toLocaleLowerCase('es');
    if (name.length < 2 || !ok(count) || names.has(key)) continue;
    names.add(key);
    out.others.push({ name, count: Math.round(count * 100) / 100, unit });
  }
  return out;
}
