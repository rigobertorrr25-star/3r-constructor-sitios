import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { inputClass } from '@/components/field';
import { rawApi } from '@/lib/api';
import type { PublicHelp } from '@/lib/knowledge';

export const metadata: Metadata = { title: 'Preguntas frecuentes', robots: { index: false, follow: false } };

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

/** Centro de ayuda público de una empresa: sus preguntas frecuentes, con buscador. */
export default async function PublicHelpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { token } = await params;
  const { q = '', category = '' } = await searchParams;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}) }).toString();
  const res = await rawApi<PublicHelp>(`/public/help/${token}${qs ? `?${qs}` : ''}`).catch(() => null);
  if (!res || !res.ok) notFound();
  const { company, categories, articles } = res.data;
  const base = `/ayuda/${token}`;
  const href = (cat: string) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { category: cat } : {}) }).toString();
    return p ? `${base}?${p}` : base;
  };

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-14">
      <header>
        <p className="text-[14px] text-muted-foreground">{company.name}</p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight text-foreground sm:text-[34px]">¿En qué te ayudamos?</h1>
      </header>
      <form action={base} className="mt-6 flex gap-2" role="search">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input type="search" name="q" defaultValue={q} placeholder="Escribe tu pregunta" aria-label="Buscar" className={inputClass} />
        <button type="submit" className="shrink-0 rounded-full bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground">
          Buscar
        </button>
      </form>
      {categories.length > 1 ? (
        <nav aria-label="Temas" className="mt-4 flex flex-wrap gap-2">
          <Link href={href('')} className={chip(!category)}>
            Todo
          </Link>
          {categories.map((c) => (
            <Link key={c.name} href={href(c.name)} className={chip(category === c.name)}>
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {articles.length ? (
        <ul className="mt-6 divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`${base}/${a.id}`} className="block px-5 py-4 transition hover:bg-white/[0.03]">
                <span className="block text-[15.5px] font-medium text-foreground">{a.title}</span>
                <span className="mt-1 line-clamp-2 block text-[14px] text-muted-foreground">{a.excerpt}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-[24px] border border-dashed border-white/[0.12] px-6 py-10 text-center text-muted-foreground">
          {q || category ? 'No encontramos nada con esa búsqueda.' : 'Pronto encontrarás aquí las preguntas frecuentes.'}
        </p>
      )}
      {company.phone ? (
        <p className="mt-8 text-center text-[14px] text-muted-foreground">¿No encontraste tu respuesta? Llámanos o escríbenos al {company.phone}.</p>
      ) : null}
    </main>
  );
}
