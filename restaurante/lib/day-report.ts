// Cierre completo del día en PDF (4 nov 2026, pedido de Rigoberto: «que todos los días tenga la opción de descargar el
// cierre completo, bien detallado»). Junta todos los turnos de caja del día: resumen, cada turno con su arqueo, ventas por
// categoría y producto, cada mesa cobrada, salidas, facturas por pagar, pérdidas, anulaciones y descuentos, inventario y
// firmas. Sale en español, como todo lo impreso. Se arma en el servidor con pdf-lib (sin navegador, sirve en Vercel).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { METHOD_LABEL, METHODS, dayShifts, workMode, type ShiftSummary } from './cash';
import { cashCountLines } from './cash-count';
import { dayTotals, shiftDifference } from './cash-day';
import {
  closingInventory,
  dailyForm,
  groupByCategory,
  shiftIncidents,
  shiftSalesByCategory,
  shortQuantity,
  sumAmounts,
  tipOfSales,
  type CategorySales,
  type DailyForm,
  type ShiftIncidents,
} from './closing-report';
import { formatCop, formatDateTime, formatTime } from './format';
import { AREA_LABEL } from './inventory';
import { requirePermission, type Actor } from './store';
import { tableAccounts, type TableAccount } from './table-accounts';

export type DayReport = {
  date: string;
  business: string;
  location: string;
  timeZone: string;
  by: string;
  generatedAt: Date;
  tipPercent: number;
  shifts: ShiftSummary[];
  categories: CategorySales[];
  tables: TableAccount[];
  form: DailyForm;
  incidents: ShiftIncidents;
  inventory: Awaited<ReturnType<typeof closingInventory>>;
};

/** Suma lo vendido de varios turnos por categoría y producto (en el orden en que aparecen). */
export function mergeCategories(lists: CategorySales[][]): CategorySales[] {
  return groupByCategory(lists.flatMap((l) => l.flatMap((c) => c.products.map((p) => ({ category: c.category, ...p }))))).map((c) => {
    const merged = new Map<string, { name: string; quantity: number; total: number }>();
    for (const p of c.products) {
      const m = merged.get(p.name);
      if (m) {
        m.quantity += p.quantity;
        m.total += p.total;
      } else merged.set(p.name, { ...p });
    }
    return { ...c, products: [...merged.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'es')) };
  });
}

/** Todo lo del día `date` (AAAA-MM-DD, hora de la sede). Null si ese día no hubo caja. */
export async function dayReport(
  actor: Actor & { businessName: string; locationName: string; timezone: string },
  date: string,
): Promise<DayReport | null> {
  requirePermission(actor, 'cash.operate');
  const shifts = await dayShifts(actor, date);
  if (!shifts.length) return null;
  const perShift = await Promise.all(
    shifts.map(async (s) => ({
      categories: await shiftSalesByCategory(actor, s.shift.id),
      incidents: await shiftIncidents(actor, s.shift.openedAt, s.shift.closedAt),
      form: await dailyForm(actor, s.shift.id, s.shift.openedAt, s.shift.closedAt),
    })),
  );
  const [{ suggestedTip }, inventory, accounts] = await Promise.all([workMode(actor.businessId), closingInventory(actor), tableAccounts(actor, date, actor.timezone)]);
  const last = perShift[perShift.length - 1];
  return {
    date,
    business: actor.businessName,
    location: actor.locationName,
    timeZone: actor.timezone,
    by: actor.name,
    generatedAt: new Date(),
    tipPercent: suggestedTip,
    shifts,
    categories: mergeCategories(perShift.map((x) => x.categories)),
    tables: accounts.collected,
    form: {
      withInvoice: perShift.flatMap((x) => x.form.withInvoice),
      withoutInvoice: perShift.flatMap((x) => x.form.withoutInvoice),
      // Las facturas por pagar son todas las pendientes de la sede: las de ahora, no por turno.
      toPay: last.form.toPay,
      losses: perShift.flatMap((x) => x.form.losses),
    },
    incidents: {
      voids: perShift.flatMap((x) => x.incidents.voids),
      discounts: perShift.flatMap((x) => x.incidents.discounts),
      closedUnpaid: perShift.flatMap((x) => x.incidents.closedUnpaid),
    },
    inventory,
  };
}

