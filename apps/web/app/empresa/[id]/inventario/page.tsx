import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { inputClass } from '@/components/field';
import { InventoryTabs } from '@/components/inventory-tabs';
import { ItemForm, TogglePanel } from '@/components/inventory-forms';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { atLeast } from '@/lib/companies';
import { formatMoney } from '@/lib/orders';
import { qtyText, type ItemList } from '@/lib/inventory';
import { loadCompany } from '../company';

export const metadata: Metadata = { title: 'Inventario — 3R' };

const card = 'rounded-[24px] border border-white/[0.08] bg-card p-5 shadow-[var(--shadow-glass)]';
const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { id } = await params;
  const { q = '', filter = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'inventory')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Inventario"
        text="Lleva lo que entra y sale de tus productos e insumos, con aviso cuando algo se está acabando, y quién tiene cada equipo de la empresa."
      />
    );
  }
  // El equipo solo ve los equipos que tiene a cargo.
  if (!atLeast(company.me.role, 'supervisor')) redirect(`/empresa/${id}/inventario/activos`);
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(filter ? { filter } : {}) }).toString();
  const { data } = await authedApi<ItemList>(`/companies/${id}/inventory/items${qs ? `?${qs}` : ''}`);
  const base = `/empresa/${id}/inventario`;
  const categories = [...new Set(data.items.map((i) => i.category).filter((c): c is string => !!c))];
  const href = (f: string) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(f ? { filter: f } : {}) }).toString();
    return p ? `${base}?${p}` : base;
  };

  return (
    <div className="space-y-6">
      <InventoryTabs companyId={id} active="items" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-[13px] text-muted-foreground">Productos</p>
          <p className="mt-1 font-display text-[26px] font-bold text-foreground">{data.totals.count}</p>
        </div>
        <Link href={href('low')} className={`${card} transition hover:border-white/[0.16]`}>
          <p className="text-[13px] text-muted-foreground">Con poco inventario</p>
          <p className={`mt-1 font-display text-[26px] font-bold ${data.totals.low ? 'text-[#ffd27a]' : 'text-foreground'}`}>{data.totals.low}</p>
        </Link>
        <div className={card}>
          <p className="text-[13px] text-muted-foreground">Valor en bodega</p>
          <p className="mt-1 font-display text-[26px] font-bold text-foreground">{formatMoney(data.totals.value * 100, 'COP')}</p>
        </div>
      </div>

      <TogglePanel label="+ Nuevo producto">
        <ItemForm companyId={id} categories={categories} />
      </TogglePanel>

      <form action={base} className="flex gap-2" role="search">
        {filter ? <input type="hidden" name="filter" value={filter} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, código o categoría"
          aria-label="Buscar productos"
          className={inputClass}
        />
        <button type="submit" className="shrink-0 rounded-full bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground">
          Buscar
        </button>
      </form>
      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        <Link href={href('')} className={chip(!filter)}>
          Activos
        </Link>
        <Link href={href('low')} className={chip(filter === 'low')}>
          Poco inventario
        </Link>
        <Link href={href('inactive')} className={chip(filter === 'inactive')}>
          Inactivos
        </Link>
      </nav>

      {data.items.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {q || filter
            ? 'No hay productos con ese filtro.'
            : 'Todavía no hay productos. Agrega lo que más usas: insumos, desechables, productos para la venta…'}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {data.items.map((i) => (
            <li key={i.id}>
              <Link href={`${base}/${i.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">{i.name}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {[i.category, i.sku, i.location, i.minStock != null ? `mínimo ${qtyText(i.minStock)}` : null].filter(Boolean).join(' · ') ||
                      'Sin categoría'}
                  </span>
                </span>
                <span className="text-right">
                  <span className={`block font-display text-[17px] font-semibold ${i.low ? 'text-[#ffd27a]' : 'text-foreground'}`}>
                    {qtyText(i.stock)} <span className="text-[13px] font-normal text-muted-foreground">{i.unit}</span>
                  </span>
                  {i.low ? <span className="block text-[12px] text-[#ffd27a]">Queda poco</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
