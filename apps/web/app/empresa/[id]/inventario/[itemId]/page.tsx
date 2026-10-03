import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteItemAction } from '@/app/empresa/inventory-actions';
import { ItemForm, MovementForm } from '@/components/inventory-forms';
import { authedApi } from '@/lib/api';
import { formatMoney } from '@/lib/orders';
import { MOVE_LABEL, qtyText, type ItemDetail } from '@/lib/inventory';
import { loadCompany } from '../../company';

export const metadata: Metadata = { title: 'Producto — 3R' };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]';
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function ItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const res = await authedApi<ItemDetail>(`/companies/${id}/inventory/items/${itemId}`);
  if (!res.ok) notFound();
  const i = res.data;

  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/inventario`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Inventario
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-muted-foreground">{[i.category, i.sku, i.location].filter(Boolean).join(' · ') || 'Producto'}</p>
          <h2 className="mt-1 font-display text-[26px] font-bold tracking-tight text-foreground">{i.name}</h2>
          {!i.active ? <p className="text-[13px] text-muted-foreground">Inactivo</p> : null}
        </div>
        <div className="text-right">
          <p className={`font-display text-[34px] font-bold leading-none ${i.low ? 'text-[#ffd27a]' : 'text-foreground'}`}>
            {qtyText(i.stock)} <span className="text-[16px] font-normal text-muted-foreground">{i.unit}</span>
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {i.low ? 'Queda poco · ' : ''}
            {i.minStock != null ? `mínimo ${qtyText(i.minStock)}` : 'sin mínimo'}
            {i.cost != null ? ` · ${formatMoney(i.cost * 100, 'COP')} c/u` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className={card} aria-labelledby="h-movimientos">
          <h3 id="h-movimientos" className="mb-3 font-display text-[18px] font-semibold text-foreground">
            Movimientos
          </h3>
          {i.movements.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {i.movements.map((m) => (
                <li key={m.id} className="flex items-center gap-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] text-foreground">
                      {MOVE_LABEL[m.type]}
                      {m.note ? <span className="text-muted-foreground"> · {m.note}</span> : null}
                    </span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {[when.format(new Date(m.createdAt)), m.by].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-right text-[14px]">
                    <span
                      className={`block font-medium ${m.type === 'in' ? 'text-[#9df0c6]' : m.type === 'out' ? 'text-[#ffb4b5]' : 'text-foreground'}`}
                    >
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}
                      {qtyText(m.quantity)}
                    </span>
                    <span className="block text-[12px] text-muted-foreground">quedó en {qtyText(m.stockAfter)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-6">
          <section className={card} aria-labelledby="h-registrar">
            <h3 id="h-registrar" className="mb-4 font-display text-[18px] font-semibold text-foreground">
              Registrar
            </h3>
            <MovementForm companyId={id} item={i} />
          </section>
        </aside>
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-display text-[17px] font-semibold text-foreground">Editar el producto</summary>
        <div className="mt-5">
          <ItemForm companyId={id} item={i} categories={i.category ? [i.category] : []} />
        </div>
        <form action={deleteItemAction} className="mt-5">
          <input type="hidden" name="companyId" value={id} />
          <input type="hidden" name="itemId" value={i.id} />
          <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
            Borrar el producto y su historial
          </button>
        </form>
      </details>
    </div>
  );
}
