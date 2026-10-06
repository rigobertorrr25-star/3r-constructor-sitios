// Tickets para impresoras térmicas (ESC/POS, el idioma de casi todas las impresoras de 80 y 58 mm).
// Cada documento sale en dos versiones: los bytes que van a la impresora y un texto plano para verlo en la pantalla.

const ESC = 0x1b;
const GS = 0x1d;

// Página de códigos PC850 (ESC t 2): la que traen casi todas las impresoras genéricas y tiene tildes y eñes.
const CP850: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9,
  ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a, '¿': 0xa8, '¡': 0xad, '°': 0xf8, '·': 0xfa,
};

/** Cambia lo que la impresora no sabe dibujar por algo parecido. */
export function plain(text: string) {
  return text
    .replace(/[   ]/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/→/g, '->')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[\r\n\t]+/g, ' ');
}

function encode(text: string): number[] {
  const out: number[] = [];
  for (const ch of plain(text)) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code < 0x7f) out.push(code);
    else if (CP850[ch] !== undefined) out.push(CP850[ch]);
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out.push(base.length === 1 && base.charCodeAt(0) < 0x7f ? base.charCodeAt(0) : 0x3f);
    }
  }
  return out;
}

/** Parte un texto en renglones de `width` letras sin cortar palabras (salvo que una sola no quepa). */
export function wrap(text: string, width: number): string[] {
  const words = plain(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let word of words) {
    while (word.length > width) {
      if (line) (lines.push(line), (line = ''));
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else (lines.push(line), (line = word));
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

type Align = 'left' | 'center' | 'right';

export class Ticket {
  private bytes: number[] = [ESC, 0x40, ESC, 0x74, 0x02];
  private text: string[] = [];

  /** `width`: letras por renglón (48 en papel de 80 mm, 32 en papel de 58 mm). */
  constructor(readonly width: number) {}

  private align(a: Align) {
    this.bytes.push(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
  }

  private style(bold: boolean, big: boolean) {
    this.bytes.push(ESC, 0x45, bold ? 1 : 0, GS, 0x21, big ? 0x11 : 0x00);
  }

  /** Un texto (se parte en renglones). `big` lo imprime al doble de alto y de ancho. */
  line(text: string, opts: { align?: Align; bold?: boolean; big?: boolean } = {}) {
    const align = opts.align ?? 'left';
    const cols = opts.big ? Math.floor(this.width / 2) : this.width;
    this.align(align);
    this.style(!!opts.bold || !!opts.big, !!opts.big);
    for (const l of wrap(text, cols)) {
      this.bytes.push(...encode(l), 0x0a);
      const shown = opts.big ? l.toUpperCase() : l;
      const pad = align === 'center' ? Math.max(0, Math.floor((this.width - shown.length) / 2)) : align === 'right' ? Math.max(0, this.width - shown.length) : 0;
      this.text.push(' '.repeat(pad) + shown);
    }
    this.style(false, false);
    this.align('left');
    return this;
  }

  /** Texto a la izquierda y valor a la derecha en el mismo renglón (si no cabe, el texto sigue abajo). */
  row(left: string, right: string, opts: { bold?: boolean } = {}) {
    const r = plain(right);
    const room = Math.max(4, this.width - r.length - 1);
    const lines = wrap(left, room);
    this.style(!!opts.bold, false);
    lines.forEach((l, i) => {
      const s = i === lines.length - 1 ? l + ' '.repeat(Math.max(1, this.width - l.length - r.length)) + r : l;
      this.bytes.push(...encode(s), 0x0a);
      this.text.push(s);
    });
    this.style(false, false);
    return this;
  }

  rule(char = '-') {
    const s = char.repeat(this.width);
    this.bytes.push(...encode(s), 0x0a);
    this.text.push(s);
    return this;
  }

  blank(n = 1) {
    for (let i = 0; i < n; i++) (this.bytes.push(0x0a), this.text.push(''));
    return this;
  }

  /** Avanza el papel y lo corta (las impresoras sin cuchilla ignoran el corte). */
  finish(copies = 1) {
    const one = [...this.bytes, ESC, 0x64, 0x04, GS, 0x56, 0x42, 0x03];
    const data: number[] = [];
    for (let i = 0; i < Math.max(1, copies); i++) data.push(...one);
    return { data: Buffer.from(data), preview: this.text.join('\n') };
  }
}

// ───────── documentos ─────────

const STATION_TITLE = { kitchen: 'Cocina', bar: 'Barra' } as const;

export type ComandaInput = {
  station: 'kitchen' | 'bar';
  table: string;
  zone: string;
  round: number;
  sentBy: string;
  time: string;
  items: { quantity: number; name: string; notes: string | null }[];
};

export function comanda(width: number, c: ComandaInput) {
  const t = new Ticket(width)
    .line(STATION_TITLE[c.station], { align: 'center', big: true })
    .line(`Mesa ${c.table}`, { align: 'center', big: true })
    .line(`${c.zone} · Ronda ${c.round}`, { align: 'center' })
    .line(`${c.sentBy} · ${c.time}`, { align: 'center' })
    .rule();
  for (const item of c.items) {
    t.line(`${item.quantity} x ${item.name}`, { big: true });
    if (item.notes) t.line(`  >> ${item.notes}`, { bold: true });
  }
  return t.rule();
}

export type AnulacionInput = { station: 'kitchen' | 'bar'; table: string; quantity: number; name: string; reason: string; by: string; time: string };

export function anulacion(width: number, a: AnulacionInput) {
  return new Ticket(width)
    .line('** ANULADO **', { align: 'center', big: true })
    .line(`${STATION_TITLE[a.station]} · Mesa ${a.table}`, { align: 'center', big: true })
    .rule()
    .line(`${a.quantity} x ${a.name}`, { big: true })
    .line(`Motivo: ${a.reason}`)
    .line(`Anuló: ${a.by} · ${a.time}`)
    .rule();
}

export type PrecuentaInput = {
  business: string;
  location: string | null;
  table: string;
  guests: number;
  waiter: string;
  time: string;
  lines: { quantity: number; name: string; total: string }[];
  subtotal: string;
  discounts: string | null;
  total: string;
  paid: string | null;
  balance: string | null;
  tip: { percent: number; amount: string; withTip: string } | null;
};

export function precuenta(width: number, p: PrecuentaInput) {
  const t = new Ticket(width).line(p.business, { align: 'center', bold: true });
  if (p.location) t.line(p.location, { align: 'center' });
  t.line(`PRECUENTA · Mesa ${p.table}`, { align: 'center', bold: true })
    .line(`${p.time} · ${p.guests} ${p.guests === 1 ? 'persona' : 'personas'}`, { align: 'center' })
    .line(`Atendió: ${p.waiter}`, { align: 'center' })
    .rule();
  for (const l of p.lines) t.row(`${l.quantity} ${l.name}`, l.total);
  t.rule().row('Subtotal', p.subtotal);
  if (p.discounts) t.row('Descuentos', `-${p.discounts}`);
  t.row('TOTAL', p.total, { bold: true });
  if (p.paid) t.row('Abonado', p.paid);
  if (p.balance) t.row('Falta por pagar', p.balance, { bold: true });
  if (p.tip) t.row(`Propina sugerida (${p.tip.percent} %)`, p.tip.amount).row('Total con propina', p.tip.withTip, { bold: true });
  return t.rule().line('La propina es voluntaria.', { align: 'center' }).line('Este documento no es una factura.', { align: 'center' });
}

export type CierreInput = {
  business: string;
  location: string | null;
  openedBy: string;
  openedAt: string;
  closedBy: string;
  closedAt: string;
  opening: string;
  methods: { label: string; amount: string; count: number }[];
  sales: string;
  tips: string;
  discounts: string;
  voids: string;
  movementsIn: string;
  movementsOut: string;
  expected: string;
  counted: string;
  result: string;
  tables: number;
  notes: string | null;
};

export function cierre(width: number, c: CierreInput) {
  const t = new Ticket(width).line(c.business, { align: 'center', bold: true });
  if (c.location) t.line(c.location, { align: 'center' });
  t.line('CIERRE DE CAJA', { align: 'center', big: true })
    .line(`Abrió: ${c.openedBy} · ${c.openedAt}`)
    .line(`Cerró: ${c.closedBy} · ${c.closedAt}`)
    .rule()
    .row('Base', c.opening);
  for (const m of c.methods) t.row(`${m.label} (${m.count})`, m.amount);
  t.row('Ventas', c.sales, { bold: true })
    .row('Propinas', c.tips)
    .row('Descuentos', c.discounts)
    .row('Anulaciones', c.voids)
    .row('Entradas de efectivo', c.movementsIn)
    .row('Salidas de efectivo', c.movementsOut)
    .rule()
    .row('Efectivo esperado', c.expected)
    .row('Efectivo contado', c.counted, { bold: true })
    .line(c.result, { align: 'center', big: true })
    .line(`${c.tables} ${c.tables === 1 ? 'mesa cerrada' : 'mesas cerradas'}`, { align: 'center' });
  if (c.notes) t.line(`Nota: ${c.notes}`);
  return t.rule().blank().line('Firma: ______________________');
}

export function prueba(width: number, p: { business: string; printer: string; address: string; time: string; jobs: string[] }) {
  return new Ticket(width)
    .line('Prueba de impresión', { align: 'center', big: true })
    .line(p.business, { align: 'center' })
    .rule()
    .row('Impresora', p.printer)
    .row('Dirección', p.address)
    .row('Imprime', p.jobs.join(', ') || 'nada todavía')
    .row('Hora', p.time)
    .rule()
    .line('Tildes y eñes: áéíóú ÁÉÍÓÚ ñÑ ¿¡')
    .line('Si lees esto bien, la impresora quedó lista.', { align: 'center', bold: true })
    .rule();
}
