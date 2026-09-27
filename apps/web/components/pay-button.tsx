'use client';

import { useActionState } from 'react';
import { payOrderAction } from '@/app/actions';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

/** Lleva al cliente al pago de Wompi por lo que falta de su pedido. */
export function PayButton({ orderId, amount }: { orderId: string; amount: string }) {
  const [state, action] = useActionState(payOrderAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Abriendo el pago…">Pagar {amount} en línea</SubmitButton>
      <p className="text-center text-[13px] text-muted-foreground">Tarjeta, PSE, Nequi y más, con el pago seguro de Wompi.</p>
    </form>
  );
}
