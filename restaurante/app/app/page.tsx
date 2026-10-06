import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listTables } from '@/lib/store';
import { sessionTotals } from '@/lib/orders';
import { readyToServe } from '@/lib/kds';
import { heldTables } from '@/lib/reservations';
import { AutoRefresh } from '@/components/auto-refresh';
import { TableBoard, type BoardTable } from '@/components/table-board';
import { Empty, PageTitle } from '@/components/ui';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function TablesPage() {
  const staff = await requireStaff('tables.view');
  const t = await getT();
  const tables = await listTables(staff);
  const [totals, ready, held] = await Promise.all([
    sessionTotals(staff.businessId, tables.flatMap((tb) => (tb.session ? [tb.session.id] : []))),
    can(staff.role, 'tickets.deliver') ? readyToServe(staff) : Promise.resolve([]),
    heldTables(staff),
  ]);
  const board: BoardTable[] = tables.map((tb) => ({
    ...tb,
    // Libre pero apartada por una reserva confirmada que está por llegar.
    status: tb.status === 'free' && held.has(tb.id) ? 'reserved' : tb.status,
    reservedFor: held.has(tb.id) ? { ...held.get(tb.id)!, startsAt: held.get(tb.id)!.startsAt.toISOString() } : null,
    session: tb.session
      ? { ...tb.session, openedAt: tb.session.openedAt.toISOString(), billAt: tb.session.billAt?.toISOString() ?? null, total: totals.get(tb.session.id) ?? 0 }
      : null,
  }));
  const open = tables.filter((tb) => tb.session).length;
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={10_000} />
      <PageTitle title={t('Mesas')} text={tables.length ? t('{open} de {total} ocupadas', { open, total: tables.length }) : undefined} />
      {tables.length === 0 ? (
        <Empty>
          {t('Esta sede todavía no tiene mesas.')}{' '}
          {can(staff.role, 'floor.edit') ? (
            <Link href="/app/plano" className="text-primary hover:underline">
              {t('Arma el plano')}
            </Link>
          ) : (
            t('Pídele al administrador que arme el plano.')
          )}
        </Empty>
      ) : (
        <TableBoard
          tables={board}
          ready={ready.map((r) => ({ ...r, readyAt: r.readyAt.toISOString() }))}
          canOpen={can(staff.role, 'tables.open')}
          canClose={can(staff.role, 'tables.close')}
          timeZone={staff.timezone}
        />
      )}
    </div>
  );
}
