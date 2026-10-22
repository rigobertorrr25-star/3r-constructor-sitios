// Importar las recetas de una sola vez (Inventario → Importar recetas): el nombre del producto de la carta en su
// propia línea y debajo sus insumos, cada uno con la cantidad de una porción al final («Ron blanco 60 ml»). Los insumos
// que no existen se crean (en cero, para cargar existencias después) y la receta de cada producto se reemplaza.
import { transaction } from './db';
import { AppError, audit, requirePermission, type Actor } from './store';
import type { Unit } from './inventory';

export type ParsedRecipes = { products: { name: string; lines: { name: string; quantity: number; unit: Unit }[] }[] };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// Cada unidad escrita a mano se pasa a la que maneja el inventario (g, ml o und) con su factor.
const UNIT_ALIASES: [RegExp, Unit, number][] = [
  [/^(g|gr|grs|gramos?)$/, 'g', 1],
  [/^(kg|kilos?|kilogramos?)$/, 'g', 1000],
  [/^(ml|mililitros?)$/, 'ml', 1],
  [/^(cl)$/, 'ml', 10],
  [/^(l|lt|lts|litros?)$/, 'ml', 1000],
  [/^(oz|onzas?)$/, 'ml', 30],
  [/^(und|unds|u|un|unidad(es)?)$/, 'und', 1],
];

/** Lee el texto: una línea que termina en cantidad y unidad es un insumo; una sin cantidad es el nombre del producto. */
export function parseRecipesText(text: string): ParsedRecipes {
  const products: ParsedRecipes['products'] = [];
  const lines = String(text ?? '').split(/\r?\n/);
  if (lines.length > 1500) throw new AppError('INVALID', 'Son muchas líneas: pega las recetas por partes (hasta 1.500 líneas).');
  lines.forEach((raw, i) => {
    const line = clean(raw.replace(/^[-•*]\s*/, ''));
    if (!line) return;
    const match = line.match(/^(.*?)[\s.·…_\-–—:|]*(\d+(?:[.,]\d+)?)\s*([a-záéíóúñ]+)\.?$/i);
    const alias = match ? UNIT_ALIASES.find(([re]) => re.test(match[3].toLowerCase())) : undefined;
    if (match && alias && clean(match[1]).length >= 2) {
      const [, unit, factor] = alias;
      const quantity = Number(match[2].replace(',', '.')) * factor;
      if (!(quantity > 0) || quantity > 1_000_000) throw new AppError('INVALID', `Línea ${i + 1}: esa cantidad no parece correcta.`);
      const name = clean(match[1].replace(/[\s.·…_\-–—:|]+$/, ''));
      if (name.length > 80) throw new AppError('INVALID', `Línea ${i + 1}: el nombre del insumo es muy largo (hasta 80 letras).`);
      const current = products.at(-1);
      if (!current) throw new AppError('INVALID', `Línea ${i + 1}: escribe primero el nombre del producto de la carta (por ejemplo «Mojito»).`);
      const same = current.lines.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (same && same.unit !== unit) throw new AppError('INVALID', `Línea ${i + 1}: «${name}» está dos veces en ${current.name} con unidades distintas.`);
      if (same) same.quantity += Math.round(quantity * 1000) / 1000;
      else current.lines.push({ name, quantity: Math.round(quantity * 1000) / 1000, unit });
      return;
    }
    const name = clean(line.replace(/^#+/, '').replace(/:$/, ''));
    if (name.length < 2 || name.length > 80) throw new AppError('INVALID', `Línea ${i + 1}: «${line.slice(0, 40)}» no tiene cantidad con unidad (g, ml o und) y no sirve como nombre de producto.`);
    products.push({ name, lines: [] });
  });
  const withLines = products.filter((p) => p.lines.length);
  if (!withLines.length) throw new AppError('INVALID', 'No encontramos recetas. Pon el nombre del producto y debajo cada insumo con su cantidad y unidad (60 ml, 8 g, 1 und).');
  return { products: withLines };
}

export type RecipeImport = { recipes: number; items: number; missing: string[]; conflicts: string[] };

/**
 * Guarda las recetas. El producto se busca en la carta por su nombre (si no está, se avisa y se salta); cada insumo se
 * busca por nombre y, si no existe, se crea. Un insumo que ya existe en otra unidad no se toca (se avisa).
 */
export async function importRecipes(actor: Actor, text: string): Promise<RecipeImport> {
  requirePermission(actor, 'inventory.manage');
  const parsed = parseRecipesText(text);
  return transaction(async (db) => {
    const result: RecipeImport = { recipes: 0, items: 0, missing: [], conflicts: [] };
    const items = new Map(
      (await db.query<{ id: string; name: string; unit: Unit }>(`SELECT id, name, unit FROM inventory_items WHERE business_id = $1`, [actor.businessId])).rows.map(
        (r) => [r.name.toLowerCase(), r],
      ),
    );
    for (const product of parsed.products) {
      const found = (
        await db.query<{ id: string; name: string }>(
          `SELECT id, name FROM menu_products WHERE business_id = $1 AND lower(name) = lower($2) ORDER BY is_active DESC`,
          [actor.businessId, product.name],
        )
      ).rows;
      if (!found.length) {
        result.missing.push(product.name);
        continue;
      }
      const lines: { itemId: string; quantity: number }[] = [];
      for (const line of product.lines) {
        let item = items.get(line.name.toLowerCase());
        if (item && item.unit !== line.unit) {
          result.conflicts.push(`${line.name} (${product.name})`);
          continue;
        }
        if (!item) {
          const id = (
            await db.query<{ id: string }>(`INSERT INTO inventory_items (business_id, name, unit, min_stock) VALUES ($1, $2, $3, 0) RETURNING id`, [
              actor.businessId,
              line.name,
              line.unit,
            ])
          ).rows[0].id;
          item = { id, name: line.name, unit: line.unit };
          items.set(line.name.toLowerCase(), item);
          result.items++;
        }
        lines.push({ itemId: item.id, quantity: line.quantity });
      }
      if (!lines.length) continue;
      // Si el mismo nombre está en dos categorías (por ejemplo en Cócteles y en Promociones), las dos llevan la receta.
      for (const p of found) {
        await db.query(`DELETE FROM recipe_lines WHERE product_id = $1`, [p.id]);
        for (const l of lines) await db.query(`INSERT INTO recipe_lines (product_id, item_id, quantity) VALUES ($1, $2, $3)`, [p.id, l.itemId, l.quantity]);
        result.recipes++;
      }
    }
    await audit(db, actor, {
      action: 'inventory.recipe_import',
      entity: 'business',
      entityId: actor.businessId,
      summary: `Importó recetas: ${result.recipes} productos con receta y ${result.items} insumos nuevos`,
    });
    return result;
  });
}
