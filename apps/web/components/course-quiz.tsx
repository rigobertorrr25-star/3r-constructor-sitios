'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { quizAction } from '@/app/empresa/training-actions';
import type { CourseQuestion, QuizResult } from '@/lib/training';
import { Alert } from './shop';

/** Evaluación del curso: se califica en la API (las respuestas correctas nunca llegan al navegador). */
export function CourseQuiz({
  companyId,
  courseId,
  questions,
  passScore,
}: {
  companyId: string;
  courseId: string;
  questions: CourseQuestion[];
  passScore: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = questions.find((q) => answers[q.id] === undefined);
    if (missing) return setError(`Responde: «${missing.text}»`);
    start(async () => {
      const res = await quizAction(companyId, courseId, answers);
      if (!res.ok) return setError(res.error);
      setResult(res.result);
      if (res.result.passed) router.refresh();
    });
  }

  if (result?.passed) {
    return <Alert tone="ok">¡Aprobaste con {result.score} %! Ya puedes descargar tu certificado.</Alert>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="text-[14px] text-muted-foreground">
        Para aprobar necesitas {passScore} % de respuestas correctas. Si no lo logras, puedes intentarlo otra vez.
      </p>
      {questions.map((q, i) => {
        const wrong = result?.wrong.includes(q.id);
        return (
          <fieldset key={q.id} className="space-y-2">
            <legend className="text-[15.5px] font-medium text-foreground">
              {i + 1}. {q.text}
              {wrong ? <span className="ml-2 text-[13px] font-normal text-[#ffb4b5]">Revisa esta</span> : null}
            </legend>
            {q.options.map((o, k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[14.5px] text-foreground transition hover:border-white/[0.16] ${
                  answers[q.id] === k ? 'border-primary/60 bg-primary/[0.06]' : 'border-white/[0.08]'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === k}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: k }))}
                  className="size-4 accent-[#8a9bff]"
                />
                {o}
              </label>
            ))}
          </fieldset>
        );
      })}
      {result && !result.passed ? (
        <Alert>
          Sacaste {result.score} % y necesitas {result.passScore} %. Revisa las preguntas marcadas y vuelve a intentarlo.
        </Alert>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Calificando…' : result ? 'Intentar de nuevo' : 'Enviar respuestas'}
      </button>
    </form>
  );
}
