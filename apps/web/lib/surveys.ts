// Encuestas: tipos y textos visibles.

export type QuestionKind = 'rating' | 'nps' | 'choice' | 'multi' | 'text';
export const KIND_LABEL: Record<QuestionKind, string> = {
  rating: 'Estrellas (1 a 5)',
  nps: 'Recomendación (0 a 10)',
  choice: 'Una opción',
  multi: 'Varias opciones',
  text: 'Respuesta abierta',
};

export type SurveyQuestion = { id: string; position: number; kind: QuestionKind; text: string; options: string[] | null; required: boolean };

export type Survey = {
  id: string;
  title: string;
  description: string | null;
  audience: 'team' | 'public';
  anonymous: boolean;
  status: 'draft' | 'open' | 'closed';
  closesAt: string | null;
  publicToken: string | null;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
  responses: number;
  open: boolean;
  answered?: boolean;
  manage?: boolean;
};

export type SurveyList = { manage: boolean; surveys: Survey[] };
export type SurveysSummary = { pendingToAnswer: number; pending: { id: string; title: string }[] };

export type QuestionResult = SurveyQuestion & {
  answers: number;
  average?: number | null;
  distribution?: { value: number; count: number }[];
  nps?: number;
  counts?: { option: string; count: number }[];
  texts?: string[];
};
export type SurveyResults = {
  survey: Survey;
  total: number;
  questions: QuestionResult[];
  participation?: { members: number; responded: number; pending?: string[] };
};

export type PublicSurvey = { title: string; description: string | null; company: string; open: boolean; questions: SurveyQuestion[] };

export const statusLabel = (s: Pick<Survey, 'status' | 'open'>) => (s.status === 'draft' ? 'Borrador' : s.open ? 'Abierta' : 'Cerrada');
