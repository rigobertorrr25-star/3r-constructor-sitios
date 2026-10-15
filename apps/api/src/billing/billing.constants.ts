/** Nombres de los módulos para las facturas (iguales a los de la web, lib/companies.ts → MODULE_INFO). */
export const MODULE_NAME: Record<string, string> = {
  web: 'Página web',
  store: 'Tienda en línea',
  analytics: 'Analítica web',
  seo: 'SEO',
  employees: 'Portal del empleado',
  requests: 'Permisos y vacaciones',
  announcements: 'Comunicados',
  documents: 'Documentos',
  doc_generator: 'Generador de documentos',
  tickets: 'Tickets',
  calendar: 'Calendario',
  surveys: 'Encuestas',
  training: 'Capacitaciones',
  knowledge: 'Centro de conocimiento',
  inventory: 'Inventario',
  crm: 'CRM',
  quotes: 'Cotizaciones',
  marketing: 'Marketing',
  whatsapp: 'WhatsApp empresarial',
  alerts: 'Alertas',
  automations: 'Automatizaciones',
  ai_assistant: 'Asistente con IA',
  ai_content: 'Textos con IA',
};
export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'cancelled'] as const;
/** Días para pagar después de generada la factura. */
export const DUE_DAYS = 10;
export const invoiceCode = (n: number) => `FAC-${n}`;
