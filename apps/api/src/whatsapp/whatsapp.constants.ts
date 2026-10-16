/** Clave del módulo en el catálogo de la plataforma. */
export const WHATSAPP_MODULE = 'whatsapp';
/** WhatsApp deja mandar texto libre solo hasta 24 horas después del último mensaje del cliente. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Respuestas del asistente con IA por empresa en 24 horas (cuida el costo) y por conversación (corta un bucle). */
export const BOT_COMPANY_DAILY_CAP = 300;
export const BOT_CONVERSATION_DAILY_CAP = 30;
/** El asistente empieza así cuando la conversación la debe seguir una persona. */
export const BOT_HANDOFF = '[HUMANO]';
