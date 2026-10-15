import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { SeoMetaForm } from '@/components/seo-meta-form';
import { whatsappLink } from '@/components/whatsapp-button';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { scoreLabel, type SeoCheck, type SeoReport } from '@/lib/seo';
import { loadCompany } from '../company';
import { PublishButton } from '../pagina-web/publish-button';

export const metadata: Metadata = { title: 'SEO — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const MARK: Record<SeoCheck['level'], { icon: string; label: string; cls: string }> = {
  bad: { icon: '✕', label: 'Arreglar', cls: 'bg-[#ff6b6e]/15 text-[#ffb4b5]' },
  warn: { icon: '!', label: 'Mejorar', cls: 'bg-[#ffd27a]/15 text-[#ffd27a]' },
  ok: { icon: '✓', label: 'Bien', cls: 'bg-[#5ee0a0]/15 text-[#9df0c6]' },
};

export default async function SeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'seo')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="SEO"
        text="Revisa qué le falta a tu página para salir mejor en Google, con la lista de lo que hay que arreglar y cómo se ve tu resultado en Google."
      />
    );
  }
  if (!atLeast(company.me.role, 'supervisor')) {
    return <p className={`${card} text-[15px] text-muted-foreground`}>El SEO lo revisan los supervisores y administradores de la empresa.</p>;
  }
  const { data: r } = await authedApi<SeoReport>(`/companies/${id}/seo`);
  if (!r.site) {
    return (
      <section className={`${card} max-w-xl`}>
        <h2 className="font-display text-[19px] font-semibold text-foreground">Tu página todavía no está conectada</h2>
        <p className="mt-1 text-[14.5px] text-muted-foreground">
          Cuando el equipo de 3R conecte tu página a la empresa, aquí verás su revisión para Google.
        </p>
      </section>
    );
  }
  const base = `/empresa/${id}`;
  const fixLink = (c: SeoCheck) => {
    if (c.fix === 'meta' && c.pageId) return <a href={`#meta-${c.pageId}`}>Escribirlo abajo ↓</a>;
    if (c.fix === 'texts' && r.hasWeb)
      return <Link href={c.pageId ? `${base}/pagina-web/${c.pageId}` : `${base}/pagina-web`}>Cambiarlo en Página web →</Link>;
    if (c.fix === 'texts' || c.fix === '3r')
      return (
        <a href={whatsappLink(`Hola, quiero ayuda con la página de ${company.name}: ${c.title}`)} target="_blank" rel="noopener noreferrer">
          Pedírselo a 3R →
        </a>
      );
    return null;
  };
  const todo = r.checks.filter((c) => c.level !== 'ok');
  const done = r.checks.filter((c) => c.level === 'ok');

  return (
    <div className="space-y-6">
      <section className={`${card} flex flex-wrap items-center gap-6`} aria-labelledby="h-nota">
        <div className="relative grid size-28 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(r.score / 100) * 97.4} 97.4`}
            />
          </svg>
          <span className="font-display text-[30px] font-bold text-foreground">{r.score}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="h-nota" className="font-display text-[22px] font-semibold text-foreground">
            {scoreLabel(r.score)}
          </h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            Nota de 0 a 100 de {r.site.name} para Google.{' '}
            {todo.length ? `Hay ${todo.length} ${todo.length === 1 ? 'cosa' : 'cosas'} por mejorar.` : 'No hay nada pendiente.'}
          </p>
          {r.site.hasUnpublishedChanges ? (
            <p className="mt-2 text-[13.5px] text-[#ffd27a]">Tienes cambios sin publicar: Google ve la versión anterior.</p>
          ) : null}
        </div>
        {r.canEdit && r.site.hasUnpublishedChanges ? <PublishButton companyId={id} /> : null}
      </section>

      {todo.length ? (
        <section className={card} aria-labelledby="h-pendiente">
          <h2 id="h-pendiente" className="mb-3 font-display text-[18px] font-semibold text-foreground">
            Por mejorar
          </h2>
          <ul className="divide-y divide-white/[0.06]">
            {todo.map((c) => (
              <li key={c.id} className="flex gap-3 py-3.5">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${MARK[c.level].cls}`}
                  aria-label={MARK[c.level].label}
                >
                  {MARK[c.level].icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-foreground">{c.title}</span>
                  <span className="block text-[13.5px] text-muted-foreground">{c.detail}</span>
                  <span className="mt-1 block text-[13.5px] text-foreground underline-offset-2 hover:[&>a]:underline">{fixLink(c)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="h-google" className="space-y-4">
        <h2 id="h-google" className="font-display text-[18px] font-semibold text-foreground">
          Así te ven en Google
        </h2>
        {r.pages.map((p) => (
          <div key={p.id} id={`meta-${p.id}`} className={`${card} scroll-mt-24`}>
            <h3 className="mb-4 text-[15px] font-medium text-foreground">{p.isHomepage ? 'Inicio' : p.title}</h3>
            <SeoMetaForm companyId={id} page={p} siteName={r.site!.name} canEdit={r.canEdit} />
          </div>
        ))}
      </section>

      {done.length ? (
        <details className={card}>
          <summary className="cursor-pointer font-display text-[17px] font-semibold text-foreground">Lo que ya está bien ({done.length})</summary>
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {done.map((c) => (
              <li key={c.id} className="flex gap-3 py-3">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${MARK.ok.cls}`}
                  aria-label="Bien"
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] text-foreground">{c.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
