import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { MOVEMENT_LABEL, getItem, listMovements } from '@/lib/inventory';
import { can } from '@/lib/permissions';
import { formatCop, formatDateTime } from '@/lib/format';
import { formatQuantity } from '@/lib/units';
import { ItemForm } from '@/components/inventory-forms';
import { PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff('inventory.view');
  const { id } = await params;
  const item = await getItem(staff, id);
  if (!item) notFound();
  const moves = await listMovements(staff, { itemId: id, limit: 200 });
  return (
    <div className="space-y-6">
      <Link href="/app/inventario" className="text-[14px] text-muted-foreground hover:text-foreground">
        ← Inventario
      </Link>
      <PageTitle title={item.name} text={`Hay ${formatQuantity(item.stock, item.unit, item.bottleSize)} en ${staff.locationName}.`} />
      {can(staff.role, 'inventory.manage') ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Datos del insumo</h2>
          <div className="mt-4">
            <ItemForm item={{ ...item }} />
          </div>
        </section>
      ) : null}
      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">Movimientos</h2>
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card text-[14px]">
          {moves.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <span>
                {MOVEMENT_LABEL[m.kind] ?? m.kind}
                {m.kind === 'count' && m.expected !== null && m.counted !== null ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · debía haber {formatQuantity(m.expected, m.unit, item.bottleSize)}, se contó {formatQuantity(m.counted, m.unit, item.bottleSize)}
                  </span>
                ) : null}
                {m.reason ? <span className="text-muted-foreground"> · {m.reason}</span> : null}
                <span className="block text-[12.5px] text-muted-foreground">
                  {formatDateTime(m.createdAt, staff.timezone)}
                  {m.createdBy ? ` · ${m.createdBy}` : ''} · {formatCop(Math.abs(m.quantity) * m.unitCost)}
                </span>
              </span>
              <span className={m.quantity < 0 ? 'text-[#ffb4b5]' : 'text-success'}>
                {m.quantity > 0 ? '+' : ''}
                {formatQuantity(m.quantity, m.unit)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
