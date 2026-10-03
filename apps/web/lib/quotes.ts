// Cotizaciones: tipos y textos visibles.

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'changes_requested';
export const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  changes_requested: 'Pidió cambios',
};
export const STATUS_HUE: Record<QuoteStatus, number> = { draft: 250, sent: 200, accepted: 150, rejected: 20, changes_requested: 60 };

export type QuoteItem = { description: string; quantity: number; unitPrice: number; total: number };

export type Quote = {
  id: string;
  number: number;
  code: string;
  contactId: string | null;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  title: string;
  notes: string | null;
  discount: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  validUntil: string | null;
  status: QuoteStatus;
  expired: boolean;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  responseName: string | null;
  responseMessage: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
};
export type QuoteDetail = Quote & { author: string | null; can: { edit: boolean; delete: boolean } };
export type QuotesSummary = { open: number; openValue: number; accepted: number; acceptedValue: number; drafts: number };

export type PublicQuote = {
  code: string;
  title: string;
  company: { name: string; city: string | null; phone: string | null };
  clientName: string;
  clientCompany: string | null;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  notes: string | null;
  validUntil: string | null;
  sentAt: string | null;
  status: QuoteStatus;
  expired: boolean;
  respondedAt: string | null;
  responseName: string | null;
  responseMessage: string | null;
};

export const pesos = (n: number) => `$ ${new Intl.NumberFormat('es-CO').format(n)}`;
const longDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const dateText = (iso: string) => longDate.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));

/** Totales igual que la API: IVA sobre (subtotal − descuento), redondeado al peso. */
export function computeTotals(items: { quantity: number; unitPrice: number }[], discount: number, taxRate: number) {
  const subtotal = items.reduce((n, i) => n + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const base = Math.max(0, subtotal - (discount || 0));
  const tax = Math.round((base * taxRate) / 100);
  return { subtotal, tax, total: base + tax };
}
