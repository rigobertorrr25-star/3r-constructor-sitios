import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { statusLabel, type Survey, type SurveyList } from '@/lib/surveys';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Encuestas — 3R' };

const short = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });

function Row({ s, base, manage }: { s: Survey; base: string; manage: boolean }) {
  return (
    <li>
      <Link href={`${base}/${s.id}`} className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-foreground">{s.title}</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {[
              s.audience === 'team' ? (s.anonymous ? 'Equipo · anónima' : 'Equipo') : 'Clientes',
              `${s.questions.length} preguntas`,
              manage ? `${s.responses} respuestas` : null,
              short.format(new Date(s.createdAt)),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        {!manage && s.answered ? (
          <span className="w-fit rounded-full bg-[#5ee0a0]/15 px-2.5 py-1 text-[12.5px] text-[#9df0c6]">Respondida</span>
        ) : null}
        <span className="w-fit rounded-full border border-white/[0.1] px-2.5 py-1 text-[12.5px] text-foreground">{statusLabel(s)}</span>
      </Link>
    </li>
  );
}

export default async function SurveysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'surveys')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Encuestas"
        text="Encuestas de clima laboral para el equipo (anónimas si quieres) y de satisfacción para clientes con un enlace, con resultados en gráficas."
      />
    );
  }
  const { data } = await authedApi<SurveyList>(`/companies/${id}/surveys`);
  const base = `/empresa/${id}/encuestas`;
  const toAnswer = data.surveys.filter((s) => s.audience === 'team' && s.open && !s.answered);

  return (
    <div className="space-y-8">
      {toAnswer.length ? (
        <section className="rounded-[28px] border border-primary/30 bg-primary/[0.07] p-6" aria-labelledby="h-responder">
          <h2 id="h-responder" className="font-display text-[19px] font-semibold text-foreground">
            Te falta responder
          </h2>
          <ul className="mt-3 space-y-2">
            {toAnswer.map((s) => (
              <li key={s.id}>
                <Link href={`${base}/${s.id}`} className="text-[15px] text-foreground underline-offset-2 hover:underline">
                  {s.title} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.manage ? (
        <Link
          href={`${base}/nueva`}
          className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          + Nueva encuesta
        </Link>
      ) : null}

      {data.surveys.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {data.manage
            ? 'Todavía no hay encuestas. Crea la primera: hay plantillas de clima laboral y de satisfacción de clientes.'
            : 'No hay encuestas por ahora.'}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {data.surveys.map((s) => (
            <Row key={s.id} s={s} base={base} manage={data.manage} />
          ))}
        </ul>
      )}
    </div>
  );
}
