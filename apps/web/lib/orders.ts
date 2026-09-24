import type { LeadStatus, OrderStatus, PaymentStatus } from './types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Pedido recibido',
  awaiting_payment: 'Esperando el pago',
  in_progress: 'Página en proceso',
  in_review: 'Últimos detalles',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

/** El embudo de mensajes de contacto: en qué va cada visitante que escribió. */
export const LEAD_STAGES: LeadStatus[] = ['new', 'contacted', 'quoted', 'won', 'lost'];

export const LEAD_LABEL: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quoted: 'Cotizado',
  won: 'Ganado',
  lost: 'Perdido',
};

export const LEAD_DOT: Record<LeadStatus, string> = {
  new: 'bg-[#8a9bff]',
  contacted: 'bg-[#f7cb58]',
  quoted: 'bg-[#d6b0ff]',
  won: 'bg-[#5ee0a0]',
  lost: 'bg-[#a5abb5]',
};

/** Una frase de seguimiento (como un envío) para el estado actual del pedido. */
export const STATUS_DESCRIPTION: Record<OrderStatus, string> = {
  new: 'Recibimos tu pedido y ya lo estamos organizando.',
  awaiting_payment: 'Todo listo para empezar en cuanto se confirme el pago.',
  in_progress: 'Estamos construyendo tu página, paso a paso.',
  in_review: 'Ya casi terminamos: estamos afinando los últimos detalles.',
  delivered: '¡Tu página está lista y entregada!',
  cancelled: 'Este pedido fue cancelado.',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Sin pagar',
  partial: 'Pago parcial',
  paid: 'Pagado',
  refunded: 'Reembolsado',
};

/** Color (punto) de cada estado, coherente en todo el sitio. */
export const STATUS_DOT: Record<OrderStatus, string> = {
  new: 'bg-[#8a9bff]',
  awaiting_payment: 'bg-[#f7cb58]',
  in_progress: 'bg-[#d6b0ff]',
  in_review: 'bg-[#ff86db]',
  delivered: 'bg-[#5ee0a0]',
  cancelled: 'bg-[#a5abb5]',
};

export const PAYMENT_DOT: Record<PaymentStatus, string> = {
  unpaid: 'bg-[#f7cb58]',
  partial: 'bg-[#ff9479]',
  paid: 'bg-[#5ee0a0]',
  refunded: 'bg-[#a5abb5]',
};

/** Pasos del avance que ve el cliente (cancelado se muestra aparte). */
export const PROGRESS_STEPS: OrderStatus[] = ['new', 'awaiting_payment', 'in_progress', 'in_review', 'delivered'];

export const orderCode = (orderNumber: number) => `3R-${String(orderNumber).padStart(4, '0')}`;

// es-US escribe el dólar como "$199" y es-CO el peso como "$ 350.000" (con 'es' a secas sale "199 US$" / "350.000 COP").
const MONEY_LOCALE: Record<string, string> = { USD: 'es-US', COP: 'es-CO' };

export function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat(MONEY_LOCALE[currency] ?? 'es', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "199" o "199.50" (lo que escribe una persona) → centavos. */
export function toCents(input: string): number | null {
  const value = Number(input.replace(',', '.').trim());
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

export const fromCents = (cents: number | null | undefined) => (cents === null || cents === undefined ? '' : String(cents / 100));

const dateFmt = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
