import Link from 'next/link';

const TABS = [
  ['', 'Pedidos'],
  ['/productos', 'Productos'],
  ['/cupones', 'Cupones'],
  ['/ajustes', 'Ajustes'],
] as const;

export function StoreTabs({ companyId, active }: { companyId: string; active: '' | '/productos' | '/cupones' | '/ajustes' }) {
  return (
    // En celular, una sola fila que se desliza (no se parte en dos renglones).
    <nav aria-label="Tienda" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {TABS.map(([path, label]) => (
        <Link
          key={path}
          href={`/empresa/${companyId}/tienda${path}`}
          aria-current={active === path ? 'page' : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-[14px] transition ${active === path ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
