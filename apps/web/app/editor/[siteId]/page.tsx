import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Editor } from '@/components/editor/editor';
import { authedApi } from '@/lib/api';
import { emptyDocument, type EditorDocument } from '@/lib/editor/types';
import type { PageContent, PublicationStatus, SiteDetail } from '@/lib/types';

export const metadata: Metadata = { title: 'Editor — 3R' };

const asDocument = (value: unknown): EditorDocument => {
  const doc = value as EditorDocument | null;
  return doc && doc.version === 1 && Array.isArray(doc.sections) ? doc : emptyDocument();
};

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { siteId } = await params;
  const { page: pageParam } = await searchParams;

  const siteRes = await authedApi<SiteDetail>(`/sites/${encodeURIComponent(siteId)}`);
  if (!siteRes.ok) notFound();
  const site = siteRes.data;

  const page = site.pages.find((p) => p.id === pageParam) ?? site.pages.find((p) => p.isHomepage) ?? site.pages[0];
  if (!page) notFound();

  const contentRes = await authedApi<PageContent>(`/pages/${page.id}/content`);
  if (!contentRes.ok) notFound();
  const publication = (await authedApi<PublicationStatus>(`/sites/${site.id}/publication`)).data;

  return (
    <Editor
      // Al restaurar una versión cambia el id y el editor se reinicia con el contenido nuevo.
      key={`${page.id}:${contentRes.data.versionId}`}
      siteId={site.id}
      siteName={site.name}
      pages={site.pages}
      pageId={page.id}
      initial={asDocument(contentRes.data.content)}
      serverUpdatedAt={contentRes.data.updatedAt}
      publication={publication}
    />
  );
}
