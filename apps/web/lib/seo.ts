// SEO: tipos y textos visibles.

export type SeoCheck = { id: string; level: 'ok' | 'warn' | 'bad'; title: string; detail: string; pageId?: string; fix?: 'meta' | 'texts' | '3r' };
export type SeoPage = {
  id: string;
  title: string;
  isHomepage: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  googleTitle: string;
  url: string | null;
};
export type SeoReport =
  | { site: null; canEdit: boolean; hasWeb: boolean }
  | {
      site: { name: string; url: string | null; published: boolean; hasUnpublishedChanges: boolean };
      canEdit: boolean;
      hasWeb: boolean;
      score: number;
      checks: SeoCheck[];
      pages: SeoPage[];
    };

export const scoreLabel = (n: number) => (n >= 85 ? 'Muy bien' : n >= 60 ? 'Bien, con cosas por mejorar' : 'Necesita trabajo');
