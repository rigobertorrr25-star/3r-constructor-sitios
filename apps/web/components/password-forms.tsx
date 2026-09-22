'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPasswordAction, resetPasswordAction } from '@/app/actions';
import { Field } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <Alert tone="ok">Si ese correo tiene una cuenta, te mandamos un enlace para cambiar tu contraseña. Revisa tu bandeja de entrada.</Alert>
        <Link href="/login" className="block text-center text-[14px] text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <Field label="Email" name="email" type="email" autoComplete="email" required maxLength={255} />
      <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} hint="Mínimo 8 caracteres." />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Cambiando…">Cambiar contraseña</SubmitButton>
    </form>
  );
}
