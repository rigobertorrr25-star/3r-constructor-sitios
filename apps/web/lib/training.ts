// Capacitaciones: tipos y textos visibles.

export type CourseStatus = 'draft' | 'published' | 'archived';
export const STATUS_LABEL: Record<CourseStatus, string> = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' };

export type MyProgress = {
  done: number;
  lessonsDone: string[];
  attempts: number;
  score: number | null;
  completedAt: string | null;
  startedAt: string;
} | null;

export type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  required: boolean;
  dueAt: string | null;
  passScore: number;
  publishedAt: string | null;
  updatedAt: string;
  lessons: number;
  questions: number;
  mine: MyProgress;
  overdue: boolean;
  stats?: { members: number; started: number; completed: number };
};
export type CourseList = { manage: boolean; seeTeam: boolean; courses: CourseCard[] };

export type Lesson = { id: string; position: number; title: string; body: string; videoUrl: string | null };
export type CourseQuestion = { id: string; position: number; text: string; options: string[]; correct?: number };
export type Course = Omit<CourseCard, 'lessons' | 'questions' | 'stats'> & {
  lessons: Lesson[];
  questions: CourseQuestion[];
  can: { manage: boolean; seeTeam: boolean };
};

export type QuizResult = { score: number; passed: boolean; passScore: number; wrong: string[]; mine: MyProgress };

export type TeamProgress = {
  course: {
    id: string;
    title: string;
    status: CourseStatus;
    required: boolean;
    dueAt: string | null;
    passScore: number;
    lessons: number;
    questions: number;
  };
  people: {
    memberId: string;
    name: string;
    jobTitle: string | null;
    area: string | null;
    status: 'pending' | 'in_progress' | 'completed';
    done: number;
    attempts: number;
    score: number | null;
    completedAt: string | null;
    overdue: boolean;
  }[];
};

export type TrainingSummary = { pending: number; courses: { id: string; title: string; dueAt: string | null; overdue: boolean }[] };

/** "31 ene 2030" para fechas guardadas como día (UTC). */
export const dayText = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
