import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleBody } from '@/components/article-body';
import { ArticleVote } from '@/components/article-vote';
import { rawApi } from '@/lib/api';
import { updatedText, type PublicArticle } from '@/lib/knowledge';

export const metadata: Metadata = { title: 'Ayuda', robots: { index: false, follow: false } };

export default async function PublicArticlePage({ params }: { params: Promise<{ token: string; articleId: string }> }) {
  const { token, articleId } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(articleId)) notFound();
  const res = await rawApi<PublicArticle>(`/public/help/${token}/${articleId}`).catch(() => null);
  if (!res || !res.ok) notFound();
  const a = res.data;
  const base = `/ayuda/${token}`;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-14">
      <Link href={base} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Preguntas frecuentes de {a.company.name}
      </Link>
      <article className="mt-6 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8">
        {a.category ? <p className="text-[13.5px] text-muted-foreground">{a.category}</p> : null}
        <h1 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{a.title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{updatedText(a.updatedAt)}</p>
        <div className="mt-6">
          <ArticleBody body={a.body} />
        </div>
        <div className="mt-8 border-t border-white/[0.06] pt-5">
          <ArticleVote articleId={a.id} token={token} />
        </div>
      </article>
      {a.related.length ? (
        <section className="mt-6" aria-labelledby="h-relacionados">
          <h2 id="h-relacionados" className="mb-2 font-display text-[16px] font-semibold text-foreground">
            También te puede servir
          </h2>
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
      {a.company.phone ? (
        <p className="mt-8 text-center text-[14px] text-muted-foreground">¿Necesitas más ayuda? Escríbenos al {a.company.phone}.</p>
      ) : null}
    </main>
  );
}
