import { staffLogoutAction } from '@/app/actions';
import { requireStaff } from '@/lib/auth';
import { ROLE_LABEL, can, type Permission } from '@/lib/permissions';
import { AppNav } from '@/components/app-nav';
import { Lion, quietButton } from '@/components/ui';

const LINKS: { href: string; label: string; permission: Permission }[] = [
  { href: '/app', label: 'Mesas', permission: 'tables.view' },
  { href: '/app/carta', label: 'Carta', permission: 'orders.take' },
  { href: '/app/plano', label: 'Plano', permission: 'floor.edit' },
  { href: '/app/equipo', label: 'Equipo', permission: 'staff.manage' },
  { href: '/app/sedes', label: 'Sedes', permission: 'locations.manage' },
  { href: '/app/auditoria', label: 'Auditoría', permission: 'audit.view' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const links = LINKS.filter((l) => can(staff.role, l.permission)).map(({ href, label }) => ({ href, label }));
  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Lion size={34} />
            <div className="min-w-0">
              <p className="truncate font-display text-[15.5px] font-bold text-foreground">{staff.businessName}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {staff.locationCount > 1 ? `${staff.locationName} · ` : ''}
                {staff.name} · {ROLE_LABEL[staff.role]}
              </p>
            </div>
          </div>
          <form action={staffLogoutAction}>
            <button className={quietButton}>Salir</button>
          </form>
        </div>
        {links.length > 1 ? <AppNav links={links} /> : null}
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
