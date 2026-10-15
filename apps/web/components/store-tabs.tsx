import Link from 'next/link';

const TABS = [
  ['', 'Pedidos'],
  ['/productos', 'Productos'],
  ['/cupones', 'Cupones'],
  ['/ajustes', 'Ajustes'],
] as const;

export function StoreTabs({ companyId, active }: { companyId: string; active: '' | '/productos' | '/cupones' | '/ajustes' }) {
  return (
    <nav aria-label="Tienda" className="flex flex-wrap gap-1">
      {TABS.map(([path, label]) => (
        <Link
          key={path}
          href={`/empresa/${companyId}/tienda${path}`}
          aria-current={active === path ? 'page' : undefined}
          className={`rounded-full px-4 py-2 text-[14px] transition ${active === path ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
