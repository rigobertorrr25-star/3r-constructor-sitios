'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { adminLoginAction, goToBusinessAction, staffLoginAction } from '@/app/actions';
import { SubmitButton } from './submit-button';
import { Alert, Field } from './ui';

export function FindBusinessForm() {
  const [state, action] = useActionState(goToBusinessAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Tu negocio" name="slug" placeholder="por ejemplo: azul-caribe" autoCapitalize="none" required defaultValue={state?.values?.slug} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">Continuar</SubmitButton>
    </form>
  );
}

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Clave de 3R" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">Entrar</SubmitButton>
    </form>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Ingreso del equipo: código de empleado y PIN con teclado grande (sirve en tablet y celular). */
export function StaffLoginForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(staffLoginAction, undefined);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'code' | 'pin'>('code');
  const [lastState, setLastState] = useState(state);

  // Si hubo error, se vuelve a pedir el PIN (el código queda).
  if (state !== lastState) {
    setLastState(state);
    if (state?.error) {
      setPin('');
      setStep(state.values?.code ? 'pin' : 'code');
    }
  }

  const value = step === 'code' ? code : pin;
  const setValue = step === 'code' ? setCode : setPin;
  const press = (key: string) => {
    if (key === '⌫') setValue(value.slice(0, -1));
    else if (key && value.length < 6) setValue(value + key);
  };

  // También con el teclado del computador: números, borrar y Enter.
  const formRef = useRef<HTMLFormElement>(null);
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') pressRef.current('⌫');
      else if (e.key === 'Enter') formRef.current?.requestSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (state?.locations) {
    return (
      <form action={action} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="pin" value={pin} />
        <p className="text-[15px] text-muted-foreground">¿En qué sede vas a trabajar hoy?</p>
        {state.locations.map((l) => (
          <button
            key={l.id}
            name="locationId"
            value={l.id}
            className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-5 py-4 text-left font-display text-[17px] font-semibold text-foreground transition hover:border-primary/60 hover:bg-primary/10"
          >
            {l.name}
          </button>
        ))}
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-5"
      onSubmit={(e) => {
        if (step === 'code') {
          e.preventDefault();
          if (code.length > 0) setStep('pin');
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="pin" value={pin} />
      <div>
        <p className="text-sm font-medium text-foreground">{step === 'code' ? 'Tu código de empleado' : 'Tu PIN'}</p>
        <div
          aria-live="polite"
          aria-label={step === 'code' ? `Código: ${code || 'vacío'}` : `PIN: ${pin.length} números`}
          className="mt-1.5 flex h-[60px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] font-display text-[28px] tracking-[0.4em] text-foreground"
        >
          {step === 'code' ? code || <span className="text-[15px] tracking-normal text-muted-foreground/70">por ejemplo 0002</span> : '•'.repeat(pin.length) || <span className="text-[15px] tracking-normal text-muted-foreground/70">4 a 6 números</span>}
        </div>
        {step === 'pin' ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Código {code} ·{' '}
            <button type="button" className="text-primary hover:underline" onClick={() => (setStep('code'), setPin(''))}>
              cambiar
            </button>
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((key, i) =>
          key ? (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              aria-label={key === '⌫' ? 'Borrar' : key}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] py-4 font-display text-[22px] font-semibold text-foreground transition active:scale-95 active:bg-white/[0.08]"
            >
              {key}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {step === 'code' ? (
        <button type="submit" disabled={!code} className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-[16px] font-medium text-primary-foreground disabled:opacity-50">
          Siguiente
        </button>
      ) : (
        <SubmitButton className="w-full py-3.5 text-[16px]" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      )}
    </form>
  );
}
