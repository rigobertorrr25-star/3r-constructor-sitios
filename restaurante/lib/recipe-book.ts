// Recetario en PDF (9 nov 2026, pedido de Rigoberto: «descárgame todas las recetas de mis platos en un documento y ponle la
// imagen de cada plato»). Cada producto activo de la carta, por categoría: su foto, precio, estación y los insumos de una
// porción (con el costo si quien descarga ve costos). Las fotos WebP se pasan a JPG con sharp porque el PDF no las acepta.
// En español, como todo lo impreso.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { shortQuantity } from './closing-report';
import { query } from './db';
import { formatCop } from './format';
import type { Unit } from './inventory';
import { pdfSafe } from './day-report';
import { AppError, type Actor } from './store';
import { can } from './permissions';

type Line = { item: string; quantity: number; unit: Unit; bottleSize: number | null; unitCost: number };
type Dish = { id: string; name: string; description: string | null; category: string; station: string; price: number; photo: { mime: string; image: Buffer } | null; lines: Line[] };

export async function recipeBookData(actor: Actor): Promise<Dish[]> {
  if (!can(actor.role, 'menu.edit') && !can(actor.role, 'inventory.view')) throw new AppError('FORBIDDEN', 'Tu rol no puede ver las recetas.');
  const products = await query<{ id: string; name: string; description: string | null; category: string; station: string; price: string; mime: string | null; image: Buffer | null }>(
    `SELECT p.id, p.name, p.description, c.name AS category, p.station, p.price, f.mime, f.image
       FROM menu_products p JOIN menu_categories c ON c.id = p.category_id
       LEFT JOIN product_photos f ON f.product_id = p.id
      WHERE p.business_id = $1 AND p.is_active
      ORDER BY c.sort, c.name, p.sort, p.name`,
    [actor.businessId],
  );
  const lines = await query<{ productId: string; item: string; quantity: string; unit: Unit; bottleSize: string | null; unitCost: string }>(
    `SELECT r.product_id AS "productId", i.name AS item, r.quantity, i.unit, i.bottle_size AS "bottleSize", i.unit_cost AS "unitCost"
       FROM recipe_lines r JOIN inventory_items i ON i.id = r.item_id JOIN menu_products p ON p.id = r.product_id
      WHERE p.business_id = $1 ORDER BY i.name`,
    [actor.businessId],
  );
  const byProduct = new Map<string, Line[]>();
  for (const l of lines) {
    const list = byProduct.get(l.productId) ?? [];
    list.push({ item: l.item, quantity: Number(l.quantity), unit: l.unit, bottleSize: l.bottleSize === null ? null : Number(l.bottleSize), unitCost: Number(l.unitCost) });
    byProduct.set(l.productId, list);
  }
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    station: p.station,
    price: Number(p.price),
    photo: p.mime && p.image ? { mime: p.mime, image: p.image } : null,
    lines: byProduct.get(p.id) ?? [],
  }));
}

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.06, 0.2, 0.42);
const LINE = rgb(0.85, 0.87, 0.9);
const CARD = rgb(0.965, 0.97, 0.98);
const PHOTO = 120;

