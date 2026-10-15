import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { latin1, wrap } from '../doc-generator/pdf.js';

export type Certificate = {
  companyName: string;
  personName: string;
  courseTitle: string;
  lessons: number;
  score: number | null;
  dateText: string;
  code: string;
};

/** Certificado horizontal tamaño carta: empresa, persona, curso, fecha y código para verificarlo. */
export async function renderCertificate(c: Certificate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(latin1(`Certificado - ${c.courseTitle}`));
  pdf.setProducer('3R');
  pdf.setCreator('3R — plataforma empresarial');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 792;
  const H = 612;
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.42, 0.45, 0.5);
  const accent = rgb(0.45, 0.52, 0.98);
  const page = pdf.addPage([W, H]);

  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: accent, borderWidth: 2 });
  page.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: rgb(0.82, 0.84, 0.9), borderWidth: 0.6 });

  const center = (t: string, y: number, font: PDFFont, size: number, color = ink) => {
    const s = latin1(t);
    page.drawText(s, { x: (W - font.widthOfTextAtSize(s, size)) / 2, y, size, font, color });
  };
  /** Ajusta el tamaño para que quepa en una línea; si no cabe ni en el mínimo, parte en dos. */
  const fit = (t: string, y: number, font: PDFFont, size: number, min: number, max = W - 160) => {
    const s = latin1(t);
    let sz = size;
    while (sz > min && font.widthOfTextAtSize(s, sz) > max) sz -= 1;
    const lines = font.widthOfTextAtSize(s, sz) > max ? wrap(s, font, sz, max).slice(0, 2) : [s];
    lines.forEach((l, i) => center(l, y - i * (sz + 6), font, sz));
    return y - (lines.length - 1) * (sz + 6);
  };

  center(c.companyName.toUpperCase(), H - 92, bold, 13, muted);
  center('CERTIFICADO DE CAPACITACIÓN', H - 150, bold, 26);
  page.drawLine({ start: { x: W / 2 - 60, y: H - 168 }, end: { x: W / 2 + 60, y: H - 168 }, thickness: 1.5, color: accent });
  center('Se certifica que', H - 210, regular, 13, muted);
  let y = fit(c.personName, H - 254, bold, 30, 18);
  center('completó el curso', y - 40, regular, 13, muted);
  y = fit(c.courseTitle, y - 80, bold, 20, 13);
  const detail = [`${c.lessons} ${c.lessons === 1 ? 'lección' : 'lecciones'}`, c.score != null ? `evaluación aprobada con ${c.score} %` : null]
    .filter(Boolean)
    .join(' · ');
  center(detail, y - 34, regular, 12, muted);

  page.drawText(latin1(c.dateText), { x: 90, y: 92, size: 11, font: regular, color: ink });
  page.drawLine({ start: { x: 90, y: 86 }, end: { x: 300, y: 86 }, thickness: 0.6, color: ink });
  page.drawText('Fecha', { x: 90, y: 72, size: 9, font: regular, color: muted });
  const code = latin1(`Código ${c.code}`);
  page.drawText(code, { x: W - 90 - regular.widthOfTextAtSize(code, 11), y: 92, size: 11, font: regular, color: ink });
  page.drawLine({ start: { x: W - 300, y: 86 }, end: { x: W - 90, y: 86 }, thickness: 0.6, color: ink });
  const lbl = 'Generado con 3R';
  page.drawText(lbl, { x: W - 90 - regular.widthOfTextAtSize(lbl, 9), y: 72, size: 9, font: regular, color: muted });
  return pdf.save();
}
