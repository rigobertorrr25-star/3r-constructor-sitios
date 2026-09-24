export const ORDER_STATUSES = ['new', 'awaiting_payment', 'in_progress', 'in_review', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Pedido recibido',
  awaiting_payment: 'Esperando pago',
  in_progress: 'En construcción',
  in_review: 'En revisión',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Sin pagar',
  partial: 'Pago parcial',
  paid: 'Pagado',
  refunded: 'Reembolsado',
};

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_LABELS: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quoted: 'Cotizado',
  won: 'Ganado',
  lost: 'Perdido',
};

/** El cliente solo puede cancelar mientras nadie ha empezado a trabajar. */
export const CLIENT_CANCELLABLE: readonly OrderStatus[] = ['new', 'awaiting_payment'];

/** Pedidos sin terminar que un mismo cliente puede tener a la vez (evita abusos). */
export const MAX_OPEN_ORDERS_PER_USER = 5;

/** El mismo formato que usa la web (lib/orders.ts): 3R-0001. */
export const orderCode = (orderNumber: number) => `3R-${String(orderNumber).padStart(4, '0')}`;
