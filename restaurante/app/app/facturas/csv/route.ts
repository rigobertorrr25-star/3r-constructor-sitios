import { requireStaff } from '@/lib/auth';
import { invoicesCsv, listInvoices } from '@/lib/invoices';
import { makeT, tr, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_COLUMN = 12;

/** Separa una línea del CSV (con «;» y comillas) en celdas. */
function splitLine(line: string) {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') cells.push(cur), (cur = '');
    else cur += c;
  }
  cells.push(cur);
  return cells;
}

const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** El CSV sale en español desde lib: en inglés se traducen los encabezados, el concepto y el estado. */
function translateCsv(csv: string, lang: Lang) {
  if (lang !== 'en') return csv;
  const bom = csv.startsWith('﻿') ? '﻿' : '';
  const lines = csv.slice(bom.length).split('\r\n');
  const out = lines.map((line, n) => {
    if (!line) return line;
    const cells = splitLine(line);
    if (n === 0) return cells.map((c) => cell(tr(lang, c))).join(';');
    cells[2] = tr(lang, cells[2]);
    cells[5] = tr(lang, cells[5]);
    if (cells[STATUS_COLUMN] !== undefined) cells[STATUS_COLUMN] = tr(lang, cells[STATUS_COLUMN]);
    return cells.map(cell).join(';');
  });
  return bom + out.join('\r\n');
}

/** Descarga las facturas del periodo para Excel (o para subirlas al proveedor). */
export async function GET(request: Request) {
  const staff = await requireStaff('invoices.manage');
  const lang = await getLang();
  const t = makeT(lang);
  const url = new URL(request.url);
  const from = url.searchParams.get('desde') ?? '';
  const to = url.searchParams.get('hasta') ?? '';
  if (!DATE.test(from) || !DATE.test(to) || from > to) return new Response(t('Fechas no válidas'), { status: 400 });
  const invoices = await listInvoices(staff, { from, to }, staff.timezone);
  const filename = lang === 'en' ? `invoices-${staff.businessSlug}-${from}-to-${to}.csv` : `facturas-${staff.businessSlug}-${from}-a-${to}.csv`;
  return new Response(translateCsv(invoicesCsv(invoices.filter((i) => i.status !== 'void'), staff.timezone), lang), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
