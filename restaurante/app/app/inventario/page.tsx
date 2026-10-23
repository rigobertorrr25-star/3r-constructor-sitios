import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { AREA_LABEL, MOVEMENT_LABEL, listItems, listMovements, type Area } from '@/lib/inventory';
import { can } from '@/lib/permissions';
import { formatCop, formatDateTime } from '@/lib/format';
import { formatQuantity } from '@/lib/units';
import { InventoryActions, ItemForm } from '@/components/inventory-forms';
import { BulkStock, InventoryFromMenu } from '@/components/inventory-bulk';
import { menuForInventory } from '@/lib/inventory-bulk';
import { RecipeImport } from '@/components/recipe-import';
import { Empty, PageTitle, card } from '@/components/ui';
import { makeT, tr } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
// Leer recetas de un PDF o fotos con IA puede tardar más de lo normal.
export const maxDuration = 60;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const staff = await requireStaff('inventory.view');
  // Barra y cocina cuentan cada una lo suyo: el bartender entra a Barra y cocina a Cocina; los demás ven todo.
  const { area: areaParam } = await searchParams;
  const area: Area | 'all' =
    areaParam === 'barra' ? 'bar' : areaParam === 'cocina' ? 'kitchen' : areaParam === 'todo' ? 'all' : staff.role === 'bar' ? 'bar' : staff.role === 'kitchen' ? 'kitchen' : 'all';
  const manage = can(staff.role, 'inventory.manage');
  const load = can(staff.role, 'inventory.load');
  const lang = await getLang();
  const t = makeT(lang);
  const qty = (...args: Parameters<typeof formatQuantity>) => tr(lang, formatQuantity(...args));
  const [allItems, moves, menu] = await Promise.all([listItems(staff), listMovements(staff, { limit: 40 }), load ? menuForInventory(staff) : Promise.resolve([])]);
  const items = area === 'all' ? allItems : allItems.filter((i) => i.area === area);
  const count = (a: Area) => allItems.filter((i) => i.isActive && i.area === a).length;
  const tabs: [string, Area | 'all', string][] = [
    ['todo', 'all', t('Todo')],
    ['barra', 'bar', t('Barra · {n}', { n: count('bar') })],
    ['cocina', 'kitchen', t('Cocina · {n}', { n: count('kitchen') })],
  ];
  const active = items.filter((i) => i.isActive);
  const value = active.reduce((s, i) => s + Math.max(0, i.stock) * i.unitCost, 0);
  const low = active.filter((i) => i.minStock > 0 && i.stock < i.minStock);
  return (
    <div className="space-y-6">
      <PageTitle
        title={t('Inventario')}
        text={t('Sede {location}. Cada venta descuenta sola lo que diga la receta del producto. Nada se borra: los errores se corrigen con un conteo.', { location: staff.locationName })}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map(([param, a, label]) => (
          <Link
            key={a}
            href={`/app/inventario?area=${param}`}
            className={`rounded-full px-4 py-1.5 text-[14px] ${area === a ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {manage ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/[0.08] bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{t('Valor del inventario')}</p>
            <p className="mt-1 font-display text-[22px] font-bold">{formatCop(value)}</p>
          </div>
          <div className={`rounded-[22px] border bg-card p-4 ${low.length ? 'border-warning/60' : 'border-white/[0.08]'}`}>
            <p className="text-[13px] text-muted-foreground">{t('Por debajo del mínimo')}</p>
            <p className="mt-1 font-display text-[22px] font-bold">{low.length}</p>
            {low.length ? <p className="text-[12.5px] text-warning">{low.map((l) => l.name).join(', ')}</p> : null}
          </div>
          <div className="rounded-[22px] border border-white/[0.08] bg-card p-4">
            <p className="text-[13px] text-muted-foreground">{t('Insumos')}</p>
            <p className="mt-1 font-display text-[22px] font-bold">{active.length}</p>
          </div>
        </div>
      ) : null}

      {load ? (
        <>
          <InventoryFromMenu categories={menu} open={allItems.length === 0} />
          {manage ? <RecipeImport /> : null}
          <BulkStock showCost={manage} items={active.map((i) => ({ id: i.id, name: i.name, unit: i.unit, bottleSize: i.bottleSize, stock: i.stock, unitCost: i.unitCost, minStock: i.minStock }))} />
        </>
      ) : null}

      <section className={card}>
        <InventoryActions items={active.map((i) => ({ id: i.id, name: i.name, unit: i.unit, bottleSize: i.bottleSize }))} manage={manage} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[19px] font-bold">{t('Existencias')}</h2>
        {items.length === 0 ? (
          <Empty>{manage ? t('Crea tus insumos abajo (Whisky en ml, Carne en g, Limones en unidades…).') : t('Todavía no hay insumos.')}</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[22px] border border-white/[0.08] bg-card">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="text-[12.5px] text-muted-foreground">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-medium">{t('Insumo')}</th>
                  <th className="px-4 py-3 font-medium">{t('Hay')}</th>
                  <th className="px-4 py-3 font-medium">{t('Mínimo')}</th>
                  {manage ? <th className="px-4 py-3 font-medium">{t('Costo')}</th> : null}
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
                        {area === 'all' ? <span className="ml-2 text-[12px] text-muted-foreground">{t(AREA_LABEL[i.area])}</span> : null}
                        {i.isActive ? null : <span className="ml-2 text-[12px] text-muted-foreground">{t('inactivo')}</span>}
                      </td>
                      <td className={`px-4 py-2.5 ${isLow ? 'font-semibold text-warning' : i.stock < 0 ? 'text-[#ffb4b5]' : ''}`}>{qty(i.stock, i.unit, i.bottleSize)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{i.minStock ? qty(i.minStock, i.unit, i.bottleSize) : '—'}</td>
                      {manage ? (
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatCop(i.unitCost * (i.bottleSize ?? (i.unit === 'und' ? 1 : 1000)))} / {i.bottleSize ? t('botella') : i.unit === 'und' ? t('und') : i.unit === 'g' ? 'kg' : 'L'}
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
          <h2 className="font-display text-[18px] font-bold">{t('Nuevo insumo')}</h2>
          <div className="mt-4">
            <ItemForm area={area === 'all' ? undefined : area} />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[19px] font-bold">{t('Últimos movimientos')}</h2>
          {manage ? (
            <Link href="/app/inventario/movimientos" className="text-[14px] text-primary hover:underline">
              {t('Ver todos, por persona y por día →')}
            </Link>
          ) : null}
        </div>
        {moves.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{t('Nada todavía.')}</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[22px] border border-white/[0.08] bg-card text-[14px]">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium">{m.itemName}</span> · {MOVEMENT_LABEL[m.kind] ? t(MOVEMENT_LABEL[m.kind]) : m.kind}
                  {m.reason ? <span className="text-muted-foreground"> · {tr(lang, m.reason)}</span> : null}
                  <span className="block text-[12.5px] text-muted-foreground">
                    {formatDateTime(m.createdAt, staff.timezone, lang)}
                    {m.createdBy ? ` · ${m.createdBy}` : ''}
                  </span>
                </span>
                <span className={m.quantity < 0 ? 'text-[#ffb4b5]' : 'text-success'}>
                  {m.quantity > 0 ? '+' : ''}
                  {qty(m.quantity, m.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
