import Link from 'next/link';

/** Productos | Equipos, para quien maneja el inventario. */
export function InventoryTabs({ companyId, active }: { companyId: string; active: 'items' | 'assets' }) {
  const tab = (on: boolean) =>
    `rounded-full px-4 py-2 text-[14px] transition ${on ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'}`;
  return (
    <nav aria-label="Inventario" className="flex gap-1">
      <Link href={`/empresa/${companyId}/inventario`} className={tab(active === 'items')} aria-current={active === 'items' ? 'page' : undefined}>
        Productos e insumos
      </Link>
      <Link
        href={`/empresa/${companyId}/inventario/activos`}
        className={tab(active === 'assets')}
        aria-current={active === 'assets' ? 'page' : undefined}
      >
        Equipos entregados
      </Link>
    </nav>
  );
}
