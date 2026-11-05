'use client';

import { formatCop } from '@/lib/format';
import { useT } from './i18n';

export type StockItem = { id: string; name: string; unit: 'g' | 'ml' | 'und'; bottleSize: number | null };
type Unit = StockItem['unit'];

/** Un producto de la factura: lo que dijo la IA (orig) y a qué insumo va (choice: id del insumo, 'new' o 'skip'). */
export type Line = { key: string; orig: { name: string; quantity: number; unit: Unit }; choice: string; name: string; unit: Unit; quantity: string; total: string };

const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isBottle = (item: StockItem | undefined) => Boolean(item && item.unit === 'ml' && item.bottleSize);

/** La cantidad de la factura pasada a como se cuenta el insumo (las botellas, en botellas). */
function convert(orig: Line['orig'], item: StockItem | undefined): number {
  if (!item) return orig.quantity;
  if (isBottle(item)) return orig.unit === 'ml' ? Math.round((orig.quantity / item.bottleSize!) * 100) / 100 : orig.quantity;
  return orig.quantity;
}

/** Las líneas que leyó la IA, cada una ya apuntando al insumo que se llama igual (o a uno nuevo). */
export function linesFromReading(list: { name: string; quantity: number; unit: Unit; total: number | null }[], items: StockItem[]): Line[] {
  return list.map((l, i) => {
    const match = items.find((it) => key(it.name) === key(l.name));
    const orig = { name: l.name, quantity: l.quantity, unit: l.unit };
    return {
      key: `${Date.now()}-${i}`,
      orig,
      choice: match ? match.id : 'new',
      name: l.name,
      unit: l.unit,
      quantity: String(convert(orig, match)),
      total: l.total ? String(l.total) : '',
    };
  });
}

/** Lo que se manda al guardar: cantidad en la unidad del insumo (las botellas pasan a ml). Null si falta algo. */
export function linesToSave(lines: Line[], items: StockItem[]): { lines: unknown[]; missing: string | null } {
  const out: unknown[] = [];
  for (const l of lines) {
    if (l.choice === 'skip') continue;
    const item = items.find((it) => it.id === l.choice);
    const q = Number(l.quantity.replace(',', '.'));
    const total = Number(l.total.replace(/[^\d]/g, ''));
    if (!(q > 0) || !l.total.trim()) return { lines: [], missing: item?.name ?? l.name };
    const quantity = isBottle(item) ? q * item!.bottleSize! : q;
    out.push(item ? { itemId: item.id, quantity, total } : { newName: l.name.trim(), newUnit: l.unit, quantity, total });
  }
  return { lines: out, missing: null };
}

/** Un producto para escribir a mano (lo que la IA no leyó). */
export const blankLine = (): Line => ({ key: `${Date.now()}-${Math.random()}`, orig: { name: '', quantity: 0, unit: 'und' }, choice: 'new', name: '', unit: 'und', quantity: '', total: '' });

const inputClass = 'w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[14px] text-foreground focus:border-primary/60 focus:outline-none';

/** Facturas de compra → «¿Qué entra al inventario?»: cada producto de la factura, a qué insumo va, cuánto y cuánto costó. */
export function PurchaseLines({ lines, items, onChange, amount }: { lines: Line[]; items: StockItem[]; onChange: (lines: Line[]) => void; amount: number }) {
  const t = useT();
  const set = (k: string, patch: Partial<Line>) => onChange(lines.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const unitLabel = (u: Unit) => (u === 'g' ? t('gramos') : u === 'ml' ? t('mililitros') : t('unidades'));
  const sum = lines.filter((l) => l.choice !== 'skip').reduce((s, l) => s + (Number(l.total.replace(/[^\d]/g, '')) || 0), 0);
  return (
    <div className="space-y-3 md:col-span-3">
      <div>
        <p className="text-sm font-medium">{t('¿Qué entra al inventario?')}</p>
        <p className="text-[13px] text-muted-foreground">
          {t('Cada producto suma a las existencias de la sede y actualiza su costo. Revisa a qué insumo va; lo que no se guarda en inventario márcalo «No va al inventario».')}
        </p>
      </div>
      <ul className="space-y-2">
        {lines.map((l) => {
          const item = items.find((it) => it.id === l.choice);
          const shownUnit = isBottle(item) ? t('botellas') : unitLabel(item?.unit ?? l.unit);
          const mismatch = item && !isBottle(item) && item.unit !== l.orig.unit;
          return (
            <li key={l.key} className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 ${l.choice === 'skip' ? 'opacity-60' : ''}`}>
              {l.orig.name ? (
                <p className="mb-2 text-[13px] text-muted-foreground">
                  {t('En la factura: {name} · {qty} {unit}', { name: l.orig.name, qty: l.orig.quantity.toLocaleString('es-CO'), unit: l.orig.unit })}
                </p>
              ) : null}
              <select
                aria-label={t('Insumo')}
                className={inputClass}
                value={l.choice}
                onChange={(e) => {
                  const choice = e.target.value;
                  const next = items.find((it) => it.id === choice);
                  set(l.key, { choice, quantity: String(convert(l.orig, next)), unit: next?.unit ?? l.orig.unit });
                }}
              >
                <option value="new">{t('Crear insumo nuevo')}</option>
                <option value="skip">{t('No va al inventario')}</option>
                <optgroup label={t('Insumos')}>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {l.choice === 'new' ? (
                <div className="mt-2 grid grid-cols-[2fr_1fr] gap-2">
                  <input aria-label={t('Nombre del insumo nuevo')} placeholder={t('Nombre del insumo nuevo')} className={inputClass} value={l.name} maxLength={80} onChange={(e) => set(l.key, { name: e.target.value })} />
                  <select aria-label={t('Se cuenta en')} className={inputClass} value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value as Unit })}>
                    <option value="und">{t('unidades')}</option>
                    <option value="g">{t('gramos')}</option>
                    <option value="ml">{t('mililitros')}</option>
                  </select>
                </div>
              ) : null}
              {l.choice === 'skip' ? null : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[12px] text-muted-foreground">{t('Cantidad ({unit})', { unit: shownUnit })}</span>
                    <input aria-label={t('Cantidad')} className={inputClass} inputMode="decimal" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[12px] text-muted-foreground">{t('Valor pagado')}</span>
                    <input aria-label={t('Valor')} className={inputClass} inputMode="numeric" value={l.total} onChange={(e) => set(l.key, { total: e.target.value })} />
                  </label>
                </div>
              )}
              {mismatch ? (
                <p className="mt-2 text-[12.5px] text-warning">
                  {t('Este insumo se cuenta en {unit}: escribe la cantidad en {unit}.', { unit: unitLabel(item!.unit) })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className="text-[13.5px] text-primary underline" onClick={() => onChange([...lines, blankLine()])}>
        {t('+ Agregar otro producto')}
      </button>
      {amount > 0 && sum > 0 ? (
        <p className="text-[12.5px] text-muted-foreground">{t('Suma de los productos: {sum} de {total} de la factura.', { sum: formatCop(sum), total: formatCop(amount) })}</p>
      ) : null}
    </div>
  );
}
