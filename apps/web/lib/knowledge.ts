// Centro de conocimiento: tipos y textos visibles.

export type ArticleAudience = 'team' | 'public';
export const AUDIENCE_LABEL: Record<ArticleAudience, string> = { team: 'Equipo', public: 'Clientes' };

export type ArticleItem = {
  id: string;
  title: string;
  excerpt: string;
  category: string | null;
  audience: ArticleAudience;
  status: 'draft' | 'published';
  pinned: boolean;
  views: number;
  updatedAt: string;
  helpful?: number;
  notHelpful?: number;
};
export type Category = { name: string; count: number };
export type KnowledgeList = { manage: boolean; canShare: boolean; helpToken: string | null; categories: Category[]; articles: ArticleItem[] };

export type Article = Omit<ArticleItem, 'excerpt'> & {
  body: string;
  createdAt: string;
  author: string | null;
  updatedBy: string | null;
  myVote: boolean | null;
  related: { id: string; title: string }[];
  manage: boolean;
};

export type PublicHelp = {
  company: { name: string; phone: string | null };
  categories: Category[];
  articles: { id: string; title: string; excerpt: string; category: string | null; pinned: boolean; updatedAt: string }[];
};
export type PublicArticle = {
  company: { name: string; phone: string | null };
  id: string;
  title: string;
  body: string;
  category: string | null;
  updatedAt: string;
  related: { id: string; title: string }[];
};

export const updatedText = (iso: string) =>
  `Actualizado el ${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(iso))}`;
