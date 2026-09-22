'use client';

import { useActionState } from 'react';
import { resendVerificationAction } from '@/app/actions';

export function ResendVerificationButton({ className }: { className?: string }) {
  const [state, action] = useActionState(resendVerificationAction, undefined);

  if (state?.ok) {
    return <p className={className ?? 'text-[13px] text-[#9df0c6]'}>Te reenviamos el enlace. Revisa tu correo.</p>;
  }

  return (
    <form action={action}>
      <button
        type="submit"
        className={className ?? 'text-[13px] font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]'}
      >
        Reenviar correo de verificación
      </button>
      {state?.error ? <p className="mt-1 text-[12.5px] text-[#ffb4b5]">{state.error}</p> : null}
    </form>
  );
}
