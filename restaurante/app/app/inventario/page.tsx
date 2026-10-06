import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { MOVEMENT_LABEL, listItems, listMovements } from '@/lib/inventory';
import { can } from '@/lib/permissions';
import { formatCop, formatDateTime } from '@/lib/format';
import { formatQuantity } from '@/lib/units';
import { InventoryActions, ItemForm } from '@/components/inventory-forms';
import { Empty, PageTitle, card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const staff = await requireStaff('inventory.view');
  const manage = can(staff.role, 'inventory.manage');
  const [items, moves] = await Promise.all([listItems(staff), listMovements(staff, { limit: 40 })]);
  const active = items.filter((i) => i.isActive);
  const value = active.reduce((s, i) => s + Math.max(0, i.stock) * i.unitCost, 0);
  const low = active.filter((i) => i.minStock > 0 && i.stock < i.minStock);
  return (
    <div className="space-y-6">
      <PageTitle
        title="Inventario"
        text={`Sede ${staff.locationName}. Cada venta descuenta sola lo que diga la receta del producto. Nada se borra: los errores se corrigen con un conteo.`}
      />
      {manage ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/[0.08] bg-card p-4">
            <p className="text-[13px] text-muted-foreground">Valor del inventario</p>
            <p className="mt-1 font-display text-[22px] font-bold">{formatCop(value)}</p>
          </div>
          <div className={`rounded-[22px] border bg-card p-4 ${low.length ? 'border-warning/60' : 'border-white/[0.08]'}`}>
            <p className="text-[13px] text-muted-foreground">Por debajo del mínimo</p>
            <p className="mt-1 font-display text-[22px] font-bold">{low.length}</p>
            {low.length ? <p className="text-[12.5px] text-warning">{low.map((l) => l.name).join(', ')}</p> : null}
          </div>
          <div className="rounded-[22px] border border-white/[0.08] bg-card p-4">
            <p className="text-[13px] text-muted-foreground">Insumos</p>
            <p className="mt-1 font-display text-[22px] font-bold">{active.length}</p>
          </div>
        </div>
      ) : null}

      <section className={card}>
        <InventoryActions items={active.map((i) => ({ id: i.id, name: i.name, unit: i.unit, bottleSize: i.bottleSize }))} manage={manage} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">Existencias</h2>
        {items.length === 0 ? (
          <Empty>{manage ? 'Crea tus insumos abajo (Whisky en ml, Carne en g, Limones en unidades…).' : 'Todavía no hay insumos.'}</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[22px] border border-white/[0.08] bg-card">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="text-[12.5px] text-muted-foreground">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-medium">Insumo</th>
                  <th className="px-4 py-3 font-medium">Hay</th>
                  <th className="px-4 py-3 font-medium">Mínimo</th>
                  {manage ? <th className="px-4 py-3 font-medium">Costo</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {items.map((i) => {
                  const isLow = i.isActive && i.minStock > 0 && i.stock < i.minStock;
                  return (
                    <tr key={i.id} className={i.isActive ? '' : 'opacity-50'}>
                      <td className="px-4 py-2.5">
                        <Link href={`/app/inventario/${i.id}`} className="font-medium hover:text-primary">
                          {i.name}
                        </Link>
                        {i.isActive ? null : <span className="ml-2 text-[12px] text-muted-foreground">inactivo</span>}
                      </td>
                      <td className={`px-4 py-2.5 ${isLow ? 'font-semibold text-warning' : i.stock < 0 ? 'text-[#ffb4b5]' : ''}`}>{formatQuantity(i.stock, i.unit, i.bottleSize)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{i.minStock ? formatQuantity(i.minStock, i.unit, i.bottleSize) : '—'}</td>
                      {manage ? (
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatCop(i.unitCost * (i.bottleSize ?? (i.unit === 'und' ? 1 : 1000)))} / {i.bottleSize ? 'botella' : i.unit === 'und' ? 'und' : i.unit === 'g' ? 'kg' : 'L'}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {manage ? (
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Nuevo insumo</h2>
          <div className="mt-4">
            <ItemForm />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">Últimos movimientos</h2>
        {moves.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nada todavía.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card text-[14px]">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium">{m.itemName}</span> · {MOVEMENT_LABEL[m.kind] ?? m.kind}
                  {m.reason ? <span className="text-muted-foreground"> · {m.reason}</span> : null}
                  <span className="block text-[12.5px] text-muted-foreground">
                    {formatDateTime(m.createdAt, staff.timezone)}
                    {m.createdBy ? ` · ${m.createdBy}` : ''}
                  </span>
                </span>
                <span className={m.quantity < 0 ? 'text-[#ffb4b5]' : 'text-success'}>
                  {m.quantity > 0 ? '+' : ''}
                  {formatQuantity(m.quantity, m.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