async function embedPhoto(doc: PDFDocument, photo: Dish['photo']): Promise<PDFImage | null> {
  if (!photo) return null;
  try {
    if (photo.mime === 'image/jpeg') return await doc.embedJpg(photo.image);
    if (photo.mime === 'image/png') return await doc.embedPng(photo.image);
    // WebP (y lo demás): a JPG cuadrado y liviano.
    const sharp = (await import('sharp')).default;
    const jpg = await sharp(photo.image).resize(480, 480, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer();
    return await doc.embedJpg(jpg);
  } catch {
    return null;
  }
}

export async function recipeBookPdf(dishes: Dish[], opts: { business: string; showCosts: boolean; date: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular: PDFFont = await doc.embedFont(StandardFonts.Helvetica);
  const bold: PDFFont = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const text = (s: string, x: number, yy: number, size: number, b = false, color = INK) => page.drawText(pdfSafe(s), { x, y: yy, size, font: b ? bold : regular, color });
  const width = (s: string, size: number, b = false) => (b ? bold : regular).widthOfTextAtSize(pdfSafe(s), size);
  const fit = (s: string, size: number, max: number, b = false) => {
    let t = pdfSafe(s);
    while (t.length > 1 && width(t, size, b) > max) t = t.slice(0, -2) + '.';
    return t;
  };

  // Portada corta arriba de la primera página.
  text('RECETARIO', M, y - 20, 24, true, ACCENT);
  text(opts.business, M, y - 42, 13, true);
  text(`${dishes.length} platos · ${opts.date} · cantidades de una porción`, M, y - 60, 9.5, false, MUTED);
  y -= 78;

  let category = '';
  for (const d of dishes) {
    const rows = Math.max(d.lines.length, 1);
    const listH = 16 + rows * 13 + (opts.showCosts && d.lines.length ? 16 : 0);
    const cardH = Math.max(PHOTO + 20, 44 + listH);
    const needCat = d.category !== category;
    if (y - cardH - (needCat ? 34 : 0) < M + 24) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
    if (needCat) {
      category = d.category;
      y -= 22;
      text(category.toUpperCase(), M, y, 12, true, ACCENT);
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 1.2, color: ACCENT });
      y -= 6;
    }
    const top = y - 6;
    page.drawRectangle({ x: M, y: top - cardH, width: A4.w - 2 * M, height: cardH, color: CARD, borderColor: LINE, borderWidth: 0.6 });
    const img = await embedPhoto(doc, d.photo);
    const px = M + 10;
    const py = top - 10 - PHOTO;
    if (img) {
      // La foto entera dentro del cuadro, sin deformarla.
      const k = Math.min(PHOTO / img.width, PHOTO / img.height);
      const w = img.width * k;
      const h = img.height * k;
      page.drawImage(img, { x: px + (PHOTO - w) / 2, y: py + (PHOTO - h) / 2, width: w, height: h });
    } else {
      page.drawRectangle({ x: px, y: py, width: PHOTO, height: PHOTO, color: rgb(0.9, 0.91, 0.93) });
      text('Sin foto', px + PHOTO / 2 - width('Sin foto', 9) / 2, py + PHOTO / 2 - 3, 9, false, MUTED);
    }
    const x = px + PHOTO + 16;
    const max = A4.w - M - 10 - x;
    let ly = top - 22;
    text(fit(d.name, 14, max - 90, true), x, ly, 14, true);
    const price = formatCop(d.price);
    text(price, A4.w - M - 10 - width(price, 12, true), ly, 12, true, ACCENT);
    ly -= 14;
    text(fit(`${d.station === 'bar' ? 'Barra' : 'Cocina'}${d.description ? ` · ${d.description}` : ''}`, 9, max), x, ly, 9, false, MUTED);
    ly -= 18;
    if (!d.lines.length) {
      text('Sin receta cargada.', x, ly, 10, false, MUTED);
    } else {
      text('Insumo', x, ly, 8.5, true, MUTED);
      text('Cantidad', x + max - (opts.showCosts ? 150 : 70), ly, 8.5, true, MUTED);
      if (opts.showCosts) text('Costo', x + max - 55, ly, 8.5, true, MUTED);
      ly -= 13;
      let total = 0;
      for (const l of d.lines) {
        const cost = Math.round(l.quantity * l.unitCost);
        total += cost;
        text(fit(l.item, 10, max - (opts.showCosts ? 160 : 80)), x, ly, 10);
        text(shortQuantity(l.quantity, l.unit, l.bottleSize), x + max - (opts.showCosts ? 150 : 70), ly, 10);
        if (opts.showCosts) {
          const c = formatCop(cost);
          text(c, x + max - width(c, 10), ly, 10);
        }
        ly -= 13;
      }
      if (opts.showCosts) {
        const pct = d.price ? Math.round((total / d.price) * 100) : 0;
        const line = `Costo de la porción ${formatCop(total)} · ${pct} % del precio`;
        text(line, x + max - width(line, 9.5, true), ly - 2, 9.5, true);
      }
    }
    y = top - cardH - 8;
  }
  if (!dishes.length) text('No hay platos activos en la carta.', M, y - 20, 11);

  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(pdfSafe(`${opts.business} · Recetario · Página ${i + 1} de ${pages.length}`), { x: M, y: 22, size: 7.5, font: regular, color: MUTED }));
  return doc.save();
}
