// El cierre completo del día en Excel (5 nov 2026, pedido de Rigoberto: «el documento lo quiero en Excel y que esté
// todo bien organizado»). Una hoja por parte, con títulos, totales y la plata con formato de pesos.
import ExcelJS from 'exceljs';
import { METHOD_LABEL, METHODS } from './cash';
import { dayTotals, shiftDifference } from './cash-day';
import { tipOfSales } from './closing-report';
import { formatDateTime, formatTime } from './format';
import type { DayReport } from './day-report';

const MONEY = '"$"#,##0;[Red]-"$"#,##0';
const HEAD_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A44' } };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF5' } };
const result = (d: number | null) => (d === null ? 'Sigue abierta' : d === 0 ? 'Cuadra' : d > 0 ? 'Sobra' : 'Falta');

type Col = { header: string; width: number; money?: boolean };

/** Una hoja con título, encabezados de color, filtros y la fila de arriba fija. */
function table(wb: ExcelJS.Workbook, name: string, title: string, cols: Col[], rows: (string | number | null)[][], totals?: (string | number | null)[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.columns = cols.map((c) => ({ width: c.width }));
  ws.mergeCells(1, 1, 1, cols.length);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14 };
  const head = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEAD_FILL;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  head.height = 22;
  if (!rows.length) ws.getCell(4, 1).value = 'Nada este día.';
  rows.forEach((r) => ws.addRow(r));
  if (totals && rows.length) {
    const row = ws.addRow(totals);
    row.font = { bold: true };
    row.eachCell((c) => (c.fill = TOTAL_FILL));
  }
  cols.forEach((c, i) => {
    if (c.money) ws.getColumn(i + 1).numFmt = MONEY;
  });
  if (rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: cols.length } };
  return ws;
}

export async function dayReportXlsx(r: DayReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Restaurant Control';
  const tz = r.timeZone;
  const totals = dayTotals(r.shifts);
  const place = `${r.business} · ${r.location}`;

  // 1. Resumen
  const res = wb.addWorksheet('Resumen');
  res.columns = [{ width: 36 }, { width: 20 }];
  res.getCell('A1').value = `Cierre del día ${r.date}`;
  res.getCell('A1').font = { bold: true, size: 16 };
  res.getCell('A2').value = place;
  res.getCell('A3').value = `Descargado por ${r.by} el ${formatDateTime(r.generatedAt, tz)}`;
  res.getCell('A3').font = { italic: true, color: { argb: 'FF666666' } };
  const lines: [string, number | string, boolean?][] = [
    ...METHODS.map((m): [string, number] => [`${METHOD_LABEL[m]} (${totals.byMethod[m].count} ${totals.byMethod[m].count === 1 ? "pago" : "pagos"})`, totals.byMethod[m].amount]),
    ['Ventas del día', totals.sales, true],
    ['Propinas cobradas', totals.tips, true],
    ['Descuentos', totals.discounts],
    ['Entradas de efectivo', totals.movementsIn],
    ['Salidas de efectivo', totals.movementsOut],
    ['Sobre para la cocina', totals.envelopeKitchen],
    ['Sobre para el bar', totals.envelopeBar],
    ['Caja fuerte', totals.safeAmount],
    ['Mesas cerradas', `${totals.tablesClosed}`],
    ['Diferencia de caja (sobra + / falta −)', totals.difference, true],
    ['Resultado', totals.open === totals.turns ? 'Sigue abierta' : result(totals.difference), true],
  ];
  lines.forEach(([label, value, strong], i) => {
    const row = res.getRow(5 + i);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    if (typeof value === 'number') row.getCell(2).numFmt = MONEY;
    else row.getCell(2).alignment = { horizontal: 'right' };
    if (strong) {
      row.font = { bold: true };
      row.getCell(1).fill = TOTAL_FILL;
      row.getCell(2).fill = TOTAL_FILL;
    }
  });

  // 2. Turnos
  table(
    wb,
    'Turnos',
    'Cuadre de cada turno',
    [
      { header: 'Turno', width: 8 },
      { header: 'Abrió', width: 16 },
      { header: 'Cerró', width: 16 },
      { header: 'Desde', width: 11 },
      { header: 'Hasta', width: 18 },
      { header: 'Base', width: 13, money: true },
      ...METHODS.map((m) => ({ header: METHOD_LABEL[m], width: 14, money: true })),
      { header: 'Ventas', width: 14, money: true },
      { header: 'Propinas cobradas', width: 13, money: true },
      { header: 'Entradas', width: 12, money: true },
      { header: 'Salidas', width: 12, money: true },
      { header: 'Efectivo esperado', width: 14, money: true },
      { header: 'Efectivo contado', width: 14, money: true },
      { header: 'Diferencia', width: 12, money: true },
      { header: 'Resultado', width: 12 },
      { header: 'Sobre cocina', width: 12, money: true },
      { header: 'Sobre bar', width: 12, money: true },
      { header: 'Caja fuerte', width: 12, money: true },
      { header: 'Observaciones', width: 40 },
    ],
    r.shifts.map((s) => {
      const diff = shiftDifference(s);
      const notes = [s.shift.notes, s.shift.correctedAt ? `Corregido por ${s.shift.correctedBy}: ${s.shift.correctionReason}` : null].filter(Boolean).join(' · ');
      return [
        s.shift.dayNumber,
        s.shift.openedBy,
        s.shift.closedBy ?? '',
        formatTime(s.shift.openedAt, tz),
        s.shift.closedAt ? formatDateTime(s.shift.closedAt, tz) : 'Sigue abierta',
        s.shift.openingAmount,
        ...METHODS.map((m) => s.byMethod[m].amount),
        s.sales,
        s.tips,
        s.movementsIn,
        s.movementsOut,
        s.shift.expectedCash ?? s.expectedCash,
        s.shift.countedCash,
        diff,
        result(diff),
        s.shift.envelopeKitchen,
        s.shift.envelopeBar,
        s.shift.safeAmount,
        notes,
      ];
    }),
  );

  // 3. Ventas por producto
  const productRows: (string | number)[][] = [];
  for (const c of r.categories) for (const p of c.products) productRows.push([c.category, p.name, p.quantity, p.total]);
  const vp = table(
    wb,
    'Ventas por producto',
    'Lo vendido por categoría y producto',
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
    const cell = vp.getCell(3, 6 + i);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEAD_FILL;
  });
  r.categories.forEach((c, i) => {
    vp.getCell(4 + i, 6).value = c.category;
    vp.getCell(4 + i, 7).value = c.quantity;
    vp.getCell(4 + i, 8).value = c.total;
    vp.getCell(4 + i, 8).numFmt = MONEY;
  });

  // 4. Mesas cobradas
  table(
    wb,
    'Mesas cobradas',
    'Mesas cobradas en el día',
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
