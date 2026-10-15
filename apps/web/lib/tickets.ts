// Módulo de tickets: tipos y textos visibles.

export const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export const CATEGORY_LABEL: Record<string, string> = {
  support: 'Soporte técnico',
  hr: 'Recursos humanos',
  maintenance: 'Mantenimiento',
  admin: 'Administración',
  accounting: 'Contabilidad',
  purchases: 'Compras',
  other: 'Otro',
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
/** Tono de cada prioridad (oklch hue). */
export const PRIORITY_HUE: Record<TicketPriority, number> = { low: 200, medium: 275, high: 60, urgent: 20 };

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

/** Texto del botón para pasar a cada estado (lo que ve quien lo cambia). */
export const STATUS_ACTION: Record<TicketStatus, string> = {
  open: 'Abrir de nuevo',
  assigned: 'Asignado',
  in_progress: 'Empezar a trabajarlo',
  resolved: 'Marcar resuelto',
  closed: 'Cerrar',
};

export const EVENT_LABEL: Record<string, string> = { comment: 'Comentario', status: 'Estado', assign: 'Responsable', priority: 'Prioridad' };

export type Ticket = {
  id: string;
  number: number;
  title: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requesterMemberId: string | null;
  assigneeMemberId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketEvent = { id: string; kind: string; body: string; createdAt: string; author: string | null };
export type TicketDetail = Ticket & {
  description: string;
  events: TicketEvent[];
  can: { manage: boolean; statuses: TicketStatus[]; comment: boolean; delete: boolean };
};

export type TicketSummary = {
  byStatus: Record<TicketStatus, number>;
  active: number;
  urgent: number;
  unassigned: number;
  mine: number;
  resolved30d: number;
  avgResolutionHours: number | null;
};

/** 0,2 → "Menos de 1 h", 5 → "5 h", 30 → "1,3 días". */
export const formatHours = (h: number | null) => {
  if (h == null) return '—';
  if (h < 1) return 'Menos de 1 h';
  const n = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
  return h < 24 ? `${n.format(h)} h` : `${n.format(h / 24)} días`;
};
