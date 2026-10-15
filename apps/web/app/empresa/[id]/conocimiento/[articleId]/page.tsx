import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteArticleAction } from '@/app/empresa/knowledge-actions';
import { ArticleBody } from '@/components/article-body';
import { ArticleVote } from '@/components/article-vote';
import { authedApi } from '@/lib/api';
import { updatedText, type Article } from '@/lib/knowledge';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Artículo — 3R' };

export default async function ArticlePage({ params }: { params: Promise<{ id: string; articleId: string }> }) {
  const { id, articleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<Article>(`/companies/${id}/knowledge/${articleId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const a = res.data;
  const base = `/empresa/${id}/conocimiento`;

  return (
    <div className="space-y-6">
      <Link href={base} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Centro de conocimiento
      </Link>
      <article className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8">
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted-foreground">
          {a.category ? (
            <Link href={`${base}?category=${encodeURIComponent(a.category)}`} className="text-foreground/85 hover:underline">
              {a.category}
            </Link>
          ) : null}
          {a.audience === 'public' ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[12px] text-foreground">También para clientes</span>
          ) : null}
          {a.status === 'draft' ? <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[12px]">Borrador</span> : null}
        </p>
        <h2 className="mt-2 font-display text-[26px] font-bold tracking-tight text-foreground">{a.title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {updatedText(a.updatedAt)}
          {a.updatedBy ? ` por ${a.updatedBy}` : ''}
        </p>
        <div className="mt-6">
          <ArticleBody body={a.body} />
        </div>
        {a.status === 'published' ? (
          <div className="mt-8 border-t border-white/[0.06] pt-5">
            <ArticleVote articleId={a.id} companyId={id} initial={a.myVote} />
          </div>
        ) : null}
      </article>

      {a.manage ? (
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`${base}/${a.id}/editar`}
            className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]"
          >
            Editar
          </Link>
          <span className="text-[13px] text-muted-foreground">
            {a.views} {a.views === 1 ? 'vista' : 'vistas'} · {a.helpful ?? 0} les sirvió · {a.notHelpful ?? 0} no
          </span>
          <form action={deleteArticleAction} className="ml-auto">
            <input type="hidden" name="companyId" value={id} />
            <input type="hidden" name="articleId" value={a.id} />
            <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
              Borrar
            </button>
          </form>
        </div>
      ) : null}

      {a.related.length ? (
        <section aria-labelledby="h-relacionados">
          <h3 id="h-relacionados" className="mb-2 font-display text-[16px] font-semibold text-foreground">
            Más de {a.category}
          </h3>
          <ul className="space-y-1.5">
            {a.related.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/${r.id}`} className="text-[15px] text-foreground/90 underline-offset-2 hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
