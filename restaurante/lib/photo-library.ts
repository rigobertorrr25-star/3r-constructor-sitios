// Biblioteca de fotos de 3R: fotos de bebidas comunes en Colombia (creadas con IA, en public/biblioteca) que se le ponen
// solas a los productos de la carta que no tienen foto, buscando por el nombre. Sirve para cualquier bar, no solo DELIRIUM.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { imageMime } from './backgrounds';
import { photoKey } from './photo-match';
export { photoKey };
import { query, transaction } from './db';
import { PRODUCT_PHOTO_MAX_BYTES } from './product-photos';
import { AppError, audit, requirePermission, type Actor } from './store';

/** [archivo, nombres con los que suele aparecer en una carta…] */
const LIBRARY: [string, ...string[]][] = [
  ['smirnoff-ice', 'Smirnoff', 'Smirnoff Ice'],
  ['stella-artois', 'Stella', 'Stella Artois'],
  ['corona', 'Corona', 'Corona Extra'],
  ['budweiser', 'Budweiser'],
  ['club-colombia', 'Club Colombia', 'Club Colombia Dorada'],
  ['aguila-light', 'Águila Light', 'Águila Ligth'],
  ['aguila-negra', 'Águila Negra'],
  ['coronita', 'Coronita', 'Corona Mini'],
  ['margarita', 'Margarita'],
  ['margarita-blue', 'Margarita Blue'],
  ['mojito', 'Mojito'],
  ['gin-tonic', 'Gin Tonic', 'Gin Tonik', 'Gin and Tonic'],
  ['caipiroska', 'Caipiroska'],
  ['frutos-rojos', 'Frutos Rojos'],
  ['vino-frontera', 'Vino Frontera'],
  ['chandon', 'Vino Chandon', 'Chandon', 'Chandon Brut'],
  ['baileys', 'Crema de Whisky Baileys', 'Baileys', 'Crema de Wisky Baileys'],
  ['jp-chenet-rose', 'Vino JP Chenet Rosé', 'Vino JP Chenet Rose'],
  ['jp-chenet-blanco', 'Vino JP Chenet Blanco'],
  ['jw-double-black', 'JW Double Black 750ml', 'Johnnie Walker Double Black'],
  ['jw-black-label', 'JW Black Label 700ml', 'Johnnie Walker Black Label'],
  ['jw-red-label', 'JW Red Label 700ml', 'Johnnie Walker Red Label'],
  ['buchanans-18', "Buchanan's 18 Años 750ml", 'Buchanans 18 Año'],
  ['buchanans-malta', "Buchanan's Malta 750ml"],
  ['buchanans-two-souls', "Buchanan's Two Souls"],
  ['buchanans-master', "Buchanan's Master 750ml"],
  ['buchanans-deluxe', "Buchanan's Deluxe", 'Buchanans Deluxe 365', 'Buchanans Deluxe Lt'],
  ['black-white', 'Black & White 700ml', 'Black and White'],
  ['chivas-18', 'Chivas Regal 18 Años 700ml'],
  ['chivas-12', 'Chivas Regal 12 Años 700ml'],
  ['chivas-13', 'Chivas Regal 13 Años 700ml'],
  ['old-parr', 'Old Parr', 'Old Parr'],
  ['macallan-12', 'Macallan 12 Años', 'Mecallan 12 Años', 'The Macallan 12'],
  ['glenfiddich-18', 'Glenfiddich 18 Años 750ml'],
  ['glenfiddich-15', 'Glenfiddich 15 Años 750ml'],
  ['glenfiddich-12', 'Glenfiddich 12 Años 750ml'],
  ['zacapa-12', 'Zacapa 12 Años 750ml'],
  ['zacapa-23', 'Zacapa 23 Años 750ml'],
  ['ron-medellin-19', 'Ron Medellín 19 Años 750ml'],
  ['ron-medellin-12', 'Ron Medellín 12 Años 750ml'],
  ['ron-medellin-8', 'Ron Medellín 8 Años 750ml'],
  ['ron-medellin-5', 'Ron Medellín 5 Años 750ml'],
  ['ron-medellin-3', 'Ron Medellín 3 Años'],
  ['bacardi-limon', 'Ron Bacardí Limón 750ml'],
  ['bacardi-mandarina', 'Ron Bacardí Mandarina 750ml'],
  ['bacardi-anejo', 'Ron Bacardí Añejo 750ml'],
  ['bacardi-carta-blanca', 'Ron Bacardí Carta Blanca'],
  ['ron-viejo-de-caldas', 'Ron Viejo de Caldas 750ml'],
  ['aguardiente-amarillo', 'Aguardiente Amarillo 750ml'],
  ['aguardiente-antioqueno', 'Aguardiente Antioqueño', 'Antioqueño'],
  ['don-julio-70', 'Don Julio 70'],
  ['don-julio-anejo', 'Don Julio Añejo'],
  ['don-julio-blanco', 'Don Julio Blanco'],
  ['don-julio-reposado', 'Don Julio Reposado'],
  ['tequila-1800-anejo', 'Tequila 1800 Añejo'],
  ['tequila-1800-reposado', 'Tequila 1800 Reposado'],
  ['tequila-1800-blanco', 'Tequila 1800 Blanco', 'Tequila 1800 Blanca'],
  ['patron-anejo', 'Tequila Patrón Añejo'],
  ['patron-reposado', 'Tequila Patrón Reposado'],
  ['patron-silver', 'Tequila Patrón Silver'],
  ['jose-cuervo-especial', 'José Cuervo Especial'],
  ['jose-cuervo-tradicional', 'José Cuervo Tradicional'],
  ['absolut', 'Absolut Vodka'],
  ['smirnoff-rojo', 'Smirnoff Rojo'],
  ['smirnoff-lulo', 'Smirnoff Lulo'],
  ['hendricks', "Hendrick's", 'Hendricks'],
  ['gordons', "Ginebra Gordon's", 'Ginebra Gordons', 'Gordons'],
  ['gatorade', 'Gatorade'],
  ['red-bull', 'Red Bull'],
  ['electrolit', 'Electrolit'],
  ['gaseosa', 'Gaseosa', 'Coca Cola', 'Coca-Cola'],
  ['ginger', 'Ginger', 'Ginger Ale'],
  ['soda', 'Soda', 'Agua con Gas'],
  ['agua', 'Agua', 'Agua Mineral', 'Botella de Agua'],
  ['rosquitas', 'Rosquitas'],
  ['vaso-michelado', 'Vaso Michelado'],
];

