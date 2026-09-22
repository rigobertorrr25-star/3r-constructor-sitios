'use client';

import { deleteSiteAction } from '@/app/actions';

export function DeleteSiteButton({ siteId, name }: { siteId: string; name: string }) {
  return (
    <form
      action={deleteSiteAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Eliminar "${name}"? Se borrarán sus páginas y no se puede deshacer.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-destructive/10 hover:text-[#ffb4b5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        Eliminar
      </button>
    </form>
  );
}
