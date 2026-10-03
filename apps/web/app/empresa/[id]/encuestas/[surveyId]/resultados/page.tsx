import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authedApi } from '@/lib/api';
import { KIND_LABEL, statusLabel, type QuestionResult, type SurveyResults } from '@/lib/surveys';
import { loadCompany } from '../../../company';

export const metadata: Metadata = { title: 'Resultados de la encuesta — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[14px]">
          <span className="truncate text-foreground/90" title={r.label}>
            {r.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {r.count}
            {total ? <span className="text-[12px]"> · {Math.round((r.count / total) * 100)}%</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function npsTone(n: number) {
  return n >= 50 ? 'text-[#9df0c6]' : n >= 0 ? 'text-foreground' : 'text-[#ffb4b5]';
}

function Question({ q, i }: { q: QuestionResult; i: number }) {
  return (
    <section className={card} aria-labelledby={`q-${q.id}`}>
      <p className="text-[12.5px] text-muted-foreground">
        Pregunta {i + 1} · {KIND_LABEL[q.kind]} · {q.answers} {q.answers === 1 ? 'respuesta' : 'respuestas'}
      </p>
      <h3 id={`q-${q.id}`} className="mt-1 font-display text-[18px] font-semibold text-foreground">
        {q.text}
      </h3>
      <div className="mt-4">
        {q.answers === 0 ? (
          <p className="text-[14px] text-muted-foreground">Todavía nadie la responde.</p>
        ) : q.kind === 'rating' ? (
          <>
            <p className="mb-4 text-[15px] text-foreground">
              Promedio: <strong className="font-display text-[22px]">{q.average?.toLocaleString('es-CO')}</strong> de 5
            </p>
            <Bars rows={[...(q.distribution ?? [])].reverse().map((d) => ({ label: `${'★'.repeat(d.value)}`, count: d.count }))} />
          </>
        ) : q.kind === 'nps' ? (
          <>
            <p className="mb-1 text-[15px] text-foreground">
              Índice de recomendación: <strong className={`font-display text-[22px] ${npsTone(q.nps ?? 0)}`}>{q.nps}</strong>
              <span className="text-muted-foreground"> · promedio {q.average?.toLocaleString('es-CO')} de 10</span>
            </p>
            <p className="mb-4 text-[13px] text-muted-foreground">
              Va de −100 a 100: el porcentaje que da 9 o 10 menos el que da de 0 a 6. Por encima de 0 ya es bueno; por encima de 50, muy bueno.
            </p>
            <Bars rows={(q.distribution ?? []).map((d) => ({ label: String(d.value), count: d.count }))} />
          </>
        ) : q.kind === 'choice' || q.kind === 'multi' ? (
          <>
            {q.kind === 'multi' ? <p className="mb-3 text-[13px] text-muted-foreground">Cada persona podía marcar varias.</p> : null}
            <Bars rows={(q.counts ?? []).map((c) => ({ label: c.option, count: c.count }))} />
          </>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {(q.texts ?? []).map((t, k) => (
              <li
                key={k}
                className="whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[14.5px] text-foreground/90"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default async function SurveyResultsPage({ params }: { params: Promise<{ id: string; surveyId: string }> }) {
  const { id, surveyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(surveyId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<SurveyResults>(`/companies/${id}/surveys/${surveyId}/results`);
  if (res.status === 404 || res.status === 403) notFound();
  const { survey: s, total, questions, participation: p } = res.data;

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/encuestas/${s.id}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {s.title}
      </Link>
      <div>
        <p className="text-[14px] text-muted-foreground">
          Resultados · {statusLabel(s)} · {s.audience === 'team' ? (s.anonymous ? 'anónima' : 'con nombre') : 'clientes'}
        </p>
        <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{s.title}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-[13px] text-muted-foreground">Respuestas</p>
          <p className="mt-1 font-display text-[28px] font-bold text-foreground">{total}</p>
        </div>
        {p ? (
          <div className={card}>
            <p className="text-[13px] text-muted-foreground">Participación del equipo</p>
            <p className="mt-1 font-display text-[28px] font-bold text-foreground">
              {p.members ? Math.round((Math.min(p.responded, p.members) / p.members) * 100) : 0}%
            </p>
            <p className="text-[13px] text-muted-foreground">
              {p.responded} de {p.members} personas
            </p>
          </div>
        ) : null}
        {p?.pending?.length ? (
          <div className={card}>
            <p className="text-[13px] text-muted-foreground">Faltan por responder</p>
            <p className="mt-2 text-[14px] text-foreground/90">{p.pending.join(', ')}</p>
          </div>
        ) : p && s.anonymous ? (
          <div className={card}>
            <p className="text-[13px] text-muted-foreground">Es anónima</p>
            <p className="mt-2 text-[14px] text-foreground/90">No se guarda quién respondió ni quién falta.</p>
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <p className={`${card} text-[15px] text-muted-foreground`}>
          Todavía no hay respuestas. {s.status === 'draft' ? 'Abre la encuesta para empezar a recibirlas.' : ''}
        </p>
      ) : (
        questions.map((q, i) => <Question key={q.id} q={q} i={i} />)
      )}
    </div>
  );
}
