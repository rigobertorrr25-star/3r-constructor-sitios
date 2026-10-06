'use client';

import { useState } from 'react';
import { inventoryMoveAction, saveItemAction } from '@/app/actions';
import type { Unit } from '@/lib/units';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field, Select } from './ui';

type Option = { id: string; name: string; unit: Unit; bottleSize: number | null };

const KINDS = [
  { kind: 'purchase', label: 'Compra', manage: true },
  { kind: 'waste', label: 'Merma', manage: false },
  { kind: 'count', label: 'Conteo', manage: true },
] as const;

/** Registrar compra, merma o conteo físico de un insumo. */
export function InventoryActions({ items, manage }: { items: Option[]; manage: boolean }) {
  const kinds = KINDS.filter((k) => manage || !k.manage);
  const [kind, setKind] = useState<(typeof KINDS)[number]['kind']>(kinds[0].kind);
  const [itemId, setItemId] = useState('');
  const item = items.find((i) => i.id === itemId);
  if (items.length === 0) return <p className="text-[14px] text-muted-foreground">Cuando haya insumos, aquí registras compras, mermas y conteos.</p>;
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Movimiento" className="flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button
            key={k.kind}
            role="tab"
            aria-selected={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={`rounded-full px-4 py-1.5 text-[14px] ${kind === k.kind ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground'}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <ActionForm key={kind} action={inventoryMoveAction} resetOnOk onOk={() => setItemId('')} className="grid gap-3 md:grid-cols-2">
        {(state) => (
          <>
            <input type="hidden" name="kind" value={kind} />
            <Select label="Insumo" name="itemId" required value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="" disabled>
                Elige un insumo
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.bottleSize ? 'botella' : i.unit})
                </option>
              ))}
            </Select>
            {kind === 'purchase' ? (
              <>
                <Field label={`Cantidad que entra${item ? ` (${item.unit})` : ''}`} name="quantity" inputMode="decimal" required defaultValue={state?.values?.quantity} hint={item?.bottleSize ? `Una botella = ${item.bottleSize} ml` : undefined} />
                <Field label="Valor pagado por todo" name="total" inputMode="numeric" required defaultValue={state?.values?.total} />
                <Field label="Proveedor o nota (opcional)" name="reason" maxLength={200} defaultValue={state?.values?.reason} />
              </>
            ) : null}
            {kind === 'waste' ? (
              <>
                <Field label={`Cantidad perdida${item ? ` (${item.unit})` : ''}`} name="quantity" inputMode="decimal" required defaultValue={state?.values?.quantity} />
                <div className="md:col-span-2">
                  <Field label="¿Qué pasó?" name="reason" required minLength={3} maxLength={200} placeholder="Se cayó, se dañó, se venció…" defaultValue={state?.values?.reason} />
                </div>
              </>
            ) : null}
            {kind === 'count' ? (
              <>
                <Field
                  label={item?.bottleSize ? 'Botellas que hay (2,3 = dos llenas y 30 % de otra)' : `Lo que hay de verdad${item ? ` (${item.unit})` : ''}`}
                  name="counted"
                  inputMode="decimal"
                  required
                  defaultValue={state?.values?.counted}
                />
                {item?.bottleSize ? <input type="hidden" name="inBottles" value="on" /> : null}
                <div className="md:col-span-2">
                  <Field label="Nota (opcional)" name="reason" maxLength={200} placeholder="Conteo del cierre del domingo" defaultValue={state?.values?.reason} />
                </div>
              </>
            ) : null}
            <div className="md:col-span-2">
              <SubmitButton pendingText="Guardando…">Registrar {KINDS.find((k) => k.kind === kind)!.label.toLowerCase()}</SubmitButton>
            </div>
          </>
        )}
      </ActionForm>
    </div>
  );
}

export function ItemForm({ item }: { item?: { id: string; name: string; unit: Unit; minStock: number; bottleSize: number | null; unitCost: number; isActive: boolean } }) {
  const [unit, setUnit] = useState<Unit>(item?.unit ?? 'g');
  return (
    <ActionForm action={saveItemAction} resetOnOk={!item} className="grid gap-3 md:grid-cols-2">
      {(state) => (
        <>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <Field label="Nombre" name="name" required maxLength={80} defaultValue={state?.values?.name ?? item?.name} />
          <Select label="Se mide en" name="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="g">Gramos (carne, harina…)</option>
            <option value="ml">Mililitros (licores, salsas…)</option>
            <option value="und">Unidades (limones, panes…)</option>
          </Select>
          {unit === 'ml' ? (
            <Field label="Tamaño de la botella en ml (si es licor)" name="bottleSize" inputMode="decimal" placeholder="750" defaultValue={state?.values?.bottleSize ?? item?.bottleSize ?? ''} hint="Así el conteo se hace en botellas." />
          ) : null}
          <Field label={`Mínimo (${unit})`} name="minStock" inputMode="decimal" defaultValue={state?.values?.minStock ?? item?.minStock ?? ''} hint="Por debajo, aparece la alerta." />
          {item ? (
            <>
              <Field label={`Costo por ${unit}`} name="unitCost" inputMode="decimal" defaultValue={item.unitCost ? Number(item.unitCost.toFixed(4)) : ''} hint="Se calcula solo con las compras; cámbialo solo si está mal." />
              <CheckField name="isActive" label="Activo" defaultChecked={item.isActive} />
            </>
          ) : null}
          <div className="md:col-span-2">
            <SubmitButton pendingText="Guardando…">{item ? 'Guardar' : 'Crear insumo'}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
