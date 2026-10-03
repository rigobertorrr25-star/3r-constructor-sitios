export const TICKET_CATEGORIES = ['support', 'hr', 'maintenance', 'admin', 'accounting', 'purchases', 'other'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
/** Estados, en orden. `resolved` y `closed` ya no cuentan como pendientes. */
export const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress'];

export const CATEGORY_LABEL: Record<string, string> = {
  support: 'Soporte técnico',
  hr: 'Recursos humanos',
  maintenance: 'Mantenimiento',
  admin: 'Administración',
  accounting: 'Contabilidad',
  purchases: 'Compras',
  other: 'Otro',
};
export const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
export const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

/** Clave del módulo en el catálogo de la plataforma. */
export const TICKETS_MODULE = 'tickets';
