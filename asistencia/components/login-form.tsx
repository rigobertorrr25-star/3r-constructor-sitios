'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions';
import { t, type Lang } from '@/lib/i18n';
import { Alert, Field } from './ui';
import { SubmitButton } from './submit-button';

export function LoginForm({ lang }: { lang: Lang }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label={t(lang, 'password')} name="password" type="password" required autoComplete="current-password" autoFocus />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText={t(lang, 'signingIn')}>{t(lang, 'signIn')}</SubmitButton>
    </form>
  );
}
