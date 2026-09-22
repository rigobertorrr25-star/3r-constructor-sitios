'use client';

import { cancelOrderAction } from '@/app/actions';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  return (
    <form
      action={cancelOrderAction}
      onSubmit={(event) => {
        if (!window.confirm('¿Cancelar este pedido? Aún no has pagado, así que no se cobra nada.')) event.preventDefault();
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        className="rounded-full border border-white/[0.1] px-4 py-2 text-[13.5px] text-muted-foreground transition hover:bg-destructive/10 hover:text-[#ffb4b5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        Cancelar pedido
      </button>
    </form>
  );
}
