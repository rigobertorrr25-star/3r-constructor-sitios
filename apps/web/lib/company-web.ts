// Constructor web: tipos y textos visibles.

export type FieldKind = 'heading' | 'text' | 'button' | 'image' | 'map';
export const FIELD_LABEL: Record<FieldKind, string> = { heading: 'Título', text: 'Texto', button: 'Botón', image: 'Foto', map: 'Mapa' };
export type Field = { nodeId: string; kind: FieldKind; content?: string; href?: string; src?: string; alt?: string; address?: string };
export type PageFields = {
  page: { id: string; title: string; slug: string; isHomepage: boolean };
  versionId: string;
  sections: { id: string; label: string; fields: Field[] }[];
};
export type Publication = {
  published: boolean;
  url: string | null;
  customUrl: string | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
};
export type WebOverview = {
  canEdit: boolean;
  site: null | { id: string; name: string; pages: { id: string; title: string; slug: string; isHomepage: boolean }[]; publication: Publication };
};
export type SiteOptions = {
  siteId: string | null;
  options: { id: string; name: string; status: string; order: { number: number; client: string } | null; linkedTo: string | null }[];
};
