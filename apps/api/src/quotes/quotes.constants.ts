export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'changes_requested'] as const;
export const TAX_RATES = [0, 5, 19] as const;
export const MAX_ITEMS = 50;
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  changes_requested: 'Pidió cambios',
};
/** Clave del módulo en el catálogo de la plataforma. */
export const QUOTES_MODULE = 'quotes';
export const quoteCode = (n: number) => `COT-${n}`;
