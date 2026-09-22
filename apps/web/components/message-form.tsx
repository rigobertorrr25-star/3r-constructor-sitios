'use client';

import { useActionState, useEffect, useRef } from 'react';
import { adminEventAction, sendMessageAction } from '@/app/actions';
import { CheckField, TextAreaField } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

/** Caja de mensajes del pedido. El equipo además puede dejar notas internas que el cliente no ve. */
export function MessageForm({ orderId, admin = false }: { orderId: string; admin?: boolean }) {
  const [state, action] = useActionState(admin ? adminEventAction : sendMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Al enviarse bien, se vacía el formulario.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <TextAreaField
        label={admin ? 'Escribir al cliente' : 'Escríbenos'}
        name="body"
        required
        maxLength={2000}
        rows={3}
        defaultValue={state?.values?.body}
        placeholder={admin ? 'Un mensaje para el cliente, o una nota interna…' : 'Cuéntanos qué necesitas o qué quieres cambiar…'}
      />
      {admin ? <CheckField name="internal" label="Nota interna" hint="El cliente no la verá." /> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <div className="sm:w-[200px]">
        <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
      </div>
    </form>
  );
}
