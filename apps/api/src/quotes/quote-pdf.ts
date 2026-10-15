import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type QuotePdf = {
  companyName: string;
  companyLine: string;
  code: string;
  title: string;
  date: string;
  validUntil: string | null;
  client: string[];
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  notes: string | null;
};

const latin1 = (t: string) =>
  t
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\u0009\u000a -~ -ÿ]/g, '');
const money = (n: number) => `$${new Intl.NumberFormat('es-CO').format(n)}`;

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of latin1(text).split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Cotización en PDF tamaño carta: membrete, cliente, tabla de ítems, totales y notas. */
export async function renderQuote(q: QuotePdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(latin1(`${q.code} ${q.title}`));
  pdf.setProducer('3R');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 56;
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.42, 0.45, 0.5);
  const line = rgb(0.85, 0.87, 0.9);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const t = (s: string, x: number, font = regular, size = 10, color = ink) => page.drawText(latin1(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, font = regular, size = 10, color = ink) =>
    page.drawText(latin1(s), { x: xRight - font.widthOfTextAtSize(latin1(s), size), y, size, font, color });

  t(q.companyName, M, bold, 15);
  right(`Cotización ${q.code}`, W - M, bold, 13);
  y -= 15;
  t(q.companyLine, M, regular, 9, muted);
  right(`Fecha: ${q.date}`, W - M, regular, 9, muted);
  y -= 12;
  if (q.validUntil) right(`Válida hasta: ${q.validUntil}`, W - M, regular, 9, muted);
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: line });
  y -= 24;
  t('Para', M, regular, 9, muted);
  y -= 14;
  for (const c of q.client) {
    t(c, M, c === q.client[0] ? bold : regular, 11);
    y -= 14;
  }
  y -= 10;
  for (const l of wrap(q.title, bold, 13, W - 2 * M)) {
    t(l, M, bold, 13);
    y -= 17;
  }
  y -= 8;

  const cols = { desc: M, qty: 340, unit: 440, total: W - M };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.95, 0.96, 0.97) });
    t('Descripción', cols.desc + 6, bold, 9);
    right('Cant.', cols.qty + 20, bold, 9);
    right('Valor unitario', cols.unit + 40, bold, 9);
    right('Total', cols.total - 6, bold, 9);
    y -= 24;
  };
  header();
  for (const item of q.items) {
    const lines = wrap(item.description, regular, 10, cols.qty - cols.desc - 40);
    if (y - lines.length * 13 < M + 120) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    right(String(item.quantity), cols.qty + 20);
    right(money(item.unitPrice), cols.unit + 40);
    right(money(item.total), cols.total - 6);
    for (const l of lines) {
      t(l, cols.desc + 6);
      y -= 13;
    }
    y -= 5;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.4, color: line });
  }
  y -= 8;
  const row = (label: string, value: string, strong = false) => {
    right(label, cols.total - 110, strong ? bold : regular, strong ? 12 : 10, strong ? ink : muted);
    right(value, cols.total - 6, strong ? bold : regular, strong ? 12 : 10);
    y -= strong ? 18 : 14;
  };
  row('Subtotal', money(q.subtotal));
  if (q.discount) row('Descuento', `-${money(q.discount)}`);
  if (q.taxRate) row(`IVA ${q.taxRate} %`, money(q.tax));
  row('Total', money(q.total), true);

  if (q.notes) {
    y -= 16;
    t('Condiciones y notas', M, bold, 10);
    y -= 14;
    for (const l of wrap(q.notes, regular, 10, W - 2 * M)) {
      if (y < M + 30) {
        page = pdf.addPage([W, H]);
        y = H - M;
      }
      t(l, M, regular, 10, muted);
      y -= 13;
    }
  }
  for (const p of pdf.getPages()) p.drawText('Cotización hecha con 3R', { x: M, y: 32, size: 8, font: regular, color: muted });
  return pdf.save();
}
