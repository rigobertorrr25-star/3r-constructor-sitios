// Módulo 10: factura electrónica. Todo lo que no depende del proveedor tecnológico ya funciona: datos fiscales,
// cálculo del impuesto (incluido en los precios), una factura por cada venta cobrada y exportación para el contador.
// El envío a la DIAN se hace por un proveedor (Alegra, Siigo, etc.); mientras no haya uno conectado, quedan "pendientes".
import { query, transaction, type Db } from './db';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export const TAX_KINDS = { inc: { label: 'Impuesto al consumo 8 % (restaurantes y bares)', rate: 8 }, iva: { label: 'IVA 19 %', rate: 19 }, none: { label: 'No responsable de impuestos', rate: 0 } } as const;
export type TaxKind = keyof typeof TAX_KINDS;
export const DOC_TYPES = { CC: 'Cédula', NIT: 'NIT', CE: 'Cédula de extranjería', PP: 'Pasaporte' } as const;
export const INVOICE_STATUS = { pending: 'Pendiente (sin enviar a la DIAN)', sent: 'Enviada', accepted: 'Aceptada por la DIAN', rejected: 'Rechazada', void: 'Anulada (se reversó el pago)' } as const;
/** Documento con el que la DIAN identifica al consumidor final. */
export const FINAL_CONSUMER = { docType: 'CC', docNumber: '222222222222', name: 'Consumidor final' } as const;

/** Precio con impuesto incluido → base e impuesto. $108.000 con impoconsumo 8 % → base $100.000 + $8.000. */
export function splitTax(total: number, rate: number) {
  const base = rate ? Math.round(total / (1 + rate / 100)) : total;
  return { base, tax: total - base };
}

function requireText(value: string, label: string, min: number, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

// ───────── datos fiscales ─────────

export type Fiscal = { legalName: string | null; taxId: string | null; taxKind: TaxKind; resolution: string | null; provider: string };

export async function getFiscal(businessId: string): Promise<Fiscal> {
  const r = (
    await query<Fiscal>(
      `SELECT legal_name AS "legalName", tax_id AS "taxId", tax_kind AS "taxKind", invoice_resolution AS resolution, invoice_provider AS provider FROM businesses WHERE id = $1`,
      [businessId],
    )
  )[0];
  return r;
}

export async function saveFiscal(actor: Actor, input: { legalName: string; taxId: string; taxKind: string; resolution?: string }) {
  requirePermission(actor, 'locations.manage');
  const legalName = requireText(input.legalName, 'Razón social o nombre', 3, 160);
  const taxId = input.taxId.replace(/[^\d-]/g, '');
  if (!/^\d{5,12}(-\d)?$/.test(taxId)) throw new AppError('INVALID', 'NIT o cédula: solo números (y el dígito de verificación con guion).');
  if (!(input.taxKind in TAX_KINDS)) throw new AppError('INVALID', 'Elige el impuesto.');
  const resolution = input.resolution?.trim() ? requireText(input.resolution, 'Resolución', 5, 200) : null;
  await transaction(async (db) => {
    await db.query(`UPDATE businesses SET legal_name = $2, tax_id = $3, tax_kind = $4, invoice_resolution = $5 WHERE id = $1`, [actor.businessId, legalName, taxId, input.taxKind, resolution]);
    await audit(db, actor, { action: 'invoice.settings', entity: 'business', entityId: actor.businessId, summary: `Cambió los datos de facturación (${TAX_KINDS[input.taxKind as TaxKind].label})` });
  });
}

// ───────── facturas ─────────

/** Crea la factura de una venta recién pagada (dentro de la misma transacción del cobro). Total sin propina. */
export async function createInvoice(db: Db, actor: Pick<Actor, 'businessId' | 'locationId'>, target: { sessionId?: string; appointmentId?: string; total: number; tip: number }) {
  const b = (await db.query<{ taxKind: TaxKind }>(`SELECT tax_kind AS "taxKind" FROM businesses WHERE id = $1 FOR UPDATE`, [actor.businessId])).rows[0];
  const rate = TAX_KINDS[b.taxKind].rate;
  const { base, tax } = splitTax(target.total, rate);
  const seq = (await db.query<{ n: number }>(`SELECT COALESCE(max(sequence), 0) + 1 AS n FROM invoices WHERE business_id = $1`, [actor.businessId])).rows[0].n;
  await db.query(
    `INSERT INTO invoices (business_id, location_id, sequence, session_id, appointment_id, total, tax_kind, tax_rate, base, tax, tip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
    [actor.businessId, actor.locationId, seq, target.sessionId ?? null, target.appointmentId ?? null, target.total, b.taxKind, rate, base, tax, target.tip],
  );
}

export type Invoice = {
  id: string;
  sequence: number;
  createdAt: Date;
  docType: string;
  docNumber: string;
  customerName: string;
  customerEmail: string | null;
  total: number;
  base: number;
  tax: number;
  taxRate: number;
  tip: number;
  status: keyof typeof INVOICE_STATUS;
  number: string | null;
  concept: string;
  sessionId: string | null;
};

const INV_SELECT = `SELECT i.id, i.sequence, i.created_at AS "createdAt", i.doc_type AS "docType", i.doc_number AS "docNumber", i.customer_name AS "customerName",
       i.customer_email AS "customerEmail", i.total, i.base, i.tax, i.tax_rate AS "taxRate", i.tip, i.status, i.number, i.session_id AS "sessionId",
       COALESCE('Mesa ' || t.number, sv.name) AS concept
  FROM invoices i
  LEFT JOIN table_sessions ts ON ts.id = i.session_id LEFT JOIN dining_tables t ON t.id = ts.table_id
  LEFT JOIN appointments a ON a.id = i.appointment_id LEFT JOIN services sv ON sv.id = a.service_id`;

type InvRow = Omit<Invoice, 'total' | 'base' | 'tax' | 'tip'> & { total: string; base: string; tax: string; tip: string };
const toInv = (r: InvRow): Invoice => ({ ...r, total: Number(r.total), base: Number(r.base), tax: Number(r.tax), tip: Number(r.tip) });

export async function listInvoices(actor: Actor, range: { from: string; to: string; status?: string }, timeZone: string) {
  requirePermission(actor, 'invoices.manage');
  const rows = await query<InvRow>(
    `${INV_SELECT}
      WHERE i.business_id = $1 AND i.location_id = $2 AND ($6::varchar IS NULL OR i.status = $6)
        AND i.created_at >= ($3::date)::timestamp AT TIME ZONE $5 AND i.created_at < ($4::date + 1)::timestamp AT TIME ZONE $5
      ORDER BY i.sequence DESC`,
    [actor.businessId, actor.locationId, range.from, range.to, timeZone, range.status || null],
  );
  return rows.map(toInv);
}

export async function invoiceForSession(actor: Actor, sessionId: string) {
  if (!isUuid(sessionId)) return null;
  const rows = await query<InvRow>(`${INV_SELECT} WHERE i.session_id = $1 AND i.business_id = $2 AND i.status <> 'void'`, [sessionId, actor.businessId]);
  return rows[0] ? toInv(rows[0]) : null;
}

/** Datos del cliente para la factura (si pide factura a su nombre). Solo mientras no se haya enviado. */
export async function setInvoiceCustomer(actor: Actor, invoiceId: string, input: { docType: string; docNumber: string; name: string; email?: string }) {
  requirePermission(actor, 'invoices.manage');
  if (!isUuid(invoiceId)) throw new AppError('NOT_FOUND', 'No encontramos esa factura.');
  if (!(input.docType in DOC_TYPES)) throw new AppError('INVALID', 'Elige el tipo de documento.');
  const docNumber = input.docNumber.replace(/[^\dA-Za-z-]/g, '');
  if (docNumber.length < 5 || docNumber.length > 20) throw new AppError('INVALID', 'Número de documento no válido.');
  const name = requireText(input.name, 'Nombre o razón social', 3, 160);
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('INVALID', 'Correo no válido (la DIAN envía la factura ahí).');
  await transaction(async (db) => {
    const res = await db.query<{ sequence: number }>(
      `UPDATE invoices SET doc_type = $3, doc_number = $4, customer_name = $5, customer_email = $6
        WHERE id = $1 AND business_id = $2 AND status IN ('pending', 'rejected') RETURNING sequence`,
      [invoiceId, actor.businessId, input.docType, docNumber, name, email],
    );
    if (!res.rows[0]) throw new AppError('CONFLICT', 'Esa factura ya se envió: no se puede cambiar.');
    await audit(db, actor, { action: 'invoice.customer', entity: 'invoice', entityId: invoiceId, summary: `Puso la venta #${res.rows[0].sequence} a nombre de ${name} (${input.docType} ${docNumber})` });
  });
}

