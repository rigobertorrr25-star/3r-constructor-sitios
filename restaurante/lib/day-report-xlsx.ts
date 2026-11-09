// El cierre completo del día en Excel (5 nov 2026, pedido de Rigoberto: «el documento lo quiero en Excel y que esté
// todo bien organizado»). Una hoja por parte, con títulos, totales y la plata con formato de pesos.
import ExcelJS from 'exceljs';
import { METHOD_LABEL, METHODS } from './cash';
import { dayTotals, shiftDifference } from './cash-day';
import { formatDateTime, formatTime } from './format';
import type { DayReport } from './day-report';

const MONEY = '"$"#,##0;[Red]-"$"#,##0';
const NAVY = 'FF1F2A44';
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const HEAD_FILL = fill(NAVY);
const BAND_FILL = fill('FF2E3B5E');
const TOTAL_FILL = fill('FFDDE4F2');
const ZEBRA_FILL = fill('FFF5F7FB');
const OK_FILL = fill('FFDDF3E4');
const BAD_FILL = fill('FFFBE0E0');
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFD3D8E2' } };
const BOX: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const result = (d: number | null) => (d === null ? 'Sigue abierta' : d === 0 ? 'Cuadra' : d > 0 ? 'Sobra' : 'Falta');

type Col = { header: string; width: number; money?: boolean };

/** Banda de arriba con el nombre del negocio, el título de la hoja y la fecha (rediseño 5 nov 2026). */
function banner(ws: ExcelJS.Worksheet, cols: number, title: string, sub: string) {
  ws.mergeCells(1, 1, 1, cols);
  ws.mergeCells(2, 1, 2, cols);
  const a = ws.getCell(1, 1);
  a.value = title;
  a.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  a.fill = HEAD_FILL;
  a.alignment = { vertical: 'middle', indent: 1 };
  const b = ws.getCell(2, 1);
  b.value = sub;
  b.font = { size: 10.5, color: { argb: 'FFE6EAF2' } };
  b.fill = BAND_FILL;
  b.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 20;
  ws.pageSetup = { orientation: cols > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

/** Una hoja de tabla: banda, encabezados de color, bordes, filas alternas, totales, filtros y encabezado fijo. */
function table(wb: ExcelJS.Workbook, name: string, title: string, sub: string, cols: Col[], rows: (string | number | null)[][], totals?: (string | number | null)[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  ws.columns = cols.map((c) => ({ width: c.width }));
  banner(ws, cols.length, title, sub);
  const head = ws.getRow(4);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEAD_FILL;
    cell.border = BOX;
    cell.alignment = { vertical: 'middle', horizontal: c.money ? 'right' : 'left', wrapText: true };
  });
  head.height = 24;
  if (!rows.length) {
    ws.mergeCells(5, 1, 5, cols.length);
    const e = ws.getCell(5, 1);
    e.value = 'Nada este día.';
    e.font = { italic: true, color: { argb: 'FF7A8194' } };
  }
  rows.forEach((r, n) => {
    const row = ws.addRow(r);
    for (let i = 1; i <= cols.length; i++) {
      const c = row.getCell(i);
      c.border = BOX;
      c.alignment = { vertical: 'top', wrapText: true };
      if (n % 2) c.fill = ZEBRA_FILL;
    }
  });
  if (totals && rows.length) {
    const row = ws.addRow(totals);
    row.font = { bold: true };
    for (let i = 1; i <= cols.length; i++) {
      row.getCell(i).fill = TOTAL_FILL;
      row.getCell(i).border = BOX;
    }
    row.height = 20;
  }
  cols.forEach((c, i) => {
    if (c.money) ws.getColumn(i + 1).numFmt = MONEY;
  });
  if (rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: cols.length } };
  return ws;
}

