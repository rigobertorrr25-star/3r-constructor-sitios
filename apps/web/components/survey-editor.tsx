'use client';

import { useState, useTransition } from 'react';
import { saveSurveyAction } from '@/app/empresa/surveys-actions';
import { KIND_LABEL, type QuestionKind, type Survey } from '@/lib/surveys';
import { toLocalInput } from '@/lib/announcements';
import { CheckField, Field, SelectField, TextAreaField, inputClass } from './field';
import { Alert } from './shop';

type Q = { kind: QuestionKind; text: string; options: string; required: boolean };
const blank: Q = { kind: 'rating', text: '', options: '', required: true };
const withOptions = (k: QuestionKind) => k === 'choice' || k === 'multi';

/** Ejemplos para empezar rápido. */
const TEMPLATES: { name: string; audience: 'team' | 'public'; anonymous: boolean; title: string; questions: Q[] }[] = [
  {
    name: 'Clima laboral',
    audience: 'team',
    anonymous: true,
    title: 'Clima laboral',
    questions: [
      { kind: 'rating', text: '¿Qué tan a gusto te sientes trabajando aquí?', options: '', required: true },
      { kind: 'rating', text: '¿Sientes que tu jefe te escucha?', options: '', required: true },
      { kind: 'choice', text: '¿Cómo te parece la carga de trabajo?', options: 'Liviana\nNormal\nPesada', required: true },
      { kind: 'text', text: '¿Qué cambiarías para trabajar mejor?', options: '', required: false },
    ],
  },
  {
    name: 'Satisfacción de clientes',
    audience: 'public',
    anonymous: false,
    title: '¿Cómo te atendimos?',
    questions: [
      { kind: 'nps', text: '¿Qué tan probable es que nos recomiendes a un amigo?', options: '', required: true },
      { kind: 'multi', text: '¿Qué fue lo que más te gustó?', options: 'La atención\nEl producto\nEl precio\nLa rapidez', required: false },
      { kind: 'text', text: '¿Qué podemos mejorar?', options: '', required: false },
    ],
  },
];

export function SurveyEditor({ companyId, survey }: { companyId: string; survey?: Survey }) {
  const [title, setTitle] = useState(survey?.title ?? '');
  const [description, setDescription] = useState(survey?.description ?? '');
  const [audience, setAudience] = useState<'team' | 'public'>(survey?.audience ?? 'team');
  const [anonymous, setAnonymous] = useState(survey?.anonymous ?? true);
  const [closesAt, setClosesAt] = useState(toLocalInput(survey?.closesAt ?? null));
  const [questions, setQuestions] = useState<Q[]>(
    survey?.questions.map((q) => ({ kind: q.kind, text: q.text, options: (q.options ?? []).join('\n'), required: q.required })) ?? [{ ...blank }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const setQ = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      const j = i + d;
      if (j < 0 || j >= next.length) return qs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveSurveyAction(companyId, survey?.id ?? null, {
        title,
        description,
        audience,
        anonymous: audience === 'team' && anonymous,
        closesAt: closesAt ? `${closesAt}:00-05:00` : null,
        questions: questions.map((q) => ({
          kind: q.kind,
          text: q.text,
          required: q.required,
          ...(withOptions(q.kind)
            ? {
                options: q.options
                  .split('\n')
                  .map((o) => o.trim())
                  .filter(Boolean),
              }
            : {}),
        })),
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {!survey ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] text-muted-foreground">Empezar con:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => {
                setTitle(t.title);
                setAudience(t.audience);
                setAnonymous(t.anonymous);
                setQuestions(t.questions.map((q) => ({ ...q })));
              }}
              className="rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[13px] text-foreground transition hover:bg-white/[0.06]"
            >
              {t.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-5">
        <Field label="Título" name="title" required minLength={3} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField
          label="Para qué es (opcional)"
          name="description"
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="¿Quién responde?"
            name="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as 'team' | 'public')}
            options={[
              { value: 'team', label: 'El equipo de la empresa' },
              { value: 'public', label: 'Clientes (con un enlace)' },
            ]}
          />
          <Field label="Se cierra (opcional)" name="closesAt" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
        {audience === 'team' ? (
          <CheckField
            name="anonymous"
            label="Anónima"
            hint="No se guarda quién respondió qué. Ideal para clima laboral."
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-[17px] font-semibold text-foreground">Preguntas</h3>
        {questions.map((q, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">Pregunta {i + 1}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  aria-label={`Subir la pregunta ${i + 1}`}
                  className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-white/[0.06]"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  aria-label={`Bajar la pregunta ${i + 1}`}
                  className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-white/[0.06]"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setQuestions((qs) => (qs.length > 1 ? qs.filter((_, j) => j !== i) : qs))}
                  aria-label={`Quitar la pregunta ${i + 1}`}
                  className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-white/[0.06] hover:text-[#ffb4b5]"
                >
                  ×
                </button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_210px]">
              <input
                aria-label={`Texto de la pregunta ${i + 1}`}
                value={q.text}
                onChange={(e) => setQ(i, { text: e.target.value })}
                required
                minLength={2}
                maxLength={300}
                placeholder="¿Qué tan a gusto te sientes trabajando aquí?"
                className={inputClass}
              />
              <select
                aria-label={`Tipo de la pregunta ${i + 1}`}
                value={q.kind}
                onChange={(e) => setQ(i, { kind: e.target.value as QuestionKind })}
                className={inputClass}
              >
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value} className="bg-[#0a131a]">
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {withOptions(q.kind) ? (
              <textarea
                aria-label={`Opciones de la pregunta ${i + 1}`}
                value={q.options}
                onChange={(e) => setQ(i, { options: e.target.value })}
                rows={3}
                placeholder={'Una opción por línea\nBien\nRegular\nMal'}
                className={`${inputClass} resize-y`}
              />
            ) : null}
            <label className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => setQ(i, { required: e.target.checked })}
                className="size-4 accent-[#8a9bff]"
              />
              Obligatoria
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuestions((qs) => [...qs, { ...blank }])}
          disabled={questions.length >= 30}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
        >
          + Agregar pregunta
        </button>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Guardando…' : survey ? 'Guardar cambios' : 'Guardar encuesta'}
      </button>
    </form>
  );
}
