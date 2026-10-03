/** Clave del módulo en el catálogo de la plataforma. */
export const AUTOMATIONS_MODULE = 'automations';

/** Lo que puede disparar una automatización, con los datos que trae (para usarlos en los mensajes como {campo}). */
export const TRIGGERS = {
  store_order: {
    label: 'Entra un pedido en la tienda',
    amount: true,
    vars: ['numero', 'cliente', 'celular', 'correo', 'total', 'entrega', 'productos'],
  },
  site_contact: { label: 'Alguien escribe por el formulario de la página', amount: false, vars: ['cliente', 'correo', 'celular', 'mensaje'] },
  quote_accepted: { label: 'Un cliente acepta una cotización', amount: true, vars: ['numero', 'cliente', 'correo', 'celular', 'total', 'titulo'] },
  quote_rejected: {
    label: 'Un cliente rechaza una cotización',
    amount: true,
    vars: ['numero', 'cliente', 'correo', 'celular', 'total', 'titulo', 'mensaje'],
  },
  ticket_created: { label: 'Se crea un ticket', amount: false, vars: ['numero', 'titulo', 'prioridad', 'quien'] },
  low_stock: { label: 'Un producto del inventario queda bajo el mínimo', amount: false, vars: ['producto', 'cantidad', 'minimo'] },
} as const;
export type TriggerKey = keyof typeof TRIGGERS;
export const TRIGGER_KEYS = Object.keys(TRIGGERS) as TriggerKey[];

export const ACTION_TYPES = ['notify', 'email', 'crm_contact', 'ticket'] as const;
export const NOTIFY_TO = ['supervisors', 'admins', 'everyone'] as const;
/** Tope de correos que mandan las automatizaciones de una empresa por día (evita abusos). */
export const MAX_EMAILS_PER_DAY = 200;
export const MAX_AUTOMATIONS = 50;
