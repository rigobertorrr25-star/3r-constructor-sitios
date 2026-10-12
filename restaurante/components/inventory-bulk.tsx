'use client';

import { useState } from 'react';
import { bulkStockAction, inventoryFromMenuAction } from '@/app/actions';
import { formatCop } from '@/lib/format';
import { useT } from './i18n';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';

type Category = { id: string; name: string; products: number; withoutRecipe: number };
type Row = { id: string; name: string; unit: 'g' | 'ml' | 'und'; bottleSize: number | null; stock: number; unitCost: number; minStock: number };

const inputClass =
  'w-full min-w-[84px] rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none';

/** En qué se cuenta cada insumo: unidades, botellas, kilos o litros. */
const factor = (r: Pick<Row, 'unit' | 'bottleSize'>) => r.bottleSize ?? (r.unit === 'und' ? 1 : 1000);
const countLabel = (r: Pick<Row, 'unit' | 'bottleSize'>) => (r.bottleSize ? 'botellas' : r.unit === 'und' ? 'und' : r.unit === 'g' ? 'kg' : 'L');
const round = (n: number) => Number(n.toFixed(2));

/** Arma el inventario desde la carta: un insumo por producto, y cada venta descuenta 1. */
export function InventoryFromMenu({ categories, open = false }: { categories: Category[]; open?: boolean }) {
  const t = useT();
  const pending = categories.filter((c) => c.withoutRecipe > 0);
  // Abierto solo al llegar sin inventario; después no se cierra solo (así se ve el mensaje de «Listo»).
  const [startOpen] = useState(open && pending.length > 0);
  return (
    <details className="group rounded-[22px] border border-white/[0.08] bg-card p-5" open={startOpen}>
      <summary className="cursor-pointer list-none font-display text-[18px] font-bold">
        {t('Crear inventario desde la carta')}
        <span className="mt-1 block font-sans text-[13.5px] font-normal text-muted-foreground">
          {t('Cada producto de las categorías que marques queda como insumo, con el mismo nombre y en unidades. Cada vez que se vende uno, se descuenta 1.')}
        </span>
      </summary>
      {pending.length === 0 ? (
        <p className="mt-4 text-[14px] text-muted-foreground">{t('Todos los productos de la carta ya descuentan inventario.')}</p>
      ) : (
        <ActionForm action={inventoryFromMenuAction} className="mt-4 space-y-4">
          {() => (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:border-white/[0.16]">
                    <input type="checkbox" name="categoryId" value={c.id} defaultChecked className="size-4 accent-[#8a9bff]" />
                    <span>
                      <span className="block text-[14.5px] font-medium">{c.name}</span>
                      <span className="text-[12.5px] text-muted-foreground">{t('{n} productos sin inventario', { n: c.withoutRecipe })}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                {t('Los cócteles y lo que lleva varios ingredientes es mejor dejarlos sin marcar: su receta se arma en Carta → Receta.')}
              </p>
              <SubmitButton pendingText={t('Creando…')}>{t('Crear inventario')}</SubmitButton>
            </>
          )}
        </ActionForm>
      )}
    </details>
  );
}

/** Una tabla con todos los insumos para escribir de una vez lo que hay, lo que costó y el mínimo. */
export function BulkStock({ items }: { items: Row[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <details className="rounded-[22px] border border-white/[0.08] bg-card p-5">
      <summary className="cursor-pointer list-none font-display text-[18px] font-bold">
        {t('Cargar existencias de una vez')}
        <span className="mt-1 block font-sans text-[13.5px] font-normal text-muted-foreground">
          {t('Escribe solo lo que quieras cambiar. «Hay» queda como un conteo; el costo es lo que pagas por una (unidad, botella, kilo o litro).')}
        </span>
      </summary>
      <ActionForm action={bulkStockAction} resetOnOk className="mt-4 space-y-4">
        {(state) => (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
              <table className="w-full min-w-[620px] text-left text-[14px]">
                <thead className="text-[12.5px] text-muted-foreground">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-2.5 font-medium">{t('Insumo')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('Hay')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('Costo de una')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('Mínimo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {items.map((i) => {
                    const f = factor(i);
                    const u = t(countLabel(i));
                    return (
                      <tr key={i.id}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{i.name}</span>
                          <span className="block text-[12px] text-muted-foreground">
                            {t('ahora: {n} {unit}', { n: round(i.stock / f).toLocaleString('es-CO'), unit: u })}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input className={inputClass} name={`count:${i.id}`} inputMode="decimal" placeholder={u} defaultValue={state?.values?.[`count:${i.id}`]} aria-label={t('{item}: cuántas hay', { item: i.name })} />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClass}
                            name={`cost:${i.id}`}
                            inputMode="numeric"
                            placeholder={i.unitCost ? formatCop(i.unitCost * f) : '$'}
                            defaultValue={state?.values?.[`cost:${i.id}`]}
                            aria-label={t('{item}: costo de una', { item: i.name })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClass}
                            name={`min:${i.id}`}
                            inputMode="decimal"
                            placeholder={i.minStock ? String(round(i.minStock / f)) : '—'}
                            defaultValue={state?.values?.[`min:${i.id}`]}
                            aria-label={t('{item}: mínimo', { item: i.name })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <SubmitButton pendingText={t('Guardando…')}>{t('Guardar todo')}</SubmitButton>
          </>
        )}
      </ActionForm>
    </details>
  );
}
