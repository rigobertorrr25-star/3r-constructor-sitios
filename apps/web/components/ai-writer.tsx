'use client';

import { useState, useTransition } from 'react';
import { generateTextAction } from '@/app/empresa/ai-content-actions';
import { TONE_LABEL, TOPIC_HINT, type AiKind } from '@/lib/ai-content';
import { inputClass } from './field';
import { Alert } from './shop';

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => setDone(true))}
      className="rounded-full border border-white/[0.12] px-4 py-1.5 text-[13px] text-foreground hover:bg-white/[0.06]"
    >
      {done ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export function OptionCard({ text, n, action }: { text: string; n: number; action?: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="mb-2 text-[12.5px] text-muted-foreground">Opción {n}</p>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">{action ?? <CopyButton text={text} />}</div>
    </li>
  );
}

/** La pantalla de Textos con IA: tipo, tono, de qué se trata y tres opciones para copiar. */
export function AiWriter({ companyId, kinds, disabled }: { companyId: string; kinds: { key: AiKind; label: string }[]; disabled?: string | null }) {
  const [kind, setKind] = useState<AiKind>('social');
  const [tone, setTone] = useState('cercano');
  const [topic, setTopic] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await generateTextAction(companyId, { kind, tone, topic });
      if (r.ok) setOptions(r.generation.options);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">¿Qué necesitas?</legend>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)} className={chip(kind === k.key)}>
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor="topic" className="text-sm font-medium text-foreground">
            ¿De qué se trata?
          </label>
          <textarea
            id="topic"
            rows={3}
            required
            minLength={3}
            maxLength={1000}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={TOPIC_HINT[kind]}
            className={`${inputClass} resize-y`}
          />
          <p className="text-[13px] text-muted-foreground">
            Entre más datos reales pongas (precios, fechas, horarios), mejor queda. La IA no inventa precios.
          </p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Tono</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TONE_LABEL).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tone === key} onClick={() => setTone(key)} className={chip(tone === key)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {error ? <Alert>{error}</Alert> : null}
        {disabled ? (
          <p className="text-[14px] text-muted-foreground">{disabled}</p>
        ) : (
          <button
            type="submit"
            disabled={pending || topic.trim().length < 3}
            className="rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            {pending ? 'Escribiendo…' : options.length ? 'Escribir otras opciones' : 'Escribir con IA'}
          </button>
        )}
      </form>
      {options.length ? (
        <ul className="grid gap-3 lg:grid-cols-3" aria-live="polite">
          {options.map((o, i) => (
            <OptionCard key={i} n={i + 1} text={o} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Botón pequeño dentro de otro formulario: pide un texto y lo pone donde va. */
export function AiSuggest({
  companyId,
  kind,
  context,
  onPick,
  label = 'Escribir con IA',
}: {
  companyId: string;
  kind: AiKind;
  context?: string;
  onPick: (text: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = () => {
    const t = [topic.trim(), context?.trim()].filter(Boolean).join('\n');
    if (t.length < 3) return;
    setError(null);
    start(async () => {
      const r = await generateTextAction(companyId, { kind, topic: t });
      if (r.ok) setOptions(r.generation.options);
      else setError(r.error);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-primary/40 px-4 py-1.5 text-[13px] text-foreground hover:bg-primary/10"
      >
        ✦ {label}
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-medium text-foreground">{label}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="px-2 text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="¿De qué se trata?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go();
            }
          }}
          maxLength={800}
          placeholder={TOPIC_HINT[kind]}
          className={inputClass}
        />
        <button
          type="button"
          onClick={go}
          disabled={pending || (topic.trim() + (context ?? '').trim()).length < 3}
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Escribiendo…' : 'Escribir'}
        </button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {options.length ? (
        <ul className="space-y-2">
          {options.map((o, i) => (
            <OptionCard
              key={i}
              n={i + 1}
              text={o}
              action={
                <button
                  type="button"
                  onClick={() => {
                    onPick(o);
                    setOpen(false);
                    setOptions([]);
                  }}
                  className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
                >
                  Usar este
                </button>
              }
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
