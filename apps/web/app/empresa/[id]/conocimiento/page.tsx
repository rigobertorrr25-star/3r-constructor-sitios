import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { disableHelpAction, enableHelpAction } from '@/app/empresa/knowledge-actions';
import { CopyLink } from '@/components/copy-link';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { AUDIENCE_LABEL, type KnowledgeList } from '@/lib/knowledge';
import { inputClass } from '@/components/field';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Centro de conocimiento — 3R' };

const short = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { id } = await params;
  const { q = '', category = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'knowledge')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Centro de conocimiento"
        text="Manuales, procesos y respuestas para tu equipo en un solo lugar, con buscador. Y una página de preguntas frecuentes para tus clientes."
      />
    );
  }
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}) }).toString();
  const { data } = await authedApi<KnowledgeList>(`/companies/${id}/knowledge${qs ? `?${qs}` : ''}`);
  const base = `/empresa/${id}/conocimiento`;
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const filtered = !!(q || category);
  const href = (cat: string) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { category: cat } : {}) }).toString();
    return p ? `${base}?${p}` : base;
  };

  return (
    <div className={`grid gap-6 ${data.canShare ? 'lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start' : ''}`}>
      <div className="space-y-6">
        <form action={base} className="flex gap-2" role="search">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar: caja, domicilios, turnos…"
            aria-label="Buscar en el centro de conocimiento"
            className={inputClass}
          />
          <button type="submit" className="shrink-0 rounded-full bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground">
            Buscar
          </button>
        </form>

        {data.categories.length ? (
          <nav aria-label="Categorías" className="flex flex-wrap gap-2">
            <Link href={href('')} className={chip(!category)}>
              Todas
            </Link>
            {data.categories.map((c) => (
              <Link key={c.name} href={href(c.name)} className={chip(category === c.name)}>
                {c.name} <span className="text-muted-foreground">{c.count}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        {data.manage ? (
          <Link
            href={`${base}/nuevo`}
            className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
          >
            + Nuevo artículo
          </Link>
        ) : null}

        {data.articles.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
            {filtered
              ? 'No encontramos artículos con esa búsqueda.'
              : data.manage
                ? 'Todavía no hay artículos. Empieza por lo que más te preguntan: cómo abrir la caja, horarios, cómo atender un reclamo…'
                : 'Todavía no hay artículos.'}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
            {data.articles.map((a) => (
              <li key={a.id}>
                <Link href={`${base}/${a.id}`} className="block px-5 py-4 transition hover:bg-white/[0.03]">
                  <span className="flex flex-wrap items-center gap-2">
                    {a.pinned ? <span className="text-[12px] text-primary">Fijado</span> : null}
                    <span className="text-[15.5px] font-medium text-foreground">{a.title}</span>
                    {data.manage && a.status === 'draft' ? (
                      <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[11.5px] text-muted-foreground">Borrador</span>
                    ) : null}
                    {a.audience === 'public' ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11.5px] text-foreground">Clientes</span>
                    ) : null}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[14px] text-muted-foreground">{a.excerpt}</span>
                  <span className="mt-1.5 block text-[12.5px] text-muted-foreground">
                    {[
                      a.category,
                      short.format(new Date(a.updatedAt)),
                      data.manage ? `${a.views} ${a.views === 1 ? 'vista' : 'vistas'}` : null,
                      data.manage && (a.helpful || a.notHelpful) ? `${a.helpful} les sirvió · ${a.notHelpful} no` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.canShare ? (
        <aside className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]" aria-labelledby="h-ayuda">
          <h2 id="h-ayuda" className="font-display text-[18px] font-semibold text-foreground">
            Ayuda para clientes
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Una página pública con los artículos marcados «{AUDIENCE_LABEL.public}». Ponla en tu página web, en Instagram o mándala por WhatsApp.
          </p>
          <div className="mt-4">
            {data.helpToken ? (
              <div className="space-y-4">
                <CopyLink url={`${origin}/ayuda/${data.helpToken}`} message={`Preguntas frecuentes de ${company.name}:`} />
                <form action={disableHelpAction}>
                  <input type="hidden" name="companyId" value={id} />
                  <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                    Apagar la página pública
                  </button>
                </form>
              </div>
            ) : (
              <form action={enableHelpAction}>
                <input type="hidden" name="companyId" value={id} />
                <button type="submit" className="rounded-full border border-primary/50 px-4 py-2 text-[13.5px] text-foreground hover:bg-primary/10">
                  Crear la página pública
                </button>
              </form>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
