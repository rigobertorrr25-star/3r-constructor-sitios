import type { T } from '@/lib/i18n';

/** «Desde / Hasta» con su nombre a la vista (3 nov 2026). `keep`: lo que se mantiene al buscar (p. ej. la sede). */
export function DateRangeForm({ action, from, to, keep = {}, active, t }: { action: string; from: string; to: string; keep?: Record<string, string>; active: boolean; t: T }) {
  const field = 'rounded-full border border-white/[0.1] bg-transparent px-3 py-1.5 text-[14px] [color-scheme:dark]';
  return (
    <form action={action} className={`flex w-fit max-w-full flex-wrap items-end gap-2 rounded-2xl border px-3 py-2 ${active ? 'border-primary/60' : 'border-white/[0.08]'}`}>
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="flex flex-col gap-0.5 text-[12.5px] text-muted-foreground">
        {t('Desde')}
        <input type="date" name="desde" defaultValue={from} required className={field} />
      </label>
      <label className="flex flex-col gap-0.5 text-[12.5px] text-muted-foreground">
        {t('Hasta')}
        <input type="date" name="hasta" defaultValue={to} required className={field} />
      </label>
      <button className="rounded-full bg-primary px-4 py-1.5 text-[14px] font-medium text-primary-foreground">{t('Ver')}</button>
    </form>
  );
}
