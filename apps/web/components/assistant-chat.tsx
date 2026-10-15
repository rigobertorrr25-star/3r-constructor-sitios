'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { askAction, feedbackAction } from '@/app/empresa/assistant-actions';
import type { AssistantQuestion, AssistantSource } from '@/lib/assistant';
import { inputClass } from './field';
import { Alert } from './shop';

const EXAMPLES = ['¿Cuántos días de vacaciones tengo?', '¿Cuál es el horario de trabajo?', '¿Cómo pido un permiso?'];

/** Texto de la respuesta: párrafos, listas con «- » y los [1] de las fuentes como marquitas. */
function Answer({ text }: { text: string }) {
  const marks = (line: string) =>
    line.split(/(\[\d+\])/).map((part, i) =>
      /^\[\d+\]$/.test(part) ? (
        <sup key={i} className="ml-0.5 rounded bg-primary/15 px-1 text-[11px] font-semibold text-primary">
          {part.slice(1, -1)}
        </sup>
      ) : (
        <Fragment key={i}>{part.replace(/\*\*/g, '')}</Fragment>
      ),
    );
  // Línea por línea: «## » es un título, «- » un punto de lista; lo demás, párrafos.
  const groups: { kind: 'p' | 'h' | 'ul'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      groups.push({ kind: 'p', lines: [] });
      continue;
    }
    const kind = /^#{1,4}\s+/.test(line) ? 'h' : /^[-*•]\s+/.test(line) ? 'ul' : 'p';
    const clean = line.replace(/^#{1,4}\s+/, '').replace(/^[-*•]\s+/, '');
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && kind !== 'h' && last.lines.length) last.lines.push(clean);
    else groups.push({ kind, lines: [clean] });
  }
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-foreground/90">
      {groups
        .filter((g) => g.lines.length)
        .map((g, i) =>
          g.kind === 'ul' ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {g.lines.map((l, j) => (
                <li key={j}>{marks(l)}</li>
              ))}
            </ul>
          ) : g.kind === 'h' ? (
            <p key={i} className="font-semibold text-foreground">
              {marks(g.lines[0])}
            </p>
          ) : (
            <p key={i}>
              {g.lines.map((l, j) => (
                <Fragment key={j}>
                  {j ? <br /> : null}
                  {marks(l)}
                </Fragment>
              ))}
            </p>
          ),
        )}
    </div>
  );
}

function Sources({ companyId, sources }: { companyId: string; sources: AssistantSource[] }) {
  if (!sources.length) return null;
  return (
    <p className="mt-3 flex flex-wrap gap-2 text-[13px] text-muted-foreground">
      <span>De dónde lo saqué:</span>
      {sources.map((s) => (
        <Link
          key={`${s.type}-${s.id}`}
          href={s.type === 'article' ? `/empresa/${companyId}/conocimiento/${s.id}` : `/empresa/${companyId}/documentos`}
          className="rounded-full border border-white/[0.1] px-2.5 py-0.5 text-foreground/85 hover:border-primary/50"
        >
          {s.n}. {s.title}
        </Link>
      ))}
    </p>
  );
}

function Feedback({ companyId, q }: { companyId: string; q: AssistantQuestion }) {
  const [value, setValue] = useState(q.helpful);
  if (!q.answered) return null;
  const send = (helpful: boolean) => {
    setValue(helpful);
    void feedbackAction(companyId, q.id, helpful);
  };
  return (
    <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
      {value === null ? (
        <>
          <span>¿Te sirvió?</span>
          <button type="button" onClick={() => send(true)} className="rounded-full border border-white/[0.1] px-3 py-1 hover:text-foreground">
            Sí
          </button>
          <button type="button" onClick={() => send(false)} className="rounded-full border border-white/[0.1] px-3 py-1 hover:text-foreground">
            No
          </button>
        </>
      ) : (
        <span>{value ? 'Gracias por contarnos.' : 'Gracias. Le avisamos al administrador para que complete la información.'}</span>
      )}
    </div>
  );
}

/** Conversación con el asistente: lo último abajo, la caja para preguntar al final. */
export function AssistantChat({ companyId, history, disabled }: { companyId: string; history: AssistantQuestion[]; disabled?: string | null }) {
  const [items, setItems] = useState<AssistantQuestion[]>(() => [...history].reverse());
  const [question, setQuestion] = useState('');
  const [waiting, setWaiting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length || waiting) end.current?.scrollIntoView({ block: 'nearest' });
  }, [items, waiting]);

  function ask(text: string) {
    const q = text.trim();
    if (q.length < 3 || pending) return;
    setError(null);
    setWaiting(q);
    setQuestion('');
    start(async () => {
      const r = await askAction(companyId, q);
      setWaiting(null);
      if (r.ok) setItems((xs) => [...xs, r.question]);
      else {
        setError(r.error);
        setQuestion(q);
      }
    });
  }

  return (
    <div className="space-y-5">
      {items.length === 0 && !waiting ? (
        <div className="space-y-3">
          <p className="text-[15px] text-foreground/85">Pregúntame lo que necesites saber de la empresa: horarios, permisos, procesos, reglamento…</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <button
                key={x}
                type="button"
                disabled={!!disabled}
                onClick={() => ask(x)}
                className="rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[13.5px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ol className="space-y-5" aria-live="polite">
        {items.map((q) => (
          <li key={q.id} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 px-4 py-2.5 text-[15px] text-foreground">{q.question}</p>
            <div
              className={`max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3 ${q.answered ? 'border-white/[0.08] bg-white/[0.03]' : 'border-[#ffd27a]/25 bg-[#ffd27a]/[0.05]'}`}
            >
              <Answer text={q.answer} />
              <Sources companyId={companyId} sources={q.sources} />
              <Feedback companyId={companyId} q={q} />
            </div>
          </li>
        ))}
        {waiting ? (
          <li className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 px-4 py-2.5 text-[15px] text-foreground">{waiting}</p>
            <p className="w-fit rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14.5px] text-muted-foreground">
              Buscando en los documentos…
            </p>
          </li>
        ) : null}
      </ol>
      <div ref={end} />

      {error ? <Alert>{error}</Alert> : null}
      {disabled ? (
        <p className="text-[14px] text-muted-foreground">{disabled}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label htmlFor="question" className="sr-only">
            Tu pregunta
          </label>
          <textarea
            id="question"
            rows={2}
            maxLength={1000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            placeholder="Escribe tu pregunta"
            className={`${inputClass} resize-none`}
          />
          <button
            type="submit"
            disabled={pending || question.trim().length < 3}
            className="shrink-0 rounded-full bg-primary px-6 py-3 text-[14.5px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            Preguntar
          </button>
        </form>
      )}
    </div>
  );
}
