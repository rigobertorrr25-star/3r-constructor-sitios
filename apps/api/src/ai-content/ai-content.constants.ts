/** Clave del módulo en el catálogo de la plataforma. */
export const AI_CONTENT_MODULE = 'ai_content';
export const COMPANY_DAILY_CAP = 100;
export const MEMBER_DAILY_CAP = 30;

/** Qué se le pide a la IA según el tipo de texto. */
export const KINDS: Record<string, { label: string; ask: string }> = {
  social: {
    label: 'Publicación para Instagram o Facebook',
    ask: 'una publicación para Instagram o Facebook: 2 a 4 frases que enganchen, máximo 2 emojis y al final 3 a 5 hashtags en español',
  },
  product: {
    label: 'Descripción de producto',
    ask: 'la descripción de un producto para la tienda en línea: 2 o 3 frases que digan qué es y por qué vale la pena, sin emojis',
  },
  email: {
    label: 'Correo de promoción',
    ask: 'un correo de promoción para clientes. La primera línea es «Asunto: …» (máximo 70 letras). Después el mensaje: un título que empiece con «## », 2 párrafos cortos separados por una línea en blanco y, si sirve, una lista con «- »',
  },
  page: {
    label: 'Texto para tu página web',
    ask: 'un texto para una sección de la página web del negocio: un título corto en la primera línea y un párrafo de 2 o 3 frases',
  },
  seo: {
    label: 'Título y descripción para Google',
    ask: 'el título y la descripción para que la página salga en Google. Primera línea «Título: …» (máximo 60 letras, con el nombre del negocio). Segunda línea «Descripción: …» (entre 120 y 155 letras, con la ciudad si se sabe)',
  },
  whatsapp: {
    label: 'Mensaje de WhatsApp para clientes',
    ask: 'un mensaje de WhatsApp para clientes: corto (máximo 4 líneas), cercano, con una invitación clara a responder o a venir',
  },
};
export const KIND_KEYS = Object.keys(KINDS);

export const TONES: Record<string, string> = {
  cercano: 'cercano y amable',
  profesional: 'profesional y confiable',
  divertido: 'alegre y divertido',
  elegante: 'elegante y sobrio',
};
export const TONE_KEYS = Object.keys(TONES);
