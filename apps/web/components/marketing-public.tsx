'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeAction, unsubscribeAction, type MarketingResult } from '@/app/empresa/marketing-actions';
import { CheckField, Field } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

/** Formulario público para recibir las promociones de una empresa. */
export function SubscribeForm({ token, companyName }: { token: string; companyName: string }) {
  const [state, action] = useActionState<MarketingResult, FormData>(subscribeAction.bind(null, token), undefined);
  if (state?.ok) {
    return (
      <div className="space-y-2">
        <p className="font-display text-[20px] font-semibold text-foreground">¡Listo, ya estás en la lista!</p>
        <p className="text-[15px] text-foreground/85">
          Te llegarán las promociones y novedades de {companyName}. Cada correo trae un enlace para darte de baja cuando quieras.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <Field label="Tu nombre" name="name" required minLength={2} maxLength={150} autoComplete="name" />
      <Field label="Tu correo" name="email" type="email" required maxLength={255} autoComplete="email" />
      <CheckField
        name="consent"
        required
        label={`Acepto recibir promociones y novedades de ${companyName} en este correo`}
        hint="Puedes darte de baja cuando quieras con el enlace que trae cada correo."
      />
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Guardando…">Suscribirme</SubmitButton>
    </form>
  );
}

/** Botón para darse de baja (no se hace solo al abrir el enlace: algunos correos abren los enlaces para revisarlos). */
export function UnsubscribeButton({ token, companyName }: { token: string; companyName: string }) {
  const router = useRouter();
  const [result, setResult] = useState<MarketingResult>(undefined);
  const [pending, start] = useTransition();
  if (result?.ok) {
    return <p className="text-[15.5px] text-foreground/90">Listo. Ya no te llegarán más correos de promociones de {companyName}.</p>;
  }
  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await unsubscribeAction(token);
            setResult(r);
            if (r?.ok) router.refresh();
          })
        }
        className="rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-50"
      >
        {pending ? 'Un momento…' : 'Sí, no quiero recibir más correos'}
      </button>
      {result && !result.ok ? <Alert>{result.error}</Alert> : null}
    </div>
  );
}
