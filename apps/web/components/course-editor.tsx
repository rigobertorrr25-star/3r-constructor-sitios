'use client';

import { useState, useTransition } from 'react';
import { saveCourseAction } from '@/app/empresa/training-actions';
import type { Course } from '@/lib/training';
import { CheckField, Field, TextAreaField, inputClass } from './field';
import { Alert } from './shop';

type L = { id?: string; title: string; body: string; videoUrl: string };
type Q = { text: string; options: string; correct: number };
const blankLesson: L = { title: '', body: '', videoUrl: '' };
const blankQuestion: Q = { text: '', options: '', correct: 0 };
const lines = (s: string) =>
  s
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);

/** Ejemplo para empezar rápido. */
const INDUCCION: { title: string; description: string; lessons: L[]; questions: Q[] } = {
  title: 'Inducción para personal nuevo',
  description: 'Lo que toda persona nueva debe saber en su primera semana.',
  lessons: [
    {
      title: 'Bienvenida y quiénes somos',
      body: 'Cuéntale a la persona nueva la historia de la empresa, qué vendemos y a quién atendemos.\n\nEscribe aquí los valores del equipo y lo que esperas de cada persona.',
      videoUrl: '',
    },
    {
      title: 'Horarios, turnos y permisos',
      body: 'Explica los turnos, cómo se pide un permiso o vacaciones en la plataforma y a quién avisar si llegas tarde.',
      videoUrl: '',
    },
    {
      title: 'Seguridad y aseo',
      body: 'Dónde está el botiquín y el extintor, cómo se reporta un accidente y las reglas de aseo del lugar de trabajo.',
      videoUrl: '',
    },
  ],
  questions: [
    {
      text: '¿Dónde se piden los permisos y las vacaciones?',
      options: 'En la plataforma de la empresa\nPor un mensaje de voz\nNo se piden',
      correct: 0,
    },
    { text: 'Si hay un accidente, ¿qué haces primero?', options: 'Nada, sigo trabajando\nLo reporto a mi jefe', correct: 1 },
  ],
};

function MoveButtons({ i, what, onMove, onRemove }: { i: number; what: string; onMove: (d: number) => void; onRemove: () => void }) {
  const b = 'rounded-lg px-2 py-1 text-muted-foreground hover:bg-white/[0.06]';
  return (
    <span className="flex gap-1">
      <button type="button" onClick={() => onMove(-1)} aria-label={`Subir la ${what} ${i + 1}`} className={b}>
        ↑
      </button>
      <button type="button" onClick={() => onMove(1)} aria-label={`Bajar la ${what} ${i + 1}`} className={b}>
        ↓
      </button>
      <button type="button" onClick={onRemove} aria-label={`Quitar la ${what} ${i + 1}`} className={`${b} hover:text-[#ffb4b5]`}>
        ×
      </button>
    </span>
  );
}