// ───────── el PDF ─────────

const A4 = { w: 595.28, h: 841.89 };
const M = 42;
const INK = rgb(0.07, 0.08, 0.11);
const MUTED = rgb(0.38, 0.41, 0.47);
const ACCENT = rgb(0.31, 0.37, 0.84);
const LINE = rgb(0.85, 0.87, 0.91);

/** Las letras estándar del PDF solo traen el alfabeto latino: lo demás se cambia por algo parecido. */
export function pdfSafe(text: string) {
  return text
    .replace(/[−–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

const resultText = (diff: number | null) => (diff === null ? 'Sigue abierta' : diff === 0 ? 'Cuadra' : diff > 0 ? `Sobran ${formatCop(diff)}` : `Faltan ${formatCop(-diff)}`);

export const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  y = 0;
  regular!: PDFFont;
  bold!: PDFFont;

  static async create() {
    const w = new Writer();
    w.doc = await PDFDocument.create();
    w.regular = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.newPage();
    return w;
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - M;
  }

  ensure(height: number) {
    if (this.y - height < M + 24) this.newPage();
  }

  width(text: string, size: number, bold = false) {
    return (bold ? this.bold : this.regular).widthOfTextAtSize(pdfSafe(text), size);
  }

  /** Corta un texto en renglones que quepan en `max` puntos. */
  wrap(text: string, size: number, max: number, bold = false) {
    const out: string[] = [];
    for (const para of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (this.width(next, size, bold) <= max || !line) line = next;
        else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  draw(text: string, x: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    this.page.drawText(pdfSafe(text), { x, y: this.y, size, font: opts.bold ? this.bold : this.regular, color: opts.color ?? INK });
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 9.5;
    const x = M + (opts.indent ?? 0);
    for (const line of this.wrap(text, size, A4.w - M - x, opts.bold)) {
      this.ensure(size + 4);
      this.y -= size + 3;
      this.draw(line, x, size, opts);
    }
    this.y -= opts.gap ?? 0;
  }

  /** Renglón con la etiqueta a la izquierda y el valor a la derecha. */
  row(label: string, value: string, opts: { bold?: boolean; indent?: number; size?: number } = {}) {
    const size = opts.size ?? 9.5;
    const right = A4.w - M;
    const lines = this.wrap(label, size, right - (M + (opts.indent ?? 0)) - this.width(value, size, opts.bold) - 12, opts.bold);
    for (const [i, line] of lines.entries()) {
      this.ensure(size + 5);
      this.y -= size + 4;
      this.draw(line, M + (opts.indent ?? 0), size, { bold: opts.bold });
      if (i === 0) this.draw(value, right - this.width(value, size, opts.bold), size, { bold: opts.bold });
    }
  }

  rule(color = LINE) {
    this.ensure(8);
    this.y -= 5;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness: 0.6, color });
    this.y -= 3;
  }

  heading(text: string) {
    this.ensure(64);
    this.y -= 34;
    this.draw(text, M, 13, { bold: true, color: ACCENT });
    this.y -= 4;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness: 1.2, color: ACCENT });
    this.y -= 4;
  }

  sub(text: string) {
    this.ensure(30);
    this.y -= 8;
    this.text(text, { size: 10.5, bold: true });
  }

  /** Tabla sencilla: columnas con su ancho; las de plata a la derecha. */
  table(cols: { title: string; width: number; right?: boolean }[], rows: string[][]) {
    const size = 8.5;
    const xs: number[] = [];
    let x = M;
    for (const c of cols) {
      xs.push(x);
      x += c.width;
    }
    const cell = (text: string, i: number, bold: boolean) => {
      const c = cols[i];
      let t = pdfSafe(text);
      // Lo que no cabe en la columna se corta y termina en punto.
      while (t.length > 1 && this.width(t, size, bold) > c.width - 6) t = t.slice(0, -2) + '.';
      const tx = c.right ? xs[i] + c.width - 4 - this.width(t, size, bold) : xs[i];
      this.draw(t, tx, size, { bold, color: bold ? MUTED : INK });
    };
    const header = () => {
      this.ensure(30);
      this.y -= size + 5;
      cols.forEach((c, i) => cell(c.title, i, true));
      this.rule();
    };
    header();
    for (const r of rows) {
      if (this.y - (size + 6) < M + 24) {
        this.newPage();
        header();
      }
      this.y -= size + 5;
      r.forEach((v, i) => cell(v, i, false));
    }
  }

  finish(footer: string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const t = pdfSafe(`${footer}  ·  Página ${i + 1} de ${pages.length}`);
      p.drawText(t, { x: M, y: 22, size: 7.5, font: this.regular, color: MUTED });
    });
    return this.doc.save();
  }
}

