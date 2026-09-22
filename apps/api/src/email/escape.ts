const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Todo lo que un cliente escribió (nombre, negocio, mensaje) puede llevar HTML: nunca se confía en él. */
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

/** Quita saltos de línea de asuntos y direcciones para evitar inyección de cabeceras de correo. */
export const sanitizeHeader = (value: unknown, maxLength = 200): string =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
