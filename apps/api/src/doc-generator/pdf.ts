import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

export type Letter = {
  companyName: string;
  companyLines: string[];
  placeAndDate: string;
  title: string;
  addressee?: string;
  paragraphs: string[];
  signerName: string;
  signerTitle: string;
  footer: string;
};

/** Las fuentes estándar del PDF solo traen Latin-1: se cambian comillas, guiones y lo que no tenga equivalente. */
export const latin1 = (text: string) =>
  text
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/[^\u0009\u000a -~ -ÿ]/g, '');

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Carta tamaño carta con membrete sencillo de la empresa, texto justificado a la izquierda y firma. */
export async function renderLetter(letter: Letter): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(latin1(letter.title));
  pdf.setProducer('3R');
  pdf.setCreator('3R — plataforma empresarial');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const H = 792;
  const M = 72;
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.42, 0.45, 0.5);
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, font: PDFFont, size: number, color = ink, x = M) => {
    page.drawText(latin1(t), { x, y, size, font, color });
  };
  const ensure = (needed: number) => {
    if (y - needed < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  // Membrete.
  text(letter.companyName, bold, 15);
  y -= 16;
  for (const l of letter.companyLines) {
    text(l, regular, 9.5, muted);
    y -= 12;
  }
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: rgb(0.8, 0.82, 0.86) });
  y -= 36;

  text(letter.placeAndDate, regular, 11);
  y -= 42;
  const titleWidth = bold.widthOfTextAtSize(latin1(letter.title), 13);
  text(letter.title, bold, 13, ink, (W - titleWidth) / 2);
  y -= 34;
  if (letter.addressee) {
    text(letter.addressee, bold, 11);
    y -= 28;
  }

  for (const p of letter.paragraphs) {
    for (const line of wrap(latin1(p), regular, 11, W - 2 * M)) {
      ensure(16);
      text(line, regular, 11);
      y -= 16;
    }
    y -= 10;
  }

  ensure(120);
  y -= 30;
  text('Atentamente,', regular, 11);
  y -= 64;
  page.drawLine({ start: { x: M, y: y + 14 }, end: { x: M + 220, y: y + 14 }, thickness: 0.6, color: ink });
  text(letter.signerName, bold, 11);
  y -= 14;
  text(letter.signerTitle, regular, 10, muted);
  y -= 14;
  text(letter.companyName, regular, 10, muted);

  for (const p of pdf.getPages()) {
    p.drawText(latin1(letter.footer), { x: M, y: 40, size: 8, font: regular, color: muted });
  }
  return pdf.save();
}
