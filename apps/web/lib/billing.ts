// Suscripciones: plan y facturas de la plataforma empresarial.

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';
export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'En prueba',
  active: 'Activa',
  past_due: 'Con pagos atrasados',
  cancelled: 'Cancelada',
};
export const INVOICE_LABEL: Record<string, string> = { pending: 'Pendiente', paid: 'Pagada', void: 'Anulada' };
export const METHOD_LABEL: Record<string, string> = { transfer: 'Transferencia', wompi: 'En línea (Wompi)', other: 'Otro' };

export type Invoice = {
  id: string;
  code: string;
  periodStart: string;
  periodEnd: string;
  items: { key: string; name: string; price: number }[];
  total: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'void';
  overdue: boolean;
  paidAt: string | null;
  method: string | null;
  paymentNote: string | null;
  createdAt: string;
};

export type BillingOverview = {
  subscription: { status: SubscriptionStatus; trialEndsAt: string | null; billingDay: number; notes?: string | null } | null;
  plan: { items: { key: string; name: string; price: number }[]; unpriced: string[]; total: number };
  invoices: Invoice[];
  onlinePayment: boolean;
};

export type ModulePrice = { key: string; area: string; ready: boolean; name: string; monthlyPrice: number | null };

const longDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dateText = (iso: string) => longDate.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
export const pesos = (n: number) => `$ ${new Intl.NumberFormat('es-CO').format(n)}`;
