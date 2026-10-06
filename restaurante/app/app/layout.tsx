import { staffLogoutAction } from '@/app/actions';
import { requireStaff } from '@/lib/auth';
import { pendingCounts } from '@/lib/kds';
import { ROLE_LABEL, can, ownStation, type Permission } from '@/lib/permissions';
import type { Station } from '@/lib/stations';
import { AppNav } from '@/components/app-nav';
import { ConnectionBanner } from '@/components/connection-banner';
import Link from 'next/link';
import { Lion, quietButton } from '@/components/ui';
import { hasPrinter, stuckJobs } from '@/lib/printing';
import { BackgroundLayer } from '@/components/background-forms';
import { backgroundUrl } from '@/lib/background-url';

const LINKS: { href: string; label: string; permission: Permission; station?: Station }[] = [
  { href: '/app/tablero', label: 'Tablero', permission: 'finance.view' },
  { href: '/app', label: 'Mesas', permission: 'tables.view' },
  { href: '/app/cocina', label: 'Cocina', permission: 'kds.view', station: 'kitchen' },
  { href: '/app/barra', label: 'Barra', permission: 'kds.view', station: 'bar' },
  { href: '/app/reservas', label: 'Reservas', permission: 'reservations.manage' },
  { href: '/app/agenda', label: 'Agenda', permission: 'agenda.view' },
  { href: '/app/caja', label: 'Caja', permission: 'cash.operate' },
  { href: '/app/finanzas', label: 'Finanzas', permission: 'finance.view' },
  { href: '/app/facturas', label: 'Facturas', permission: 'invoices.manage' },
  { href: '/app/carta', label: 'Carta', permission: 'orders.take' },
  { href: '/app/inventario', label: 'Inventario', permission: 'inventory.view' },
  { href: '/app/plano', label: 'Plano', permission: 'floor.edit' },
  { href: '/app/equipo', label: 'Equipo', permission: 'staff.manage' },
  { href: '/app/sedes', label: 'Sedes', permission: 'locations.manage' },
  { href: '/app/qr', label: 'QR y enlaces', permission: 'locations.manage' },
  { href: '/app/impresoras', label: 'Impresoras', permission: 'printers.manage' },
  { href: '/app/auditoria', label: 'Auditoría', permission: 'audit.view' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const own = ownStation(staff.role);
  const visible = LINKS.filter((l) => can(staff.role, l.permission) && (!own || !l.station || l.station === own));
  const counts = visible.some((l) => l.station) ? await pendingCounts(staff) : {};
  // Si la estación imprime sus comandas, nadie las marca en pantalla: el contador no diría nada útil.
  const printed = { kitchen: await hasPrinter(staff, 'kitchen'), bar: await hasPrinter(staff, 'bar') };
  const links = visible.map(({ href, label, station }) => ({ href, label, badge: station && !printed[station] ? (counts[station] ?? 0) : 0 }));
  // Comandas que no han salido en la impresora: casi siempre es el computador de impresión apagado.
  const stuck = await stuckJobs(staff);
  return (
    <div className="relative isolate min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <BackgroundLayer url={backgroundUrl(staff.businessSlug, staff.background)} strength="strong" />
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
      {stuck ? (
        <div role="alert" className="border-b border-destructive/30 bg-destructive/15 px-4 py-2.5 text-center text-[14px] text-[#ffd0d0]">
          {stuck === 1 ? 'Hay 1 papel' : `Hay ${stuck} papeles`} sin imprimir: revisa que el computador de impresión esté prendido y las impresoras con papel.
          {can(staff.role, 'printers.manage') ? (
            <>
              {' '}
              <Link href="/app/impresoras" className="underline">
                Ver impresoras
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
      <main className="mx-auto max-w-[1280px] px-4 py-6 pb-16 sm:px-6">{children}</main>
      <ConnectionBanner />
    </div>
  );
}
