import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleEditor } from '@/components/article-editor';
import { authedApi } from '@/lib/api';
import type { KnowledgeList } from '@/lib/knowledge';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Nuevo artículo — 3R' };

export default async function NewArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<KnowledgeList>(`/companies/${id}/knowledge`);
  if (!res.ok || !res.data.manage) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/conocimiento`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Centro de conocimiento
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nuevo artículo</h2>
        <ArticleEditor companyId={id} categories={res.data.categories.map((c) => c.name)} />
      </div>
    </div>
  );
}
