import type { Metadata } from 'next';
import { AiWriter, OptionCard } from '@/components/ai-writer';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import type { AiContentOverview } from '@/lib/ai-content';
import { atLeast } from '@/lib/companies';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Textos con IA — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function AiContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'ai_content')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Textos con IA"
        text="Publicaciones para Instagram, descripciones de productos, correos de promoción, textos para tu página y para Google, escritos en segundos."
      />
    );
  }
  if (!atLeast(company.me.role, 'supervisor')) {
    return (
      <p className={`${card} text-[15px] text-muted-foreground`}>Los textos con IA los usan los supervisores y administradores de la empresa.</p>
    );
  }
  const { data } = await authedApi<AiContentOverview>(`/companies/${id}/ai-content`);
  const label = (k: string) => data.kinds.find((x) => x.key === k)?.label ?? k;
  const disabled = !data.enabled
    ? 'Los textos con IA todavía no están activados. El equipo de 3R te avisa cuando estén listos.'
    : data.usage.today >= data.usage.companyCap || data.usage.mine >= data.usage.memberCap
      ? 'Ya se pidió el máximo de textos de hoy. Mañana puedes seguir.'
      : null;

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="h-textos">
        <h2 id="h-textos" className="font-display text-[20px] font-semibold text-foreground">
          Textos con IA
        </h2>
        <p className="mt-1 mb-5 text-[13.5px] text-muted-foreground">
          Te escribe tres opciones; copia la que más te guste y ajústala a tu manera. Léela antes de publicarla.
        </p>
        <AiWriter companyId={id} kinds={data.kinds} disabled={disabled} />
      </section>

      {data.history.length ? (
        <section className={card} aria-labelledby="h-antes">
          <h2 id="h-antes" className="mb-4 font-display text-[18px] font-semibold text-foreground">
            Lo que se ha escrito
          </h2>
          <ul className="space-y-5">
            {data.history.map((g) => (
              <li key={g.id}>
                <details>
                  <summary className="cursor-pointer text-[14.5px] text-foreground">
                    {label(g.kind)}: <span className="text-foreground/80">{g.topic}</span>
                    <span className="ml-2 text-[12.5px] text-muted-foreground">{when.format(new Date(g.createdAt))}</span>
                  </summary>
                  <ul className="mt-3 grid gap-3 lg:grid-cols-3">
                    {g.options.map((o, i) => (
                      <OptionCard key={i} n={i + 1} text={o} />
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