const BY_KEY = new Map<string, string>(LIBRARY.flatMap(([file, ...names]) => names.map((n) => [photoKey(n), file] as const)));
const KEYS_LONGEST_FIRST = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);

/** La foto de la biblioteca para un producto, o null. Primero el nombre exacto; si no, el nombre más largo que aparezca completo. */
export function libraryPhotoFor(productName: string): string | null {
  const key = photoKey(productName);
  if (!key) return null;
  const exact = BY_KEY.get(key);
  if (exact) return exact;
  const padded = ` ${key} `;
  const hit = KEYS_LONGEST_FIRST.find((k) => k.length >= 4 && padded.includes(` ${k} `));
  return hit ? BY_KEY.get(hit)! : null;
}

export const LIBRARY_SIZE = LIBRARY.length;

/**
 * Lee una foto de la biblioteca: del disco si está (pruebas y servidor propio) y, si no, de la misma página
 * (en Vercel los archivos de public/ se sirven por la web y no siempre están en el disco de la función).
 */
async function loadLibraryPhoto(file: string, origin?: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path.join(process.cwd(), 'public', 'biblioteca', `${file}.webp`));
  } catch {
    if (!origin) return null;
    try {
      const res = await fetch(`${origin}/biblioteca/${file}.webp`, { cache: 'no-store' });
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Carta → «Poner fotos de la biblioteca»: a cada producto sin foto le pone la de la biblioteca que le corresponde.
 * Las fotos que el negocio ya subió no se tocan. `origin` es la dirección de la página, por si hay que pedir las fotos por la web.
 */
export async function applyLibraryPhotos(actor: Actor, origin?: string) {
  requirePermission(actor, 'menu.edit');
  const products = await query<{ id: string; name: string }>(
    `SELECT p.id, p.name FROM menu_products p LEFT JOIN product_photos f ON f.product_id = p.id
      WHERE p.business_id = $1 AND p.is_active AND f.product_id IS NULL ORDER BY p.name`,
    [actor.businessId],
  );
  const missing: string[] = [];
  const wanted = new Map<string, string>();
  for (const product of products) {
    const file = libraryPhotoFor(product.name);
    if (file) wanted.set(product.id, file);
    else missing.push(product.name);
  }
  // Cada foto se lee una sola vez (varias botellas comparten foto), todas a la vez.
  const files = [...new Set(wanted.values())];
  const loaded = new Map(await Promise.all(files.map(async (f) => [f, await loadLibraryPhoto(f, origin)] as const)));
  if (files.length && files.every((f) => !loaded.get(f))) throw new AppError('INVALID', 'No pudimos leer las fotos de la biblioteca. Intenta otra vez en un momento.');
  return transaction(async (db) => {
    let placed = 0;
    for (const [productId, file] of wanted) {
      const bytes = loaded.get(file);
      const mime = bytes ? imageMime(bytes) : null;
      if (!bytes || !mime || bytes.length > PRODUCT_PHOTO_MAX_BYTES) continue;
      const res = await db.query(
        `INSERT INTO product_photos (product_id, business_id, mime, image) VALUES ($1, $2, $3, $4) ON CONFLICT (product_id) DO NOTHING`,
        [productId, actor.businessId, mime, Buffer.from(bytes)],
      );
      placed += res.rowCount ?? 0;
    }
    if (placed)
      await audit(db, actor, {
        action: 'menu.photo',
        entity: 'business',
        entityId: actor.businessId,
        summary: `Puso ${placed} fotos de la biblioteca de 3R en la carta`,
      });
    return { placed, missing };
  });
}
