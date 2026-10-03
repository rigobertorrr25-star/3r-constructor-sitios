'use client';

import { useActionState, useState, type ReactNode } from 'react';
import {
  assignAssetAction,
  createAssetAction,
  createItemAction,
  moveItemAction,
  updateAssetAction,
  updateItemAction,
} from '@/app/empresa/inventory-actions';
import { UNITS, qtyText, type Asset, type InventoryItem } from '@/lib/inventory';
import { CheckField, Field, SelectField, TextAreaField, inputClass } from './field';
import { formKey } from './form-key';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

const pesos = (n: number | null | undefined) => (n == null ? '' : new Intl.NumberFormat('es-CO').format(n));
const qty = (n: number | null | undefined) => (n == null ? '' : qtyText(n));

/** Nuevo producto (sin `item`) o editar uno. */
export function ItemForm({ companyId, item, categories }: { companyId: string; item?: InventoryItem; categories: string[] }) {
  const [state, action] = useActionState(item ? updateItemAction : createItemAction, undefined);
  const v = state?.error ? state.values : undefined;
  return (
    <form action={action} className="space-y-5" key={formKey(item?.updatedAt ?? null, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" name="name" required minLength={2} maxLength={150} defaultValue={v?.name ?? item?.name} placeholder="Café en grano" />
        <div className="space-y-1.5">
          <label htmlFor="category" className="text-sm font-medium text-foreground">
            Categoría (opcional)
          </label>
          <input
            id="category"
            name="category"
            list="item-categories"
            maxLength={60}
            defaultValue={v?.category ?? item?.category ?? ''}
            placeholder="Insumos, Desechables, Aseo…"
            className={inputClass}
          />
          <datalist id="item-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <SelectField
          label="Se cuenta en"
          name="unit"
          defaultValue={v?.unit ?? item?.unit ?? 'unidad'}
          options={UNITS.map((u) => ({ value: u, label: u }))}
        />
        {item ? null : (
          <Field label="Cantidad que hay hoy" name="initialStock" inputMode="decimal" defaultValue={v?.initialStock ?? ''} placeholder="0" />
        )}
        <Field
          label="Avisar cuando queden menos de (opcional)"
          name="minStock"
          inputMode="decimal"
          defaultValue={v?.minStock ?? qty(item?.minStock)}
          placeholder="2"
        />
        <Field
          label="Costo de cada uno, en pesos (opcional)"
          name="cost"
          inputMode="numeric"
          defaultValue={v?.cost ?? pesos(item?.cost)}
          placeholder="48.000"
        />
        <Field label="Código (opcional)" name="sku" maxLength={60} defaultValue={v?.sku ?? item?.sku ?? ''} />
        <Field
          label="Dónde se guarda (opcional)"
          name="location"
          maxLength={100}
          defaultValue={v?.location ?? item?.location ?? ''}
          placeholder="Bodega, nevera 2…"
        />
      </div>
      <TextAreaField label="Notas" name="notes" rows={2} maxLength={2000} defaultValue={v?.notes ?? item?.notes ?? ''} />
      {item ? (
        <CheckField
          name="active"
          label="Activo"
          hint="Si ya no lo manejas, quítale la marca: deja de salir en la lista."
          defaultChecked={v ? v.active === 'on' : item.active}
        />
      ) : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{item ? 'Guardar cambios' : 'Guardar producto'}</SubmitButton>
    </form>
  );
}

/** Entrada, salida o conteo. */
export function MovementForm({ companyId, item }: { companyId: string; item: InventoryItem }) {
  const [state, action] = useActionState(moveItemAction, undefined);
  const [type, setType] = useState(state?.values?.type ?? 'out');
  return (
    <form action={action} className="space-y-4" key={state?.ok}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="itemId" value={item.id} />
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de movimiento">
        {(
          [
            ['in', 'Entró'],
            ['out', 'Salió'],
            ['count', 'Conteo'],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`cursor-pointer rounded-2xl border px-3 py-2.5 text-center text-[14px] transition ${
              type === value ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'
            }`}
          >
            <input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <Field
        label={type === 'count' ? `¿Cuánto hay contado? (${item.unit})` : `Cantidad (${item.unit})`}
        name="quantity"
        inputMode="decimal"
        required
        defaultValue={state?.error ? state.values?.quantity : ''}
      />
      <Field
        label="Nota (opcional)"
        name="note"
        maxLength={300}
        defaultValue={state?.error ? state.values?.note : ''}
        placeholder={type === 'in' ? 'Compra a proveedor' : type === 'out' ? 'Turno de la mañana' : 'Conteo de fin de mes'}
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Listo, quedó registrado.</Alert> : null}
      <SubmitButton pendingText="Registrando…">Registrar</SubmitButton>
    </form>
  );
}

/** Nuevo equipo (sin `asset`) o editar uno. */
export function AssetForm({ companyId, asset }: { companyId: string; asset?: Asset }) {
  const [state, action] = useActionState(asset ? updateAssetAction : createAssetAction, undefined);
  const v = state?.error ? state.values : undefined;
  return (
    <form action={action} className="space-y-5" key={formKey(asset?.updatedAt ?? null, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      {asset ? <input type="hidden" name="assetId" value={asset.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" name="name" required minLength={2} maxLength={150} defaultValue={v?.name ?? asset?.name} placeholder="Tablet de caja" />
        <Field label="Código o placa (opcional)" name="code" maxLength={60} defaultValue={v?.code ?? asset?.code ?? ''} placeholder="EQ-001" />
        <Field
          label="Categoría (opcional)"
          name="category"
          maxLength={60}
          defaultValue={v?.category ?? asset?.category ?? ''}
          placeholder="Tecnología, Uniformes, Llaves…"
        />
        <Field label="Serial (opcional)" name="serial" maxLength={100} defaultValue={v?.serial ?? asset?.serial ?? ''} />
        <Field
          label="Valor en pesos (opcional)"
          name="value"
          inputMode="numeric"
          defaultValue={v?.value ?? pesos(asset?.value)}
          placeholder="900.000"
        />
        <Field
          label="Fecha de compra (opcional)"
          name="purchasedAt"
          type="date"
          defaultValue={v?.purchasedAt ?? asset?.purchasedAt?.slice(0, 10) ?? ''}
        />
      </div>
      <TextAreaField label="Notas" name="notes" rows={2} maxLength={2000} defaultValue={v?.notes ?? asset?.notes ?? ''} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{asset ? 'Guardar cambios' : 'Guardar equipo'}</SubmitButton>
    </form>
  );
}

export function AssignForm({ companyId, asset, members }: { companyId: string; asset: Asset; members: { id: string; name: string }[] }) {
  const [state, action] = useActionState(assignAssetAction, undefined);
  const options = members.filter((m) => m.id !== asset.assignedMemberId);
  return (
    <form action={action} className="space-y-4" key={formKey(asset.updatedAt, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="assetId" value={asset.id} />
      <SelectField
        label="Entregárselo a"
        name="memberId"
        required
        defaultValue=""
        options={[{ value: '', label: 'Elige a alguien' }, ...options.map((m) => ({ value: m.id, label: m.name }))]}
      />
      <Field label="Nota (opcional)" name="note" maxLength={300} placeholder="Con cargador y forro" />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Entregando…">{asset.assignedMemberId ? 'Pasárselo a otra persona' : 'Entregar'}</SubmitButton>
    </form>
  );
}

/** Botón que abre y cierra un formulario. */
export function TogglePanel({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
      >
        {open ? 'Cerrar' : label}
      </button>
      {open ? <div className="mt-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">{children}</div> : null}
    </div>
  );
}
