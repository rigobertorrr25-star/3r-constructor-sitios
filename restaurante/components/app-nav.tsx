'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppNav({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Secciones" className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:flex-wrap lg:overflow-visible">
      {links.map((link) => {
        const active = link.href === '/app' ? path === '/app' : path.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] transition ${active ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {link.label}
            {link.badge ? <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[11.5px] font-semibold text-[#180613]">{link.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
