import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { closeSurveyAction, deleteSurveyAction, openSurveyAction } from '@/app/empresa/surveys-actions';
import { CopyLink } from '@/components/copy-link';
import { SurveyForm } from '@/components/survey-form';
import { authedApi } from '@/lib/api';
import { KIND_LABEL, statusLabel, type Survey } from '@/lib/surveys';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Encuesta — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });

export default async function SurveyPage({ params }: { params: Promise<{ id: string; surveyId: string }> }) {
  const { id, surveyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(surveyId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<Survey>(`/companies/${id}/surveys/${surveyId}`);
  if (res.status === 404 || res.status === 403) notFound();
  const s = res.data;
  const base = `/empresa/${id}/encuestas`;
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const canAnswer = s.audience === 'team' && s.open && !s.answered;
  const hidden = (
    <>
      <input type="hidden" name="companyId" value={id} />
      <input type="hidden" name="surveyId" value={s.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Link href={base} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Encuestas
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">
          {s.audience === 'team' ? (s.anonymous ? 'Para el equipo · anónima' : 'Para el equipo') : 'Para clientes'} · {statusLabel(s)}
          {s.closesAt ? ` · se cierra ${when.format(new Date(s.closesAt))}` : ''}
        </p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{s.title}</h2>
        {s.description ? <p className="mt-2 max-w-2xl text-[15px] text-foreground/85">{s.description}</p> : null}
      </div>

      <div className={`grid gap-6 ${s.manage ? 'lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start' : ''}`}>
        <section className={card} aria-label="Preguntas">
          {canAnswer ? (
            <SurveyForm questions={s.questions} companyId={id} surveyId={s.id} anonymous={s.anonymous} />
          ) : s.audience === 'team' && s.answered ? (
            <p className="text-[15px] text-[#9df0c6]">Ya respondiste esta encuesta. ¡Gracias!</p>
          ) : (
            <ol className="space-y-3">
              {s.questions.map((q, i) => (
                <li key={q.id} className="text-[15px] text-foreground">
                  {i + 1}. {q.text}
                  <span className="block text-[12.5px] text-muted-foreground">
                    {KIND_LABEL[q.kind]}
                    {q.options?.length ? `: ${q.options.join(', ')}` : ''}
                    {q.required ? '' : ' · opcional'}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!canAnswer && s.audience === 'team' && !s.open && !s.answered && !s.manage ? (
            <p className="mt-4 text-[14px] text-muted-foreground">Esta encuesta ya se cerró.</p>
          ) : null}
        </section>

        {s.manage ? (
          <aside className="space-y-6">
            <section className={card} aria-labelledby="h-gestion">
              <h3 id="h-gestion" className="font-display text-[18px] font-semibold text-foreground">
                {s.responses} {s.responses === 1 ? 'respuesta' : 'respuestas'}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`${base}/${s.id}/resultados`}
                  className="rounded-full bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
                >
                  Ver resultados
                </Link>
                {s.responses === 0 ? (
                  <Link
                    href={`${base}/${s.id}/editar`}
                    className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]"
                  >
                    Editar
                  </Link>
                ) : null}
                {s.open ? (
                  <form action={closeSurveyAction}>
                    {hidden}
                    <button
                      type="submit"
                      className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground hover:bg-white/[0.06]"
                    >
                      Cerrarla
                    </button>
                  </form>
                ) : (
                  <form action={openSurveyAction}>
                    {hidden}
                    <button
                      type="submit"
                      className="rounded-full border border-primary/50 px-4 py-2 text-[13.5px] text-foreground hover:bg-primary/10"
                    >
                      {s.status === 'draft' ? 'Abrirla' : 'Abrirla de nuevo'}
                    </button>
                  </form>
                )}
              </div>
              {s.status === 'draft' ? (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  {s.audience === 'team' ? 'Al abrirla, le llega un aviso a todo el equipo.' : 'Al abrirla, se crea el enlace para tus clientes.'}
                </p>
              ) : null}
            </section>
            {s.audience === 'public' && s.publicToken ? (
              <section className={card} aria-labelledby="h-enlace">
                <h3 id="h-enlace" className="mb-3 font-display text-[17px] font-semibold text-foreground">
                  Enlace para clientes
                </h3>
                <CopyLink url={`${origin}/encuesta/${s.publicToken}`} message={`${company.name} quiere saber tu opinión:`} />
              </section>
            ) : null}
            <form action={deleteSurveyAction}>
              {hidden}
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                Borrar esta encuesta
              </button>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
