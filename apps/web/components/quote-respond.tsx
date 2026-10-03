'use client';

import { useActionState, useState } from 'react';
import { respondQuoteAction } from '@/app/cotizacion/actions';
import { Field, TextAreaField } from './field';
import { Alert } from './shop';

type Choice = 'accept' | 'changes' | 'reject';
const TEXT: Record<Choice, { button: string; hint: string; message: string }> = {
  accept: { button: 'Aceptar la cotización', hint: 'La empresa recibe tu aceptación y se pone en contacto contigo.', message: 'Mensaje (opcional)' },
  changes: {
    button: 'Enviar los cambios',
    hint: 'Cuéntale a la empresa qué quieres cambiar; te mandará una nueva versión.',
    message: '¿Qué cambios necesitas?',
  },
  reject: { button: 'Rechazar la cotización', hint: 'Cuéntanos por qué: le ayuda a la empresa a mejorar.', message: '¿Por qué la rechazas?' },
};

export function QuoteRespond({ token, canAccept }: { token: string; canAccept: boolean }) {
  const [state, action, pending] = useActionState(respondQuoteAction, undefined);
  const [choice, setChoice] = useState<Choice | null>((state?.values?.action as Choice) ?? null);
  if (state?.done) return <Alert tone="ok">Listo, tu respuesta quedó registrada: {state.done.toLowerCase()}. La empresa ya recibió el aviso.</Alert>;
  const options: Choice[] = canAccept ? ['accept', 'changes', 'reject'] : ['changes', 'reject'];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChoice(c)}
            aria-pressed={choice === c}
            className={
              c === 'accept'
                ? `rounded-full px-5 py-2.5 text-[14px] font-medium transition ${choice === c ? 'bg-primary text-primary-foreground ring-2 ring-primary/40' : 'bg-primary text-primary-foreground hover:shadow-[var(--shadow-glow)]'}`
                : `rounded-full border px-5 py-2.5 text-[14px] transition ${choice === c ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-white/[0.12] text-foreground hover:bg-white/[0.06]'}`
            }
          >
            {c === 'accept' ? 'Aceptar' : c === 'changes' ? 'Pedir cambios' : 'Rechazar'}
          </button>
        ))}
      </div>
      {choice ? (
        <form action={action} className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="action" value={choice} />
          <p className="text-[14px] text-muted-foreground">{TEXT[choice].hint}</p>
          <Field label="Tu nombre" name="name" required minLength={2} maxLength={150} defaultValue={state?.values?.name} autoComplete="name" />
          <TextAreaField
            label={TEXT[choice].message}
            name="message"
            rows={3}
            maxLength={2000}
            required={choice !== 'accept'}
            defaultValue={state?.values?.message}
          />
          {state?.error ? <Alert>{state.error}</Alert> : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? 'Enviando…' : TEXT[choice].button}
          </button>
        </form>
      ) : null}
    </div>
  );
}
