import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteAutomationAction, toggleAutomationAction } from '@/app/empresa/automations-actions';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { ACTION_SHORT, RECIPES, type AutomationList } from '@/lib/automations';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Automatizaciones — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export default async function AutomationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'automations')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Automatizaciones"
        text="Reglas de «si pasa esto, haz aquello»: avisar al equipo de un pedido grande, guardar en el CRM a quien escribe por la página, crear un ticket cuando aceptan una cotización…"
      />
    );
  }
  if (!atLeast(company.me.role, 'admin')) {
    return <p className={`${card} text-[15px] text-muted-foreground`}>Las automatizaciones las manejan los administradores de la empresa.</p>;
  }
  const { data } = await authedApi<AutomationList>(`/companies/${id}/automations`);
  const base = `/empresa/${id}/automatizaciones`;
  const label = (key: string) => data.triggers.find((t) => t.key === key)?.label ?? key;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`${base}/nueva`}
          className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          + Nueva automatización
        </Link>
      </div>

      {data.automations.length === 0 ? (
        <section className={card} aria-labelledby="h-recetas">
          <h2 id="h-recetas" className="font-display text-[19px] font-semibold text-foreground">
            Empieza con una receta
          </h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            Una automatización hace sola algo cada vez que pasa otra cosa. Escoge una y ajústala.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(RECIPES).map(([key, r]) => (
              <li key={key}>
                <Link
                  href={`${base}/nueva?receta=${key}`}
                  className="block h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-[15px] text-foreground transition hover:border-primary/50"
                >
                  {r.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ul className="space-y-3">
          {data.automations.map((a) => (
            <li key={a.id} className={`${card} ${a.active ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/${a.id}`} className="font-display text-[17px] font-semibold text-foreground hover:underline">
                    {a.name}
                  </Link>
                  <p className="mt-1 text-[14px] text-foreground/85">
                    <span className="text-muted-foreground">Si </span>
                    {label(a.trigger).toLowerCase()}
                    {a.minAmount ? ` de ${money(a.minAmount)} o más` : ''}
                    <span className="text-muted-foreground"> → </span>
                    {a.actions.map((x) => ACTION_SHORT[x.type]).join(', ')}
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {a.active ? 'Activa' : 'En pausa'} · {a.runCount} {a.runCount === 1 ? 'vez' : 'veces'}
                    {a.lastRunAt ? ` · la última el ${when.format(new Date(a.lastRunAt))}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={toggleAutomationAction}>
                    <input type="hidden" name="companyId" value={id} />
                    <input type="hidden" name="automationId" value={a.id} />
                    <input type="hidden" name="active" value={a.active ? 'false' : 'true'} />
                    <button
                      type="submit"
                      className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]"
                    >
                      {a.active ? 'Pausar' : 'Activar'}
                    </button>
                  </form>
                  <form action={deleteAutomationAction}>
                    <input type="hidden" name="companyId" value={id} />
                    <input type="hidden" name="automationId" value={a.id} />
                    <button type="submit" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]">
                      Borrar
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className={card} aria-labelledby="h-historial">
        <h2 id="h-historial" className="mb-3 font-display text-[18px] font-semibold text-foreground">
          Lo último que hicieron
        </h2>
        {data.runs.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Todavía no ha corrido ninguna.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {data.runs.map((r) => (
              <li key={r.id} className="flex gap-3 py-3">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${r.status === 'ok' ? 'bg-[#5ee0a0]/15 text-[#9df0c6]' : 'bg-[#ff6b6e]/15 text-[#ffb4b5]'}`}
                  aria-label={r.status === 'ok' ? 'Bien' : 'Con problemas'}
                >
                  {r.status === 'ok' ? '✓' : '!'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] text-foreground">
                    {r.automation.name}: {r.summary}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {when.format(new Date(r.createdAt))} · {r.results.map((x) => `${x.ok ? '' : '✕ '}${x.message}`).join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
