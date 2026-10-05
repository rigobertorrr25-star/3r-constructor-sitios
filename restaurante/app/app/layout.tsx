import { staffLogoutAction } from '@/app/actions';
import { requireStaff } from '@/lib/auth';
import { pendingCounts } from '@/lib/kds';
import { ROLE_LABEL, can, ownStation, type Permission } from '@/lib/permissions';
import type { Station } from '@/lib/stations';
import { AppNav } from '@/components/app-nav';
import { ConnectionBanner } from '@/components/connection-banner';
import { Lion, quietButton } from '@/components/ui';

const LINKS: { href: string; label: string; permission: Permission; station?: Station }[] = [
  { href: '/app/tablero', label: 'Tablero', permission: 'finance.view' },
  { href: '/app', label: 'Mesas', permission: 'tables.view' },
  { href: '/app/cocina', label: 'Cocina', permission: 'kds.view', station: 'kitchen' },
  { href: '/app/barra', label: 'Barra', permission: 'kds.view', station: 'bar' },
  { href: '/app/reservas', label: 'Reservas', permission: 'reservations.manage' },
  { href: '/app/caja', label: 'Caja', permission: 'cash.operate' },
  { href: '/app/finanzas', label: 'Finanzas', permission: 'finance.view' },
  { href: '/app/carta', label: 'Carta', permission: 'orders.take' },
  { href: '/app/inventario', label: 'Inventario', permission: 'inventory.view' },
  { href: '/app/plano', label: 'Plano', permission: 'floor.edit' },
  { href: '/app/equipo', label: 'Equipo', permission: 'staff.manage' },
  { href: '/app/sedes', label: 'Sedes', permission: 'locations.manage' },
  { href: '/app/qr', label: 'QR y enlaces', permission: 'locations.manage' },
  { href: '/app/auditoria', label: 'Auditoría', permission: 'audit.view' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const own = ownStation(staff.role);
  const visible = LINKS.filter((l) => can(staff.role, l.permission) && (!own || !l.station || l.station === own));
  const counts = visible.some((l) => l.station) ? await pendingCounts(staff) : {};
  const links = visible.map(({ href, label, station }) => ({ href, label, badge: station ? (counts[station] ?? 0) : 0 }));
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
        <AppNav links={links} />
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 pb-16 sm:px-6">{children}</main>
      <ConnectionBanner />
    </div>
  );
}
