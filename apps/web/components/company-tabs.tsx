'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CompanyTabs({
  companyId,
  canEdit,
  modules = [],
}: {
  companyId: string;
  canEdit: boolean;
  modules?: { route: string; label: string }[];
}) {
  const path = usePathname();
  const base = `/empresa/${companyId}`;
  const tabs = [
    { href: base, label: 'Inicio' },
    ...modules.map((m) => ({ href: `${base}/${m.route}`, label: m.label })),
    { href: `${base}/equipo`, label: 'Equipo' },
    ...(canEdit ? [{ href: `${base}/datos`, label: 'Datos de la empresa' }] : []),
  ];
  return (
    <nav aria-label="Secciones de la empresa" className="flex gap-1 overflow-x-auto border-b border-white/[0.08]">
      {tabs.map((tab) => {
        const active = tab.href === base ? path === base : path === tab.href || path.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-4 py-3 text-[14.5px] transition ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
