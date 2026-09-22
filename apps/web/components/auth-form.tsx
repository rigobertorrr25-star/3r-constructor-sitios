'use client';

import { useActionState } from 'react';
import { loginAction, registerAction } from '@/app/actions';
import { Field } from './field';
import { SubmitButton } from './submit-button';

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const isLogin = mode === 'login';
  const [state, action] = useActionState(isLogin ? loginAction : registerAction, undefined);

  return (
    <form action={action} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {!isLogin && <Field label="Nombre (opcional)" name="firstName" autoComplete="given-name" maxLength={100} defaultValue={state?.values?.firstName} />}
      <Field label="Email" name="email" type="email" autoComplete="email" required maxLength={255} defaultValue={state?.values?.email} />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        required
        minLength={isLogin ? undefined : 8}
        maxLength={128}
        hint={isLogin ? undefined : 'Mínimo 8 caracteres.'}
      />
      {state?.error ? (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[#ffb4b5]">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingText={isLogin ? 'Entrando…' : 'Creando cuenta…'}>
        {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
      </SubmitButton>
    </form>
  );
}
