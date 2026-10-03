'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type NavLink = { href: string; label: string };
type NavGroup = { label: string | null; links: NavLink[] };

/**
 * Menú de la empresa, agrupado por área. En computador va a la izquierda; en celular es un menú que se abre
 * (con muchos módulos activos, una fila de pestañas ya no cabe).
 */
export function CompanyTabs({
  companyId,
  canEdit,
  modules = [],
}: {
  companyId: string;
  canEdit: boolean;
  modules?: { route: string; label: string; area: string }[];
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/empresa/${companyId}`;
  useEffect(() => setOpen(false), [path]);

  const byArea = (area: string) => modules.filter((m) => m.area === area).map((m) => ({ href: `${base}/${m.route}`, label: m.label }));
  const groups: NavGroup[] = [
    { label: null, links: [{ href: base, label: 'Inicio' }] },
    { label: 'Equipo y operación', links: byArea('empresa') },
    { label: 'Clientes y ventas', links: byArea('clientes') },
    { label: 'Web', links: byArea('web') },
    { label: 'Automatización', links: byArea('automatizacion') },
    { label: 'Inteligencia artificial', links: byArea('ia') },
    {
      label: 'Ajustes',
      links: [{ href: `${base}/equipo`, label: 'Personas y roles' }, ...(canEdit ? [{ href: `${base}/datos`, label: 'Datos de la empresa' }] : [])],
    },
  ].filter((g) => g.links.length > 0);
  const isActive = (href: string) => (href === base ? path === base : path === href || path.startsWith(`${href}/`));
  const current = groups.flatMap((g) => g.links).find((l) => isActive(l.href));

  const list = (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label ?? 'inicio'}>
          {g.label ? <p className="px-3 pb-1 text-[12px] text-muted-foreground">{g.label}</p> : null}
          <ul>
            {g.links.map((l) => {
              const active = isActive(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-xl px-3 py-2 text-[14.5px] transition ${active ? 'bg-primary/15 font-medium text-foreground' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <nav aria-label="Secciones de la empresa">
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-2xl border border-white/[0.1] bg-card px-4 py-3 text-[15px] text-foreground"
        >
          <span>
            <span className="text-muted-foreground">Sección: </span>
            {current?.label ?? 'Inicio'}
          </span>
          <span aria-hidden="true" className={`transition ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {open ? <div className="mt-2 rounded-2xl border border-white/[0.08] bg-card p-2">{list}</div> : null}
      </div>
      <div className="hidden lg:block">{list}</div>
    </nav>
  );
}
