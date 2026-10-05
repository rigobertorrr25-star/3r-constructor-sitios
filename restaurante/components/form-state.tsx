'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import type { FormState } from '@/app/actions';
import { Alert } from './ui';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulario con su mensaje de error o de éxito. `resetOnOk` vacía los campos cuando sale bien;
 * `onOk` sirve para cerrar un diálogo.
 */
export function ActionForm({
  action,
  children,
  className = 'space-y-4',
  resetOnOk = false,
  onOk,
  showOk = true,
}: {
  action: Action;
  children: (state: FormState) => ReactNode;
  className?: string;
  resetOnOk?: boolean;
  onOk?: () => void;
  showOk?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  const lastOk = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state?.ok && state.ok !== lastOk.current) {
      lastOk.current = state.ok;
      if (resetOnOk) form.current?.reset();
      onOk?.();
    }
  }, [state, resetOnOk, onOk]);
  return (
    <form ref={form} action={formAction} className={className}>
      {children(state)}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {showOk && state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
    </form>
  );
}
