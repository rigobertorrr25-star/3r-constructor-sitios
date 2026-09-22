'use client';

import { deletePortfolioAction } from '@/app/actions';

export function DeletePortfolioButton({ itemId, title }: { itemId: string; title: string }) {
  return (
    <form
      action={deletePortfolioAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Quitar "${title}" del portafolio?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-destructive/10 hover:text-[#ffb4b5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        Eliminar
      </button>
    </form>
  );
}
