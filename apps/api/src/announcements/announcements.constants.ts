export const ANNOUNCEMENT_KINDS = ['news', 'notice', 'event'] as const;
export const KIND_LABEL: Record<string, string> = { news: 'Noticia', notice: 'Aviso', event: 'Evento' };
/** Correos por comunicado, como máximo (empresas grandes: el resto lo ve en la plataforma). */
export const MAX_EMAILS = 300;
/** Clave del módulo en el catálogo de la plataforma. */
export const ANNOUNCEMENTS_MODULE = 'announcements';