/** CSV (separado por punto y coma, para Excel en español) de las facturas del periodo, para el contador o el proveedor. */
export function invoicesCsv(invoices: Invoice[], timeZone: string) {
  const head = ['Venta', 'Fecha', 'Concepto', 'Tipo doc', 'Documento', 'Cliente', 'Correo', 'Base', 'Impuesto %', 'Impuesto', 'Total', 'Propina (no gravada)', 'Estado', 'Número DIAN'];
  const fmt = new Intl.DateTimeFormat('es-CO', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = invoices.map((i) =>
    [i.sequence, fmt.format(new Date(i.createdAt)), i.concept, i.docType, i.docNumber, i.customerName, i.customerEmail, i.base, i.taxRate, i.tax, i.total, i.tip, INVOICE_STATUS[i.status], i.number].map(cell).join(';'),
  );
  return `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}

/**
 * Al reversar un pago que cerró la venta: la factura sin enviar se anula (queda de rastro) y al volver a cobrar sale
 * otra. Si ya se había enviado a la DIAN, no se toca: hace falta una nota crédito en el proveedor. Devuelve si fue así.
 */
export async function voidInvoiceFor(db: Db, target: { sessionId?: string | null; appointmentId?: string | null }) {
  const res = await db.query<{ status: string }>(
    `UPDATE invoices SET status = CASE WHEN status IN ('pending', 'rejected') THEN 'void' ELSE status END
      WHERE status <> 'void' AND (($1::uuid IS NOT NULL AND session_id = $1) OR ($2::uuid IS NOT NULL AND appointment_id = $2))
      RETURNING status`,
    [target.sessionId ?? null, target.appointmentId ?? null],
  );
  return res.rows.some((r) => r.status !== 'void');
}
