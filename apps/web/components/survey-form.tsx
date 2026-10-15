'use client';

import { useState, useTransition } from 'react';
import { answerPublicSurveyAction, answerSurveyAction } from '@/app/empresa/surveys-actions';
import type { SurveyQuestion } from '@/lib/surveys';
import { inputClass } from './field';
import { Alert } from './shop';

type Value = number | string | string[];

/** Responder una encuesta (del equipo con `companyId`/`surveyId`, o de clientes con `token`). */
export function SurveyForm({
  questions,
  companyId,
  surveyId,
  token,
  anonymous,
}: {
  questions: SurveyQuestion[];
  companyId?: string;
  surveyId?: string;
  token?: string;
  anonymous?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, Value>>({});
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const set = (id: string, v: Value) => setAnswers((a) => ({ ...a, [id]: v }));

  if (done) return <Alert tone="ok">¡Gracias! Tu respuesta quedó guardada.</Alert>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = questions.find(
      (q) =>
        q.required && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !(answers[q.id] as string[]).length)),
    );
    if (missing) return setError(`Responde: «${missing.text}»`);
    start(async () => {
      const res = token
        ? await answerPublicSurveyAction(token, answers, name || undefined)
        : await answerSurveyAction(companyId!, surveyId!, answers);
      if (res && !res.ok) setError(res.error);
      else setDone(true);
    });
  }

  const pill = (active: boolean) =>
    `min-w-10 rounded-full border px-3 py-2 text-[14px] transition ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-white/[0.12] text-foreground hover:bg-white/[0.06]'}`;

  return (
    <form onSubmit={submit} className="space-y-6">
      {anonymous ? (
        <p className="rounded-2xl bg-[#5ee0a0]/[0.08] px-4 py-3 text-[14px] text-[#9df0c6]">Esta encuesta es anónima: nadie sabrá qué respondiste.</p>
      ) : null}
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-3">
          <legend className="text-[15.5px] font-medium text-foreground">
            {i + 1}. {q.text}
            {q.required ? null : <span className="ml-2 text-[13px] font-normal text-muted-foreground">(opcional)</span>}
          </legend>
          {q.kind === 'rating' ? (
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={answers[q.id] === n}
                  aria-label={`${n} de 5`}
                  onClick={() => set(q.id, n)}
                  className={pill(answers[q.id] === n)}
                >
                  {'★'.repeat(n)}
                </button>
              ))}
            </div>
          ) : null}
          {q.kind === 'nps' ? (
            <div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup">
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={answers[q.id] === n}
                    onClick={() => set(q.id, n)}
                    className={pill(answers[q.id] === n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 flex max-w-[520px] justify-between text-[12px] text-muted-foreground">
                <span>Nada probable</span>
                <span>Muy probable</span>
              </p>
            </div>
          ) : null}
          {q.kind === 'choice' ? (
            <div className="space-y-2">
              {(q.options ?? []).map((o) => (
                <label
                  key={o}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 text-[14.5px] text-foreground hover:border-white/[0.16]"
                >
                  <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} className="size-4 accent-[#8a9bff]" />
                  {o}
                </label>
              ))}
            </div>
          ) : null}
          {q.kind === 'multi' ? (
            <div className="space-y-2">
              {(q.options ?? []).map((o) => {
                const list = (answers[q.id] as string[] | undefined) ?? [];
                return (
                  <label
                    key={o}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 text-[14.5px] text-foreground hover:border-white/[0.16]"
                  >
                    <input
                      type="checkbox"
                      checked={list.includes(o)}
                      onChange={(e) => set(q.id, e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
                      className="size-4 accent-[#8a9bff]"
                    />
                    {o}
                  </label>
                );
              })}
            </div>
          ) : null}
          {q.kind === 'text' ? (
            <textarea
              aria-label={q.text}
              rows={3}
              maxLength={2000}
              value={(answers[q.id] as string | undefined) ?? ''}
              onChange={(e) => set(q.id, e.target.value)}
              className={`${inputClass} resize-y`}
            />
          ) : null}
        </fieldset>
      ))}
      {token ? (
        <div className="space-y-1.5">
          <label htmlFor="survey-name" className="text-sm font-medium text-foreground">
            Tu nombre (opcional)
          </label>
          <input id="survey-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} className={inputClass} />
        </div>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar respuestas'}
      </button>
    </form>
  );
}
