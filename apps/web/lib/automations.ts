// Automatizaciones: tipos y textos visibles.

export type ActionType = 'notify' | 'email' | 'crm_contact' | 'ticket';
export const ACTION_LABEL: Record<ActionType, string> = {
  notify: 'Avisar al equipo (campanita)',
  email: 'Mandar un correo',
  crm_contact: 'Guardar a la persona en el CRM',
  ticket: 'Crear un ticket',
};
/** Para la línea de resumen: «si … → avisar al equipo, guardar en el CRM». */
export const ACTION_SHORT: Record<ActionType, string> = {
  notify: 'avisar al equipo',
  email: 'mandar un correo',
  crm_contact: 'guardar en el CRM',
  ticket: 'crear un ticket',
};
export const NOTIFY_LABEL: Record<string, string> = {
  supervisors: 'Supervisores en adelante',
  admins: 'Administradores',
  everyone: 'Todo el equipo',
};
export const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

export type AutomationAction = { type: ActionType; to?: string; title?: string; body?: string; priority?: string; assigneeMemberId?: string | null };
export type Automation = {
  id: string;
  name: string;
  trigger: string;
  minAmount: number | null;
  actions: AutomationAction[];
  active: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Trigger = { key: string; label: string; amount: boolean; vars: string[] };
export type Run = {
  id: string;
  status: 'ok' | 'error' | 'skipped';
  summary: string;
  results: { type: ActionType; ok: boolean; message: string }[];
  createdAt: string;
  automation: { id: string; name: string };
};
export type AutomationList = {
  automations: Automation[];
  runs: Run[];
  triggers: Trigger[];
  members: { id: string; name: string; role: string }[];
  modules: string[];
};

/** Valores de ejemplo para la vista previa. */
export const SAMPLE: Record<string, string> = {
  numero: '12',
  cliente: 'Ana Pérez',
  celular: '300 123 4567',
  correo: 'ana@correo.com',
  total: '$85.000',
  entrega: 'domicilio a Calle 10 # 5-20',
  productos: '2 × Café de la casa, 1 × Torta de queso',
  mensaje: '¿Tienen mesas para 8 personas el sábado?',
  titulo: 'Desayunos para evento',
  prioridad: 'alta',
  quien: 'Laura',
  producto: 'Café en grano',
  cantidad: '1,5',
  minimo: '2',
};
export const fillSample = (t: string) => t.replace(/\{([a-z_]+)\}/g, (all, k: string) => SAMPLE[k] ?? all);

/** Recetas para empezar rápido. */
export const RECIPES: Record<string, { label: string; name: string; trigger: string; minAmount?: number; actions: AutomationAction[] }> = {
  'pedido-grande': {
    label: 'Avisar cuando entre un pedido grande',
    name: 'Pedidos grandes',
    trigger: 'store_order',
    minAmount: 100000,
    actions: [
      { type: 'notify', to: 'supervisors', title: 'Pedido grande #{numero}: {total}', body: '{cliente} · {productos}' },
      { type: 'crm_contact' },
    ],
  },
  'formulario-crm': {
    label: 'Guardar en el CRM a quien escribe por la página',
    name: 'Mensajes de la página al CRM',
    trigger: 'site_contact',
    actions: [{ type: 'crm_contact' }, { type: 'notify', to: 'admins', title: '{cliente} escribió por la página', body: '{mensaje}' }],
  },
  'cotizacion-aceptada': {
    label: 'Crear un ticket cuando acepten una cotización',
    name: 'Cotización aceptada: preparar el trabajo',
    trigger: 'quote_accepted',
    actions: [
      {
        type: 'ticket',
        title: 'Preparar {titulo} para {cliente}',
        body: 'Aceptó la cotización {numero} por {total}. Contacto: {celular} · {correo}',
        priority: 'high',
      },
    ],
  },
  reponer: {
    label: 'Crear un ticket para reponer lo que se acaba',
    name: 'Reponer inventario',
    trigger: 'low_stock',
    actions: [{ type: 'ticket', title: 'Comprar {producto}', body: 'Quedan {cantidad}; el mínimo es {minimo}.', priority: 'high' }],
  },
};