function moved<T>(list: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function CourseEditor({ companyId, course }: { companyId: string; course?: Course }) {
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [required, setRequired] = useState(course?.required ?? false);
  const [dueAt, setDueAt] = useState(course?.dueAt?.slice(0, 10) ?? '');
  const [passScore, setPassScore] = useState(String(course?.passScore ?? 70));
  const [lessons, setLessons] = useState<L[]>(
    course?.lessons.map((l) => ({ id: l.id, title: l.title, body: l.body, videoUrl: l.videoUrl ?? '' })) ?? [{ ...blankLesson }],
  );
  const [questions, setQuestions] = useState<Q[]>(
    course?.questions.map((q) => ({ text: q.text, options: q.options.join('\n'), correct: q.correct ?? 0 })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const setL = (i: number, patch: Partial<L>) => setLessons((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setQ = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const bad = questions.find((q) => lines(q.options).length < 2);
    if (bad) return setError(`La pregunta «${bad.text || 'sin texto'}» necesita al menos 2 opciones.`);
    start(async () => {
      const res = await saveCourseAction(companyId, course?.id ?? null, {
        title,
        description,
        required,
        dueAt: dueAt || null,
        passScore: Number(passScore) || 70,
        lessons: lessons.map((l) => ({ ...(l.id ? { id: l.id } : {}), title: l.title, body: l.body, videoUrl: l.videoUrl || null })),
        questions: questions.map((q) => ({ text: q.text, options: lines(q.options), correct: Math.min(q.correct, lines(q.options).length - 1) })),
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {!course ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] text-muted-foreground">Empezar con:</span>
          <button
            type="button"
            onClick={() => {
              setTitle(INDUCCION.title);
              setDescription(INDUCCION.description);
              setLessons(INDUCCION.lessons.map((l) => ({ ...l })));
              setQuestions(INDUCCION.questions.map((q) => ({ ...q })));
            }}
            className="rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[13px] text-foreground transition hover:bg-white/[0.06]"
          >
            Inducción para personal nuevo
          </button>
        </div>
      ) : null}

      <div className="space-y-5">
        <Field
          label="Nombre del curso"
          name="title"
          required
          minLength={3}
          maxLength={150}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextAreaField
          label="De qué trata (opcional)"
          name="description"
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <CheckField
          name="required"
          label="Obligatorio para todo el equipo"
          hint="Le sale como pendiente a cada persona hasta que lo termine."
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Terminarlo antes del (opcional)" name="dueAt" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          {questions.length ? (
            <Field
              label="Puntaje para aprobar (%)"
              name="passScore"
              type="number"
              min={1}
              max={100}
              value={passScore}
              onChange={(e) => setPassScore(e.target.value)}
              hint="Porcentaje de respuestas correctas."
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-[17px] font-semibold text-foreground">Lecciones</h3>
        {lessons.map((l, i) => (
          <div key={l.id ?? `n${i}`} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">Lección {i + 1}</span>
              <MoveButtons
                i={i}
                what="lección"
                onMove={(d) => setLessons((ls) => moved(ls, i, d))}
                onRemove={() => setLessons((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}
              />
            </div>
            <input
              aria-label={`Título de la lección ${i + 1}`}
              value={l.title}
              onChange={(e) => setL(i, { title: e.target.value })}
              required
              minLength={2}
              maxLength={150}
              placeholder="Título de la lección"
              className={inputClass}
            />
            <textarea
              aria-label={`Contenido de la lección ${i + 1}`}
              value={l.body}
              onChange={(e) => setL(i, { body: e.target.value })}
              required
              minLength={2}
              maxLength={20000}
              rows={6}
              placeholder="Lo que la persona debe leer y aprender. Deja una línea en blanco entre párrafos."
              className={`${inputClass} resize-y`}
            />
            <input
              aria-label={`Enlace del video de la lección ${i + 1}`}
              value={l.videoUrl}
              onChange={(e) => setL(i, { videoUrl: e.target.value })}
              type="url"
              maxLength={500}
              placeholder="Enlace a un video o material (opcional): https://…"
              className={inputClass}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLessons((ls) => [...ls, { ...blankLesson }])}
          disabled={lessons.length >= 40}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06]"
        >
          + Agregar lección
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-display text-[17px] font-semibold text-foreground">Evaluación (opcional)</h3>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Preguntas de selección al final del curso. Sin preguntas, el curso se termina al ver todas las lecciones.
          </p>
        </div>
        {questions.map((q, i) => {
          const opts = lines(q.options);
          return (
            <div key={i} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">Pregunta {i + 1}</span>
                <MoveButtons
                  i={i}
                  what="pregunta"
                  onMove={(d) => setQuestions((qs) => moved(qs, i, d))}
                  onRemove={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                />
              </div>
              <input
                aria-label={`Texto de la pregunta ${i + 1}`}
                value={q.text}
                onChange={(e) => setQ(i, { text: e.target.value })}
                required
                minLength={2}
                maxLength={300}
                placeholder="¿Qué haces si…?"
                className={inputClass}
              />
              <textarea
                aria-label={`Opciones de la pregunta ${i + 1}`}
                value={q.options}
                onChange={(e) => setQ(i, { options: e.target.value })}
                rows={3}
                placeholder={'Una opción por línea (de 2 a 6)'}
                className={`${inputClass} resize-y`}
              />
              <label className="block space-y-1.5">
                <span className="text-[13.5px] text-muted-foreground">Respuesta correcta</span>
                <select
                  aria-label={`Respuesta correcta de la pregunta ${i + 1}`}
                  value={Math.min(q.correct, Math.max(0, opts.length - 1))}
                  onChange={(e) => setQ(i, { correct: Number(e.target.value) })}
                  className={inputClass}
                >
                  {opts.length ? (
                    opts.map((o, k) => (
                      <option key={k} value={k} className="bg-[#0a131a]">
                        {o}
                      </option>
                    ))
                  ) : (
                    <option value={0} className="bg-[#0a131a]">
                      Escribe primero las opciones
                    </option>
                  )}
                </select>
              </label>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setQuestions((qs) => [...qs, { ...blankQuestion }])}
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
        {pending ? 'Guardando…' : course ? 'Guardar cambios' : 'Guardar curso'}
      </button>
    </form>
  );
}
