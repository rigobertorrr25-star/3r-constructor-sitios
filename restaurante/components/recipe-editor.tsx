'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveRecipeAction } from '@/app/actions';
import { orOffline } from '@/lib/offline';
import { formatCop } from '@/lib/format';
import type { Unit } from '@/lib/units';
import { Alert, card, inputClass, primaryButton, quietButton } from './ui';

type Item = { id: string; name: string; unit: Unit; unitCost: number; bottleSize: number | null };
type Line = { itemId: string; quantity: string };

const num = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function RecipeEditor({ productId, price, initial, items }: { productId: string; price: number; initial: Line[]; items: Item[] }) {
  const [lines, setLines] = useState<Line[]>(initial.length ? initial : [{ itemId: '', quantity: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const byId = new Map(items.map((i) => [i.id, i]));
  const cost = lines.reduce((s, l) => s + num(l.quantity) * (byId.get(l.itemId)?.unitCost ?? 0), 0);
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
  const set = (i: number, patch: Partial<Line>) => (setSaved(false), setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l))));

  if (items.length === 0) {
    return (
      <p className="text-[15px] text-muted-foreground">
        Primero crea los insumos en{' '}
        <Link href="/app/inventario" className="text-primary hover:underline">
          Inventario
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className={card}>
        <ul className="space-y-3">
          {lines.map((l, i) => {
            const item = byId.get(l.itemId);
            return (
              <li key={i} className="grid grid-cols-[1fr_140px_auto] items-end gap-2">
                <div>
                  <label className="text-sm font-medium" htmlFor={`item-${i}`}>
                    Insumo
                  </label>
                  <select id={`item-${i}`} className={`${inputClass} mt-1.5`} value={l.itemId} onChange={(e) => set(i, { itemId: e.target.value })}>
                    <option value="">Elige…</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`qty-${i}`}>
                    Cantidad {item ? `(${item.unit})` : ''}
                  </label>
                  <input id={`qty-${i}`} className={`${inputClass} mt-1.5`} inputMode="decimal" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} placeholder={item?.bottleSize ? '45' : ''} />
                </div>
                <button type="button" className={`${quietButton} mb-1`} onClick={() => (setSaved(false), setLines((prev) => prev.filter((_, j) => j !== i)))} aria-label="Quitar">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={`${quietButton} mt-4`} onClick={() => setLines((prev) => [...prev, { itemId: '', quantity: '' }])}>
          + Otro insumo
        </button>
        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {saved ? (
          <div className="mt-4">
            <Alert tone="ok">Receta guardada.</Alert>
          </div>
        ) : null}
        <button
          type="button"
          className={`${primaryButton} mt-5`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await orOffline(saveRecipeAction(productId, lines.filter((l) => l.itemId)));
              if (result) setError(result);
              else setSaved(true);
            })
          }
        >
          {pending ? 'Guardando…' : 'Guardar receta'}
        </button>
      </section>
      <aside className={`${card} space-y-2 text-[15px]`}>
        <p className="flex justify-between">
          <span className="text-muted-foreground">Precio de venta</span> {formatCop(price)}
        </p>
        <p className="flex justify-between">
          <span className="text-muted-foreground">Costo de insumos</span> {formatCop(cost)}
        </p>
        <p className="flex justify-between font-semibold">
          <span>Margen</span>
          <span className={margin < 50 ? 'text-warning' : 'text-success'}>
            {formatCop(price - cost)} ({Math.round(margin)} %)
          </span>
        </p>
        <p className="pt-2 text-[12.5px] text-muted-foreground">El costo usa el promedio de las compras de cada insumo.</p>
      </aside>
    </div>
  );
}
