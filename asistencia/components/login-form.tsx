'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions';
import { Alert, Field } from './ui';
import { SubmitButton } from './submit-button';

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Clave" name="password" type="password" required autoComplete="current-password" autoFocus />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
