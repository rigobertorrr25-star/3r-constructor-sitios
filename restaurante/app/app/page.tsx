import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listTables } from '@/lib/store';
import { sessionTotals } from '@/lib/orders';
import { readyToServe } from '@/lib/kds';
import { AutoRefresh } from '@/components/auto-refresh';
import { TableBoard, type BoardTable } from '@/components/table-board';
import { Empty, PageTitle } from '@/components/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TablesPage() {
  const staff = await requireStaff('tables.view');
  const tables = await listTables(staff);
  const [totals, ready] = await Promise.all([
    sessionTotals(staff.businessId, tables.flatMap((t) => (t.session ? [t.session.id] : []))),
    can(staff.role, 'tickets.deliver') ? readyToServe(staff) : Promise.resolve([]),
  ]);
  const board: BoardTable[] = tables.map((t) => ({
    ...t,
    session: t.session
      ? { ...t.session, openedAt: t.session.openedAt.toISOString(), billAt: t.session.billAt?.toISOString() ?? null, total: totals.get(t.session.id) ?? 0 }
      : null,
  }));
  const open = tables.filter((t) => t.session).length;
  return (
    <div className="space-y-6">
      <AutoRefresh everyMs={10_000} />
      <PageTitle title="Mesas" text={tables.length ? `${open} de ${tables.length} ocupadas` : undefined} />
      {tables.length === 0 ? (
        <Empty>
          Esta sede todavía no tiene mesas.{' '}
          {can(staff.role, 'floor.edit') ? (
            <Link href="/app/plano" className="text-primary hover:underline">
              Arma el plano
            </Link>
          ) : (
            'Pídele al administrador que arme el plano.'
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
