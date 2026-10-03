// Textos con IA: tipos y textos visibles.

export type AiKind = 'social' | 'product' | 'email' | 'page' | 'seo' | 'whatsapp';
export type AiGeneration = { id: string; kind: AiKind; tone: string; topic: string; options: string[]; createdAt: string };
export type AiContentOverview = {
  enabled: boolean;
  usage: { today: number; companyCap: number; mine: number; memberCap: number };
  kinds: { key: AiKind; label: string }[];
  history: AiGeneration[];
};

export const TONE_LABEL: Record<string, string> = { cercano: 'Cercano', profesional: 'Profesional', divertido: 'Divertido', elegante: 'Elegante' };

/** Qué escribir en la caja según el tipo, como ejemplo. */
export const TOPIC_HINT: Record<AiKind, string> = {
  social: 'Ej.: este viernes 2x1 en capuchinos de 3 a 6 de la tarde',
  product: 'Ej.: torta de zanahoria con queso crema, porción para 8 personas',
  email: 'Ej.: llegó el menú de octubre con tortas nuevas; invitar a venir este fin de semana',
  page: 'Ej.: sección «Quiénes somos»: café familiar en el centro histórico desde 2015',
  seo: 'Ej.: café y repostería artesanal en el centro de Cartagena, con domicilios',
  whatsapp: 'Ej.: avisar a los clientes que ya abrimos los domingos',
};

/** «Asunto: …» en la primera línea → asunto y mensaje por separado. */
export function splitSubject(text: string) {
  const m = /^\s*asunto\s*:\s*(.+)\n+([\s\S]*)$/i.exec(text);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: '', body: text.trim() };
}
