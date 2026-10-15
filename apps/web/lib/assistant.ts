// Asistente con IA: tipos y textos visibles.

export type AssistantSource = { n: number; type: 'article' | 'document'; id: string; title: string };
export type AssistantQuestion = {
  id: string;
  question: string;
  answer: string;
  sources: AssistantSource[];
  answered: boolean;
  helpful: boolean | null;
  createdAt: string;
};
export type AssistantDocument = {
  id: string;
  title: string;
  fileName: string;
  contentType: string;
  audience: 'all' | 'hr';
  aiEnabled: boolean;
  aiStatus: 'none' | 'ready' | 'empty' | 'error';
  readable: boolean;
  parts: number;
};
export type AssistantOverview = {
  enabled: boolean;
  canManage: boolean;
  usage: { today: number; companyCap: number; mine: number; memberCap: number };
  articles: number;
  history: AssistantQuestion[];
  documents?: AssistantDocument[];
  unanswered?: { id: string; question: string; answered: boolean; createdAt: string }[];
  month?: { questions: number; helpful: number; notHelpful: number };
};

export const AI_STATUS_TEXT: Record<AssistantDocument['aiStatus'], string> = {
  none: '',
  ready: 'Leído',
  empty: 'No se encontró texto (¿es un escaneo o una foto?)',
  error: 'No se pudo leer el archivo',
};
