/** Etapas del embudo, en orden. `won` y `lost` cierran el negocio. */
export const CRM_STAGES = ['lead', 'contacted', 'quote', 'negotiation', 'won', 'lost'] as const;
export const CRM_SOURCES = ['manual', 'web', 'whatsapp', 'referral', 'social', 'other'] as const;
/** Lo que se registra a mano en el historial (los cambios de etapa se registran solos como `stage`). */
export const CRM_ACTIVITY_KINDS = ['note', 'call', 'email', 'whatsapp', 'meeting'] as const;

export const STAGE_LABEL: Record<string, string> = {
  lead: 'Nuevo',
  contacted: 'Contactado',
  quote: 'Cotización',
  negotiation: 'Negociación',
  won: 'Ganado',
  lost: 'Perdido',
};

/** Clave del módulo en el catálogo de la plataforma. */
export const CRM_MODULE = 'crm';
