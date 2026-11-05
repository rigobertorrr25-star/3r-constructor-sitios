'use client';

import { useState, useTransition } from 'react';
import { bulkStockAction, inventoryFromMenuAction, readStockAction, type FormState } from '@/app/actions';
import type { StockReading } from '@/lib/ai-read';
import { formatCop } from '@/lib/format';
import { shrink } from './background-forms';
import { Alert, quietButton } from './ui';
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
export function BulkStock({
  items,
  showCost = true,
  area = 'all',
  canCreate = false,
}: {
  items: Row[];
  showCost?: boolean;
  /** La pestaña de Inventario: la IA solo busca insumos de esa área y los nuevos quedan en ella. */
  area?: 'bar' | 'kitchen' | 'all';
  /** Si puede crear los insumos nuevos que vea la IA (dueño y administrador). */
  canCreate?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<StockReading | null>(null);
  const [readState, setReadState] = useState<FormState>(undefined);
  const [photoError, setPhotoError] = useState('');
  const [busy, startReading] = useTransition();
  // Cambia cada vez que la IA llena la tabla, para que los campos tomen los valores nuevos.
  const [version, setVersion] = useState(0);
  if (!items.length && !canCreate) return null;
  const filled = new Map(reading?.found.map((f) => [f.itemId, f.count]) ?? []);

  async function pick(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, 4);
    if (!files.length) return;
    setPhotoError('');
    setReadState(undefined);
    const data = new FormData();
    data.set('area', area);
    try {
      // Grandes para que se lean las etiquetas; livianas para que suban rápido (4 fotos caben en el envío).
      for (const [n, f] of files.entries()) data.append('files', new File([await shrink(f, 1600)], `inventario-${n + 1}.jpg`, { type: 'image/jpeg' }));
    } catch {
      setPhotoError(t('No pudimos leer esa foto. Prueba con otra (JPG, PNG o WebP).'));
      return;
    }
    startReading(async () => {
      const result = await readStockAction(undefined, data);
      setReadState(result);
      if (result?.values?.reading) {
        try {
          setReading(JSON.parse(result.values.reading) as StockReading);
          setVersion((n) => n + 1);
        } catch {
          setReading(null);
        }
      }
    });
  }

  return (
    <details className="rounded-[22px] border border-white/[0.08] bg-card p-5" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer list-none font-display text-[18px] font-bold">
        {t('Cargar existencias de una vez')}
        <span className="mt-1 block font-sans text-[13.5px] font-normal text-muted-foreground">
          {showCost
            ? t('Escribe solo lo que quieras cambiar. «Hay» queda como un conteo; el costo es lo que pagas por una (unidad, botella, kilo o litro).')
            : t('Escribe solo lo que quieras cambiar. «Hay» queda como un conteo con tu nombre, y el administrador lo ve en los movimientos.')}
        </span>
      </summary>

      <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
        <p className="text-[14.5px] font-medium">{t('Llenar con una foto')}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t('Tómale foto a la nevera, la barra o la bodega, o a la hoja donde anotaron el conteo (hasta 4 fotos). La IA cuenta lo que ve y llena la tabla; tú revisas y guardas.')}
        </p>
        <label className={`${quietButton} mt-3 inline-flex cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => { void pick(e.currentTarget.files); e.currentTarget.value = ''; }} />
          {busy ? t('Leyendo la foto…') : t('Subir o tomar fotos')}
        </label>
        {photoError ? <div className="mt-3"><Alert>{photoError}</Alert></div> : null}
        {readState?.error ? <div className="mt-3"><Alert>{readState.error}</Alert></div> : null}
        {readState?.ok && readState.message ? <div className="mt-3"><Alert tone="ok">{readState.message}</Alert></div> : null}
      </div>

      <ActionForm key={version} action={bulkStockAction} resetOnOk onOk={() => { setReading(null); setReadState(undefined); }} className="mt-4 space-y-4">
        {(state) => (
          <>
            <input type="hidden" name="area" value={area} />
            {items.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
              <table className="w-full min-w-[620px] text-left text-[14px]">
                <thead className="text-[12.5px] text-muted-foreground">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-2.5 font-medium">{t('Insumo')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('Hay')}</th>
                    {showCost ? <th className="px-3 py-2.5 font-medium">{t('Costo de una')}</th> : null}
                    <th className="px-3 py-2.5 font-medium">{t('Mínimo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {items.map((i) => {
                    const f = factor(i);
                    const u = t(countLabel(i));
                    const fromPhoto = filled.get(i.id);
                    return (
                      <tr key={i.id} className={fromPhoto !== undefined ? 'bg-primary/[0.06]' : undefined}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{i.name}</span>
                          <span className="block text-[12px] text-muted-foreground">
                            {t('ahora: {n} {unit}', { n: round(i.stock / f).toLocaleString('es-CO'), unit: u })}
                            {fromPhoto !== undefined ? ` · ${t('leído de la foto')}` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClass}
                            name={`count:${i.id}`}
                            inputMode="decimal"
                            placeholder={u}
                            defaultValue={state?.values?.[`count:${i.id}`] ?? (fromPhoto !== undefined ? String(fromPhoto) : undefined)}
                            aria-label={t('{item}: cuántas hay', { item: i.name })}
                          />
                        </td>
                        {showCost ? (
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
                        ) : null}
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
            ) : null}
            {reading?.others.length ? (
              <div className="space-y-2 rounded-2xl border border-white/[0.08] p-4">
                <p className="text-[14.5px] font-medium">{t('Vimos esto y no está en tu inventario')}</p>
                <p className="text-[13px] text-muted-foreground">
                  {canCreate
                    ? t('Los marcados se crean como insumos nuevos con esa cantidad. Corrige el nombre si hace falta.')
                    : t('Pídele al dueño o al administrador que los cree.')}
                </p>
                {reading.others.map((o, n) =>
                  canCreate ? (
                    <div key={n} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_96px_96px]">
                      <label className="col-span-2 flex items-center gap-2 sm:col-span-1">
                        <input type="checkbox" name={`new:${n}:create`} defaultChecked className="size-4 shrink-0 accent-[#8a9bff]" aria-label={t('Crear {item}', { item: o.name })} />
                        <input className={inputClass} name={`new:${n}:name`} defaultValue={o.name} aria-label={t('Nombre del insumo')} />
                      </label>
                      <input className={inputClass} name={`new:${n}:count`} inputMode="decimal" defaultValue={String(o.count)} aria-label={t('Hay')} />
                      <select className={inputClass} name={`new:${n}:unit`} defaultValue={o.unit} aria-label={t('Unidad')}>
                        <option value="und">{t('und')}</option>
                        <option value="kg">{t('kg')}</option>
                        <option value="L">{t('L')}</option>
                      </select>
                    </div>
                  ) : (
                    <p key={n} className="text-[14px]">
                      {o.name}: {o.count.toLocaleString('es-CO')} {t(o.unit)}
                    </p>
                  ),
                )}
              </div>
            ) : null}
            {items.length || (canCreate && reading?.others.length) ? <SubmitButton pendingText={t('Guardando…')}>{t('Guardar todo')}</SubmitButton> : null}
          </>
        )}
      </ActionForm>
    </details>
  );
}