export async function dayReportPdf(r: DayReport): Promise<Uint8Array> {
  const w = await Writer.create();
  const tz = r.timeZone;
  const totals = dayTotals(r.shifts);
  const allOpen = totals.open === totals.turns;

  // Encabezado
  w.y -= 4;
  w.draw(r.business, M, 10, { bold: true, color: ACCENT });
  w.y -= 26;
  w.draw('Cierre completo del día', M, 22, { bold: true });
  w.y -= 18;
  const d = longDate(r.date);
  w.draw(`${d.charAt(0).toUpperCase()}${d.slice(1)} · Sede ${r.location}`, M, 11);
  w.y -= 14;
  w.draw(`Descargado por ${r.by} el ${formatDateTime(r.generatedAt, tz)}`, M, 8.5, { color: MUTED });
  if (totals.open) {
    w.y -= 13;
    w.draw(totals.open === 1 ? 'Ojo: 1 turno sigue abierto; sus números pueden cambiar.' : `Ojo: ${totals.open} turnos siguen abiertos; sus números pueden cambiar.`, M, 9, { bold: true });
  }

  // 1. Resumen
  w.heading('Resumen del día');
  w.row('Ventas cobradas', formatCop(totals.sales), { bold: true });
  w.row(r.tipPercent > 0 ? 'Propinas cobradas (marcadas al cobrar)' : 'Propinas', formatCop(totals.tips));
  for (const m of METHODS) {
    const b = totals.byMethod[m];
    w.row(`${METHOD_LABEL[m]} (${b.count} ${b.count === 1 ? 'pago' : 'pagos'})`, `${formatCop(b.amount)}${b.tip ? ` + propina ${formatCop(b.tip)}` : ''}`, { indent: 10 });
  }
  w.row('Descuentos', formatCop(totals.discounts));
  w.row('Pagos reversados', formatCop(r.shifts.reduce((s, x) => s + x.reversed, 0)));
  w.row('Entradas de efectivo', formatCop(totals.movementsIn));
  w.row('Salidas de efectivo', formatCop(totals.movementsOut));
  w.row('Sobre para la cocina', formatCop(totals.envelopeKitchen));
  w.row('Sobre para el bar', formatCop(totals.envelopeBar));
  w.row('Caja fuerte', formatCop(totals.safeAmount));
  w.row('Mesas cobradas', String(totals.tablesClosed));
  w.rule();
  w.row('Resultado del día (suma de los turnos)', allOpen ? 'Sigue abierta' : resultText(totals.difference), { bold: true, size: 11 });
  w.text('La base y el efectivo esperado no se suman entre turnos: la base de un turno es lo que dejó el anterior en la caja.', { size: 8, color: MUTED });

  // 2. Cada turno
  w.heading('Turnos de caja');
  for (const s of r.shifts) {
    const sh = s.shift;
    const diff = shiftDifference(s);
    const closedDay = sh.closedAt ? new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(sh.closedAt) : null;
    const until = !sh.closedAt ? 'sigue abierta' : closedDay === sh.day ? formatTime(sh.closedAt, tz) : formatDateTime(sh.closedAt, tz);
    w.sub(`Turno ${sh.dayNumber} · ${sh.openedBy}${sh.closedBy && sh.closedBy !== sh.openedBy ? ` / cerró ${sh.closedBy}` : ''} · ${formatTime(sh.openedAt, tz)} a ${until}`);
    for (const m of METHODS) w.row(`${METHOD_LABEL[m]} (${s.byMethod[m].count})`, `${formatCop(s.byMethod[m].amount)}${s.byMethod[m].tip ? ` + propina ${formatCop(s.byMethod[m].tip)}` : ''}`, { indent: 10 });
    w.row('Ventas', formatCop(s.sales), { indent: 10, bold: true });
    w.row('Descuentos', formatCop(s.discounts), { indent: 10 });
    w.row('Entradas / salidas de efectivo', `${formatCop(s.movementsIn)} / ${formatCop(s.movementsOut)}`, { indent: 10 });
    // La base va aparte del efectivo de la venta (8 nov 2026, pedido de Rigoberto).
    if (s.tipToDeliver) {
      w.row('Debe haber al contar (con propina)', formatCop(sh.expectedCash ?? s.expectedCash), { indent: 10 });
      w.row('- Propina para entregar', formatCop(s.tipToDeliver), { indent: 10 });
    }
    w.row('Efectivo de la venta (sin base)', formatCop(s.salesCash), { indent: 10, bold: true });
    if (sh.openingAmount) {
      w.row('+ Base (aparte)', formatCop(sh.openingAmount), { indent: 10 });
      if (!s.tipToDeliver) w.row('Total en la caja (venta + base)', formatCop(sh.expectedCash ?? s.expectedCash), { indent: 10 });
    }
    w.row('Efectivo contado', sh.countedCash === null ? '-' : formatCop(sh.countedCash), { indent: 10 });
    w.row('Resultado', resultText(diff), { indent: 10, bold: true });
    if (sh.correctedAt) w.text(`Cierre corregido por ${sh.correctedBy} el ${formatDateTime(sh.correctedAt, tz)}: ${sh.correctionReason}`, { indent: 10, size: 9, bold: true });
    const count = cashCountLines(sh.cashCount);
    if (count.length) {
      w.text('Arqueo:', { indent: 10, bold: true, size: 9 });
      for (const x of count) w.row(`${x.kind === 'bill' ? 'Billetes' : 'Monedas'} de ${formatCop(x.value)} x ${x.quantity}`, formatCop(x.total), { indent: 22, size: 8.5 });
    }
    if (sh.countedCash !== null) {
      w.row('Reparto: sobre cocina / sobre bar / caja fuerte', `${formatCop(sh.envelopeKitchen)} / ${formatCop(sh.envelopeBar)} / ${formatCop(sh.safeAmount)}`, { indent: 10 });
      w.row('Quedó en la caja', formatCop(Math.max(0, sh.countedCash - sh.envelopeKitchen - sh.envelopeBar - sh.safeAmount)), { indent: 10 });
    }
    if (s.movements.length) {
      w.text('Entradas y salidas de efectivo:', { indent: 10, bold: true, size: 9 });
      for (const m of s.movements) w.row(`${formatTime(m.createdAt, tz)} · ${m.reason} (${m.createdBy})`, `${m.kind === 'in' ? '+' : '-'}${formatCop(m.amount)}`, { indent: 22, size: 8.5 });
    }
    if (sh.notes) w.text(`Observaciones: ${sh.notes}`, { indent: 10, size: 9 });
  }

  // 3. Ventas por categoría
  w.heading('Ventas por categoría y producto');
  if (!r.categories.length) w.text('No hubo ventas cobradas.', { color: MUTED });
  for (const c of r.categories) {
    w.row(`${c.category} (${c.quantity})`, formatCop(c.total), { bold: true });
    for (const p of c.products) w.row(`${p.quantity} x ${p.name}`, formatCop(p.total), { indent: 12, size: 9 });
  }
  if (r.categories.length) {
    w.rule();
    w.row('Total vendido (antes de descuentos)', formatCop(r.categories.reduce((s, c) => s + c.total, 0)), { bold: true });
  }

  // 4. Mesas cobradas
  w.heading('Mesas cobradas');
  if (!r.tables.length) w.text('Ninguna mesa cobrada este día.', { color: MUTED });
  else
    w.table(
      [
        { title: 'Mesa', width: 36 },
        { title: 'Horas', width: 118 },
        { title: 'Atendió', width: 92 },
        { title: 'Cobró', width: 60 },
        { title: 'Pago', width: 80 },
        { title: 'Propina', width: 55, right: true },
        { title: 'Cobrado', width: 70, right: true },
      ],
      r.tables.map((a) => [
        a.tableNumber,
        `${formatTime(a.openedAt, tz)} - ${a.closedAt ? formatTime(a.closedAt, tz) : ''}`,
        a.waiters.map((x) => x.name).join(', '),
        a.collectedBy.join(', ') || '-',
        a.paid ? a.methods.map((m) => METHOD_LABEL[m]).join(', ') : 'Sin cobrar',
        a.tip ? formatCop(a.tip) : '-',
        formatCop(a.paid),
      ]),
    );

  // 5. Salidas, facturas por pagar y pérdidas
  const list = (title: string, items: { left: string; amount: number }[], empty: string) => {
    w.sub(title);
    if (!items.length) w.text(empty, { color: MUTED, indent: 10 });
    for (const it of items) w.row(it.left, formatCop(it.amount), { indent: 10, size: 9 });
    if (items.length) w.row('Subtotal', formatCop(sumAmounts(items)), { indent: 10, bold: true, size: 9 });
  };
  w.heading('Salidas de dinero, facturas y pérdidas');
  list('Salidas con factura', r.form.withInvoice.map((x) => ({ left: `${x.description} · factura ${x.invoiceNumber} · de: ${x.from}`, amount: x.amount })), 'Ninguna.');
  list('Salidas sin factura', r.form.withoutInvoice.map((x) => ({ left: `${x.description} · ${x.reason} · de: ${x.from}`, amount: x.amount })), 'Ninguna.');
  list(
    'Facturas por pagar (todas las pendientes de la sede)',
    r.form.toPay.map((x) => ({ left: `${x.supplier ? `${x.supplier}: ` : ''}${x.description} · ${x.dueOn ? `vence ${x.dueOn}` : 'sin fecha de vencimiento'}`, amount: x.amount })),
    'Ninguna.',
  );
  list('Pérdidas del día', r.form.losses.map((x) => ({ left: x.description, amount: x.amount })), 'Ninguna.');

  // 6. Descuentos y mesas sin cobrar (sin anulaciones ni inventario: 5 nov 2026, pedido de Rigoberto)
  w.heading('Descuentos y mesas sin cobrar');
  w.sub('Descuentos');
  if (!r.incidents.discounts.length) w.text('Ninguno.', { color: MUTED, indent: 10 });
  for (const x of r.incidents.discounts) w.row(`Mesa ${x.table} · ${x.reason}${x.by ? ` (${x.by})` : ''}`, formatCop(x.amount), { indent: 10, size: 9 });
  w.sub('Mesas cerradas sin cobrar');
  if (!r.incidents.closedUnpaid.length) w.text('Ninguna.', { color: MUTED, indent: 10 });
  for (const x of r.incidents.closedUnpaid) w.text(`${x.summary}: ${x.reason}${x.by ? ` (${x.by})` : ''}`, { indent: 10, size: 9 });

  // 8. Firmas
  w.ensure(110);
  w.heading('Firmas');
  w.y -= 34;
  const half = (A4.w - 2 * M - 30) / 2;
  for (const [i, label] of ['Cajera(s)', 'Administrador'].entries()) {
    const x = M + i * (half + 30);
    w.page.drawLine({ start: { x, y: w.y }, end: { x: x + half, y: w.y }, thickness: 0.6, color: INK });
    w.page.drawText(label, { x, y: w.y - 12, size: 8.5, font: w.regular, color: MUTED });
  }

  return w.finish(`Cierre del día ${r.date} · ${r.business} · ${r.location}`);
}
