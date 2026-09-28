'use client';

import { useActionState } from 'react';
import { punchAction } from '@/app/actions';
import { formatClock, formatMinutes } from '@/lib/report';
import { Alert, Lion } from './ui';
import { SubmitButton } from './submit-button';

/** En el celular del empleado: escribe su PIN y queda marcada la entrada o la salida. */
export function PunchForm({ slug, code }: { slug: string; code: string }) {
  const [state, action] = useActionState(punchAction, undefined);
  const result = state?.result;

  if (result) {
    const isIn = result.type === 'in';
    return (
      <div className="rise space-y-4 text-center" role="status">
        <div className="relative mx-auto w-fit">
          <Lion size={96} />
          <span
            className={`absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full text-[18px] font-bold ring-4 ring-card ${isIn ? 'bg-success text-primary-foreground' : 'bg-primary text-primary-foreground'}`}
            aria-hidden="true"
          >
            {isIn ? '→' : '←'}
          </span>
        </div>
        <p className="font-display text-[26px] font-bold text-foreground">{isIn ? 'Entrada registrada' : 'Salida registrada'}</p>
        <p className="text-[17px] text-muted-foreground">
          {isIn ? `¡Hola, ${result.employeeName}! Buen turno.` : `¡Hasta luego, ${result.employeeName}!`}
        </p>
        <p className="font-display text-[44px] font-semibold tabular-nums text-foreground">{formatClock(new Date(result.at))}</p>
        {result.workedMinutes !== null ? (
          <p className="text-[16px] text-muted-foreground">Trabajaste {formatMinutes(result.workedMinutes)}.</p>
        ) : null}
        <p className="pt-2 text-[14px] text-muted-foreground">Ya puedes cerrar esta página.</p>
      </div>
    );
  }

  const expired = state?.code === 'CODE_EXPIRED';
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="code" value={code} />
      <div className="space-y-2 text-center">
        <label htmlFor="pin" className="block text-[17px] font-medium text-foreground">
          Escribe tu PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          maxLength={4}
          required
          autoFocus
          className="mx-auto block w-48 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center font-display text-[36px] tracking-[0.5em] text-foreground transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <p className="text-[14px] text-muted-foreground">Son 4 números. Si no lo sabes, pídelo a tu jefe.</p>
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {expired ? null : <SubmitButton pendingText="Marcando…">Marcar</SubmitButton>}
    </form>
  );
}
