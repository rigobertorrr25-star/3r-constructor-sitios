import type { Metadata } from 'next';
import Link from 'next/link';
import { inputClass } from '@/components/field';
import { AssetForm, TogglePanel } from '@/components/inventory-forms';
import { InventoryTabs } from '@/components/inventory-tabs';
import { ModuleOff } from '@/components/module-off';
import { authedApi } from '@/lib/api';
import { ASSET_STATUS_LABEL, type AssetList, type AssetStatus } from '@/lib/inventory';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Equipos entregados — 3R' };

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[13px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;
const tone: Record<AssetStatus, string> = {
  available: 'bg-[#5ee0a0]/15 text-[#9df0c6]',
  assigned: 'bg-primary/15 text-foreground',
  repair: 'bg-[#ffd27a]/15 text-[#ffd27a]',
  retired: 'border border-white/[0.1] text-muted-foreground',
};

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { id } = await params;
  const { q = '', status = '' } = await searchParams;
  const { company } = await loadCompany(id);
  if (!company) return null;
  if (!company.modules.find((m) => m.key === 'inventory')?.enabled) {
    return (
      <ModuleOff
        companyName={company.name}
        name="Inventario"
        text="Lleva quién tiene cada equipo de la empresa, con su historial de entregas y devoluciones."
      />
    );
  }
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString();
  const { data } = await authedApi<AssetList>(`/companies/${id}/inventory/assets${qs ? `?${qs}` : ''}`);
  const base = `/empresa/${id}/inventario/activos`;
  const href = (s: string) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) }).toString();
    return p ? `${base}?${p}` : base;
  };

  const list = (
    <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
      {data.assets.map((a) => (
        <li key={a.id}>
          <Link
            href={`${base}/${a.id}`}
            className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-foreground">
                {a.name}
                {a.code ? <span className="text-muted-foreground"> · {a.code}</span> : null}
              </span>
              <span className="block truncate text-[12.5px] text-muted-foreground">
                {[a.category, a.serial ? `serial ${a.serial}` : null].filter(Boolean).join(' · ') || 'Sin categoría'}
              </span>
            </span>
            {data.manage && a.assignedTo ? <span className="text-[14px] text-foreground/90">{a.assignedTo}</span> : null}
            <span className={`w-fit rounded-full px-2.5 py-1 text-[12.5px] ${tone[a.status]}`}>{ASSET_STATUS_LABEL[a.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  if (!data.manage) {
    return (
      <section className="space-y-4" aria-labelledby="h-mios">
        <h2 id="h-mios" className="font-display text-[20px] font-semibold text-foreground">
          Equipos a tu cargo
        </h2>
        {data.assets.length ? (
          list
        ) : (
          <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
            No tienes equipos de la empresa a tu cargo.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <InventoryTabs companyId={id} active="assets" />
      <TogglePanel label="+ Nuevo equipo">
        <AssetForm companyId={id} />
      </TogglePanel>
      <form action={base} className="flex gap-2" role="search">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, código o serial"
          aria-label="Buscar equipos"
          className={inputClass}
        />
        <button type="submit" className="shrink-0 rounded-full bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground">
          Buscar
        </button>
      </form>
      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        <Link href={href('')} className={chip(!status)}>
          En uso
        </Link>
        {(['assigned', 'available', 'repair', 'retired'] as const).map((s) => (
          <Link key={s} href={href(s)} className={chip(status === s)}>
            {ASSET_STATUS_LABEL[s]} <span className="text-muted-foreground">{data.counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>
      {data.assets.length ? (
        list
      ) : (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          {q || status
            ? 'No hay equipos con ese filtro.'
            : 'Todavía no hay equipos. Registra los computadores, datáfonos, uniformes o llaves que le entregas al equipo.'}
        </p>
      )}
    </div>
  );
}