export async function dayReportXlsx(r: DayReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Restaurant Control';
  const tz = r.timeZone;
  const totals = dayTotals(r.shifts);
  const longDate = new Date(`${r.date}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const sub = `${r.business} · ${r.location} · ${longDate.charAt(0).toUpperCase() + longDate.slice(1)}`;

  // 1. Resumen, por bloques. La base del día es la del primer turno (la del 2 es lo que dejó el 1).
  const res = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  res.columns = [{ width: 42 }, { width: 22 }];
  banner(res, 2, 'Cierre del día', sub);
  let y = 4;
  const block = (title: string, items: [string, number | string, ('strong' | 'ok' | 'bad')?][]) => {
    res.mergeCells(y, 1, y, 2);
    const h = res.getCell(y, 1);
    h.value = title.toUpperCase();
    h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    h.fill = BAND_FILL;
    h.alignment = { indent: 1, vertical: 'middle' };
    res.getRow(y).height = 20;
    y++;
    items.forEach(([label, value, tone], n) => {
      const row = res.getRow(y++);
      const [a, b] = [row.getCell(1), row.getCell(2)];
      a.value = label;
      b.value = value;
      a.alignment = { indent: 1 };
      if (typeof value === 'number') b.numFmt = MONEY;
      else b.alignment = { horizontal: 'right' };
      for (const c of [a, b]) {
        c.border = BOX;
        c.fill = tone === 'ok' ? OK_FILL : tone === 'bad' ? BAD_FILL : tone === 'strong' ? TOTAL_FILL : n % 2 ? ZEBRA_FILL : fill('FFFFFFFF');
      }
      if (tone) row.font = { bold: true };
    });
    y++;
  };
  const first = r.shifts[0];
  block('Caja', [
    ...(r.shifts.some((s) => s.shift.openingAmount)
      ? [
          ['Base con que se abrió el día', first.shift.openingAmount, 'strong'] as [string, number, 'strong'],
          ...r.shifts.map((s): [string, number] => [`Base del turno ${s.shift.dayNumber} (${s.shift.openedBy})`, s.shift.openingAmount]),
        ]
      : []),
    ['Entradas de efectivo', totals.movementsIn],
    ['Salidas de efectivo', totals.movementsOut],
    // La base va aparte del efectivo de la venta (8 nov 2026, pedido de Rigoberto).
    ...r.shifts.flatMap((s): [string, number][] =>
      s.tipToDeliver
        ? [
            [`Debe haber al contar turno ${s.shift.dayNumber} (con propina)`, s.shift.expectedCash ?? s.expectedCash],
            [`Propina para entregar turno ${s.shift.dayNumber}`, -s.tipToDeliver],
          ]
        : [],
    ),
    ...r.shifts.map((s): [string, number, 'strong'] => [`Efectivo de la venta turno ${s.shift.dayNumber} (sin base)`, s.salesCash, 'strong']),
    ...r.shifts.filter((s) => s.shift.openingAmount && !s.tipToDeliver).map((s): [string, number] => [`Total en la caja turno ${s.shift.dayNumber} (venta + base)`, s.shift.expectedCash ?? s.expectedCash]),
    ...r.shifts.filter((s) => s.shift.countedCash !== null).map((s): [string, number] => [`Efectivo contado turno ${s.shift.dayNumber}`, s.shift.countedCash!]),
  ]);
  block('Ventas', [
    ...METHODS.map((m): [string, number] => [`${METHOD_LABEL[m]} (${totals.byMethod[m].count} ${totals.byMethod[m].count === 1 ? 'pago' : 'pagos'})`, totals.byMethod[m].amount]),
    ['Total vendido', totals.sales, 'strong'],
    ['Propinas cobradas', totals.tips, 'strong'],
    ['Descuentos', totals.discounts],
    ['Mesas cerradas', `${totals.tablesClosed}`],
  ]);
  block('Reparto del efectivo', [
    ['Sobre para la cocina', totals.envelopeKitchen],
    ['Sobre para el bar', totals.envelopeBar],
    ['Caja fuerte', totals.safeAmount],
  ]);
  const closed = totals.open !== totals.turns;
  block('Resultado', [
    ['Diferencia de caja (sobra + / falta −)', totals.difference, closed ? (totals.difference === 0 ? 'ok' : 'bad') : 'strong'],
    ['Resultado', closed ? result(totals.difference) : 'Sigue abierta', closed ? (totals.difference === 0 ? 'ok' : 'bad') : 'strong'],
  ]);
  const foot = res.getCell(y, 1);
  foot.value = `Descargado por ${r.by} el ${formatDateTime(r.generatedAt, tz)} · Restaurant Control`;
  foot.font = { italic: true, size: 9, color: { argb: 'FF7A8194' } };

  // 2. Turnos: un renglón por concepto y una columna por turno, para leerlo de arriba abajo.
  const tw = wb.addWorksheet('Turnos', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] });
  tw.columns = [{ width: 30 }, ...r.shifts.map(() => ({ width: 26 }))];
  banner(tw, 1 + r.shifts.length, 'Cuadre de cada turno', sub);
  const th = tw.getRow(4);
  th.getCell(1).value = 'Concepto';
  r.shifts.forEach((s, i) => (th.getCell(2 + i).value = `Turno ${s.shift.dayNumber}`));
  th.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = HEAD_FILL;
    c.border = BOX;
    c.alignment = { vertical: 'middle', horizontal: c.col === '1' || (c.col as unknown) === 1 ? 'left' : 'right', indent: 1 };
  });
  th.height = 24;
  const diffs = r.shifts.map((s) => shiftDifference(s));
  const concept: [string, (s: (typeof r.shifts)[number], i: number) => string | number | null, ('money' | 'strong' | 'result')?][] = [
    ['Abrió', (s) => s.shift.openedBy],
    ['Cerró', (s) => s.shift.closedBy ?? '—'],
    ['Desde', (s) => formatTime(s.shift.openedAt, tz)],
    ['Hasta', (s) => (s.shift.closedAt ? formatDateTime(s.shift.closedAt, tz) : 'Sigue abierta')],
    ['Base', (s) => s.shift.openingAmount, 'strong'],
    ...METHODS.map((m): [string, (s: (typeof r.shifts)[number]) => number, 'money'] => [METHOD_LABEL[m], (s) => s.byMethod[m].amount, 'money']),
    ['Ventas', (s) => s.sales, 'strong'],
    ['Propinas cobradas', (s) => s.tips, 'money'],
    ['Entradas de efectivo', (s) => s.movementsIn, 'money'],
    ['Salidas de efectivo', (s) => s.movementsOut, 'money'],
    ['Debe haber al contar (con propina)', (s) => (s.tipToDeliver ? (s.shift.expectedCash ?? s.expectedCash) : null), 'money'],
    ['Propina para entregar', (s) => (s.tipToDeliver ? -s.tipToDeliver : null), 'money'],
    ['Efectivo de la venta (sin base)', (s) => s.salesCash, 'strong'],
    ['Total en la caja (venta + base)', (s) => s.shift.expectedCash ?? s.expectedCash, 'money'],
    ['Efectivo contado', (s) => s.shift.countedCash, 'strong'],
    ['Diferencia', (_s, i) => diffs[i], 'money'],
    ['Resultado', (_s, i) => result(diffs[i]), 'result'],
    ['Sobre para la cocina', (s) => s.shift.envelopeKitchen, 'money'],
    ['Sobre para el bar', (s) => s.shift.envelopeBar, 'money'],
    ['Caja fuerte', (s) => s.shift.safeAmount, 'money'],
    ['Observaciones', (s) => [s.shift.notes, s.shift.correctedAt ? `Corregido por ${s.shift.correctedBy}: ${s.shift.correctionReason}` : null].filter(Boolean).join(' · ') || '—'],
  ];
  concept.forEach(([label, get, kind], n) => {
    const row = tw.getRow(5 + n);
    const head = row.getCell(1);
    head.value = label;
    head.font = { bold: kind === 'strong' || kind === 'result' };
    head.alignment = { indent: 1, vertical: 'top' };
    r.shifts.forEach((s, i) => {
      const c = row.getCell(2 + i);
      c.value = get(s, i);
      c.alignment = { horizontal: label === 'Observaciones' ? 'left' : 'right', vertical: 'top', wrapText: true, indent: 1 };
      if (kind === 'money' || kind === 'strong') c.numFmt = MONEY;
      if (kind === 'strong' || kind === 'result') c.font = { bold: true };
      if (kind === 'result' && diffs[i] !== null) c.fill = diffs[i] === 0 ? OK_FILL : BAD_FILL;
    });
    for (let k = 1; k <= 1 + r.shifts.length; k++) {
      const c = row.getCell(k);
      c.border = BOX;
      if (!c.fill || (c.fill as ExcelJS.FillPattern).pattern !== 'solid') c.fill = kind === 'strong' ? TOTAL_FILL : n % 2 ? ZEBRA_FILL : fill('FFFFFFFF');
    }
  });

  // 3. Ventas por producto
  const productRows: (string | number)[][] = [];
  for (const c of r.categories) for (const p of c.products) productRows.push([c.category, p.name, p.quantity, p.total]);
  const vp = table(
    wb,
    'Ventas por producto',
    'Lo vendido por categoría y producto',
    sub,
    [
      { header: 'Categoría', width: 22 },
      { header: 'Producto', width: 34 },
      { header: 'Cantidad', width: 10 },
      { header: 'Total', width: 14, money: true },
    ],
    productRows,
    ['TOTAL', '', r.categories.reduce((s, c) => s + c.quantity, 0), r.categories.reduce((s, c) => s + c.total, 0)],
  );
  // Al lado, el resumen por categoría.
  vp.getColumn(6).width = 22;
  vp.getColumn(7).width = 10;
  vp.getColumn(8).width = 14;
  ['Categoría', 'Cantidad', 'Total'].forEach((h, i) => {
    const cell = vp.getCell(4, 6 + i);
    cell.border = BOX;
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEAD_FILL;
  });
  r.categories.forEach((c, i) => {
    vp.getCell(5 + i, 6).value = c.category;
    for (let k = 6; k <= 8; k++) vp.getCell(5 + i, k).border = BOX;
    vp.getCell(5 + i, 7).value = c.quantity;
    vp.getCell(5 + i, 8).value = c.total;
    vp.getCell(5 + i, 8).numFmt = MONEY;
  });

  // 4. Mesas cobradas
  table(
    wb,
    'Mesas cobradas',
    'Mesas cobradas en el día',
    sub,
    [
      { header: 'Mesa', width: 8 },
      { header: 'Zona', width: 14 },
      { header: 'Abrió', width: 10 },
      { header: 'Cerró', width: 10 },
      { header: 'Atendió', width: 26 },
      { header: 'Cobró', width: 16 },
      { header: 'Pago', width: 18 },
      { header: 'Cobrado', width: 14, money: true },
      { header: 'Propina', width: 12, money: true },
    ],
    r.tables.map((m) => [
      m.tableNumber,
      m.zone,
      formatTime(m.openedAt, tz),
      m.closedAt ? formatTime(m.closedAt, tz) : '',
      m.waiters.map((w) => w.name).join(', '),
      m.collectedBy.join(', '),
      m.methods.map((x) => METHOD_LABEL[x]).join(' + ') || 'Sin cobrar',
      m.paid,
      m.tip,
    ]),
    ['TOTAL', '', '', '', '', '', `${r.tables.length} mesas`, r.tables.reduce((s, m) => s + m.paid, 0), r.tables.reduce((s, m) => s + m.tip, 0)],
  );

  // 5. Gastos del día
  const out = [
    ...r.form.withInvoice.map((x) => ['Con factura', x.description, x.invoiceNumber, x.from, x.amount]),
    ...r.form.withoutInvoice.map((x) => ['Sin factura', x.reason ? `${x.description} (${x.reason})` : x.description, '', x.from, x.amount]),
  ];
  table(
    wb,
    'Gastos',
    'Salidas de dinero del día',
    sub,
    [
      { header: 'Tipo', width: 13 },
      { header: 'Descripción', width: 44 },
      { header: 'N.º factura', width: 14 },
      { header: 'De dónde salió', width: 16 },
      { header: 'Valor', width: 14, money: true },
    ],
    out,
    ['TOTAL', '', '', '', out.reduce((s, x) => s + Number(x[4]), 0)],
  );

  // 6. Facturas por pagar y pérdidas
  table(
    wb,
    'Por pagar',
    'Facturas por pagar (todas las pendientes)',
    sub,
    [
      { header: 'Proveedor', width: 24 },
      { header: 'Descripción', width: 40 },
      { header: 'Vence', width: 12 },
      { header: 'Valor', width: 14, money: true },
    ],
    r.form.toPay.map((x) => [x.supplier, x.description, x.dueOn ?? '', x.amount]),
    ['TOTAL', '', '', r.form.toPay.reduce((s, x) => s + x.amount, 0)],
  );
  table(
    wb,
    'Pérdidas',
    'Pérdidas del día',
    sub,
    [
      { header: 'Descripción', width: 50 },
      { header: 'Valor', width: 14, money: true },
    ],
    r.form.losses.map((x) => [x.description, x.amount]),
    ['TOTAL', r.form.losses.reduce((s, x) => s + x.amount, 0)],
  );

  // 7. Descuentos y mesas sin cobrar (sin anulaciones: pedido de Rigoberto)
  table(
    wb,
    'Descuentos',
    'Descuentos y mesas cerradas sin cobrar',
    sub,
    [
      { header: 'Qué', width: 20 },
      { header: 'Mesa', width: 14 },
      { header: 'Motivo', width: 44 },
      { header: 'Quién', width: 16 },
      { header: 'Valor', width: 14, money: true },
    ],
    [
      ...r.incidents.discounts.map((x) => ['Descuento', x.table, x.reason, x.by, x.amount]),
      ...r.incidents.closedUnpaid.map((x) => ['Cerrada sin cobrar', x.summary, x.reason, x.by, null]),
    ],
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}
