'use client';

import { useState } from 'react';
import { addExpenseAction, voidExpenseAction } from '@/app/actions';
import { formatCop } from '@/lib/format';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field, Select } from './ui';

const CATEGORIES: [string, string][] = [
  ['suppliers', 'Proveedores'],
  ['payroll', 'Nómina'],
  ['rent', 'Arriendo'],
  ['utilities', 'Servicios públicos'],
  ['maintenance', 'Mantenimiento'],
  ['marketing', 'Publicidad'],
  ['taxes', 'Impuestos'],
  ['other', 'Otros'],
];

export function ExpenseForm({ today }: { today: string }) {
  return (
    <ActionForm action={addExpenseAction} resetOnOk className="grid gap-3 md:grid-cols-3">
      {(state) => (
        <>
          <Select label="Tipo" name="category" defaultValue={state?.values?.category ?? 'suppliers'}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Field label="Valor" name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <Field label="Fecha" name="spentOn" type="date" required defaultValue={state?.values?.spentOn ?? today} />
          <div className="md:col-span-2">
            <Field label="Descripción" name="description" required minLength={3} maxLength={200} placeholder="Factura de carnes de la semana" defaultValue={state?.values?.description} />
          </div>
          <Field label="Proveedor (opcional)" name="supplier" maxLength={120} defaultValue={state?.values?.supplier} />
          <div className="md:col-span-3">
            <CheckField name="paidFromCash" label="Lo pagué con la plata de la caja" hint="Sale de la caja abierta como una salida de efectivo." />
          </div>
          <div className="md:col-span-3">
            <SubmitButton pendingText="Guardando…">Registrar gasto</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

type Row = {
  id: string;
  categoryLabel: string;
  description: string;
  supplier: string | null;
  amount: number;
  spentOn: string;
  paidFromCash: boolean;
  createdBy: string;
  locationName: string;
  voided: boolean;
  voidReason: string | null;
};

export function ExpenseRow({ expense: e, showLocation }: { expense: Row; showLocation: boolean }) {
  const [voiding, setVoiding] = useState(false);
  return (
    <li className="px-4 py-3 text-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={e.voided ? 'line-through opacity-50' : ''}>
          <span className="font-medium">{e.description}</span> · {e.categoryLabel}
          {e.supplier ? ` · ${e.supplier}` : ''}
          <span className="block text-[12.5px] text-muted-foreground no-underline">
            {e.spentOn} · {e.createdBy}
            {e.paidFromCash ? ' · de la caja' : ''}
            {showLocation ? ` · ${e.locationName}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className={e.voided ? 'opacity-50' : ''}>{formatCop(e.amount)}</span>
          {!e.voided ? (
            <button type="button" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]" onClick={() => setVoiding(!voiding)}>
              Anular
            </button>
          ) : (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[12px] text-[#ffb4b5]">Anulado</span>
          )}
        </span>
      </div>
      {e.voidReason ? <p className="text-[12.5px] text-muted-foreground">Motivo: {e.voidReason}</p> : null}
      {voiding ? (
        <ActionForm action={voidExpenseAction} onOk={() => setVoiding(false)} className="mt-2 flex flex-wrap items-end gap-2">
          {() => (
            <>
              <input type="hidden" name="expenseId" value={e.id} />
              <div className="min-w-[200px] flex-1">
                <Field label="Motivo" name="reason" required minLength={3} maxLength={200} placeholder="Registrado dos veces…" />
              </div>
              <SubmitButton tone="danger" pendingText="Anulando…">
                Anular gasto
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
