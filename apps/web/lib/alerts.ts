// Alertas (campanita): tipos y textos visibles.

export type Alert = { id: string; kind: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };
export type AlertList = { unread: number; items: Alert[] };

export const KIND_LABEL: Record<string, string> = {
  ticket: 'Ticket',
  request: 'Solicitud',
  announcement: 'Comunicado',
  document: 'Documento',
  contract: 'Contrato',
  birthday: 'Cumpleaños',
  reminder: 'Recordatorio',
  quote: 'Cotización',
};
