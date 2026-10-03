// Módulo CRM: tipos y textos visibles.

export const CRM_STAGES = ['lead', 'contacted', 'quote', 'negotiation', 'won', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const STAGE_LABEL: Record<CrmStage, string> = {
  lead: 'Nuevo',
  contacted: 'Contactado',
  quote: 'Cotización',
  negotiation: 'Negociación',
  won: 'Ganado',
  lost: 'Perdido',
};

/** Tono de cada etapa (oklch hue), igual que los íconos de la portada. */
export const STAGE_HUE: Record<CrmStage, number> = { lead: 275, contacted: 200, quote: 88, negotiation: 25, won: 150, lost: 0 };

export const SOURCE_LABEL: Record<string, string> = {
  manual: 'Lo agregué yo',
  web: 'Página web',
  whatsapp: 'WhatsApp',
  referral: 'Recomendación',
  social: 'Redes sociales',
  other: 'Otro',
};

export const ACTIVITY_LABEL: Record<string, string> = {
  note: 'Nota',
  call: 'Llamada',
  email: 'Correo',
  whatsapp: 'WhatsApp',
  meeting: 'Reunión',
  stage: 'Cambio de etapa',
};

export type CrmContact = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  stage: CrmStage;
  valueCents: number | null;
  source: string;
  notes: string | null;
  ownerMemberId: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmActivity = { id: string; kind: string; body: string; createdAt: string; author: string | null };
export type CrmContactDetail = CrmContact & { activities: CrmActivity[] };

export type CrmSummary = {
  stages: { stage: CrmStage; count: number; valueCents: number }[];
  total: number;
  openCount: number;
  openValueCents: number;
  wonValueCents: number;
};

/** "2.500.000" o "$ 2,500,000" → 2500000. Vacío → null. */
export const parsePesos = (input: string): number | null => {
  const digits = input.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
};
