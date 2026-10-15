import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleEditor } from '@/components/article-editor';
import { authedApi } from '@/lib/api';
import type { Article, KnowledgeList } from '@/lib/knowledge';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Editar artículo — 3R' };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string; articleId: string }> }) {
  const { id, articleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const [res, list] = await Promise.all([
    authedApi<Article>(`/companies/${id}/knowledge/${articleId}`),
    authedApi<KnowledgeList>(`/companies/${id}/knowledge`),
  ]);
  if (!res.ok || !res.data.manage) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/conocimiento/${articleId}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {res.data.title}
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Editar artículo</h2>
        <ArticleEditor companyId={id} article={res.data} categories={list.ok ? list.data.categories.map((c) => c.name) : []} />
      </div>
    </div>
  );
}
