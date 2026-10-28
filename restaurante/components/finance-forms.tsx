'use client';

import { useState } from 'react';
import { addExpenseAction, voidExpenseAction } from '@/app/actions';
import { formatCop } from '@/lib/format';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select } from './ui';
import { useT } from './i18n';
import { PaidFromFields } from './paid-from-fields';

const CATEGORIES: [string, string][] = [
  ['suppliers', 'Proveedores'],
  ['packaging', 'Bolsas y empaques'],
  ['payroll', 'Nómina'],
  ['rent', 'Arriendo'],
  ['utilities', 'Servicios públicos'],
  ['maintenance', 'Mantenimiento'],
  ['marketing', 'Publicidad'],
  ['taxes', 'Impuestos'],
  ['other', 'Otros'],
];

export function ExpenseForm({ today }: { today: string }) {
  const t = useT();
  return (
    <ActionForm action={addExpenseAction} resetOnOk className="grid gap-3 md:grid-cols-3">
      {(state) => (
        <>
          <Select label={t('Tipo')} name="category" defaultValue={state?.values?.category ?? 'suppliers'}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </Select>
          <Field label={t('Valor')} name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <Field label={t('Fecha')} name="spentOn" type="date" required defaultValue={state?.values?.spentOn ?? today} />
          <div className="md:col-span-2">
            <Field label={t('Descripción')} name="description" required minLength={3} maxLength={200} placeholder={t('Factura de carnes de la semana')} defaultValue={state?.values?.description} />
          </div>
          <Field label={t('Proveedor (opcional)')} name="supplier" maxLength={120} defaultValue={state?.values?.supplier} />
          <Field label={t('Número de factura (opcional)')} name="invoiceNumber" maxLength={40} defaultValue={state?.values?.invoiceNumber} />
          <PaidFromFields defaultValue={state?.values?.paidFrom ?? 'other'} dueOn={state?.values?.dueOn} />
          <div className="md:col-span-3">
            <SubmitButton pendingText={t('Guardando…')}>{t('Registrar gasto')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

type Row = {
  id: string;
  categoryLabel: string;
  kind: 'supplies' | 'expense';
  description: string;
  supplier: string | null;
  amount: number;
  spentOn: string;
  paidFromCash: boolean;
  /** Null: por pagar. */
  paidFrom?: string | null;
  invoiceNumber?: string | null;
  dueOn?: string | null;
  createdBy: string;
  locationName: string;
  voided: boolean;
  voidReason: string | null;
  hasPhoto: boolean;
};

// De dónde salió la plata, como sale en la lista (lib/finance.ts PAID_FROM_LABEL; aquí sin importar el servidor).
const PAID_FROM_SHORT: Record<string, string> = { cash: 'de la caja', safe: 'de la caja fuerte', kitchen: 'del sobre de la cocina', bar: 'del sobre del bar', other: 'pagado aparte' };

export function ExpenseRow({ expense: e, showLocation }: { expense: Row; showLocation: boolean }) {
  const [voiding, setVoiding] = useState(false);
  const t = useT();
  return (
    <li className="px-4 py-3 text-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={e.voided ? 'line-through opacity-50' : ''}>
          <span className="font-medium">{e.description}</span> · {e.kind === 'supplies' ? t('Insumos') : t('Gasto')} · {e.categoryLabel}
          {e.supplier ? ` · ${e.supplier}` : ''}
          <span className="block text-[12.5px] text-muted-foreground no-underline">
            {e.spentOn} · {e.createdBy}
            {e.invoiceNumber ? ` · ${t('Factura {n}', { n: e.invoiceNumber })}` : ''}
            {e.paidFrom === null ? (
              <span className="text-warning"> · {e.dueOn ? t('por pagar, vence {date}', { date: e.dueOn }) : t('por pagar')}</span>
            ) : e.paidFrom ? (
              ` · ${t(PAID_FROM_SHORT[e.paidFrom] ?? '')}`
            ) : e.paidFromCash ? (
              t(' · de la caja')
            ) : (
              ''
            )}
            {showLocation ? ` · ${e.locationName}` : ''}
            {e.hasPhoto ? (
              <>
                {' · '}
                <a href={`/app/facturas/compra/${e.id}`} target="_blank" rel="noreferrer" className="text-primary underline">
                  {t('Ver factura')}
                </a>
              </>
            ) : null}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className={e.voided ? 'opacity-50' : ''}>{formatCop(e.amount)}</span>
          {!e.voided ? (
            <button type="button" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]" onClick={() => setVoiding(!voiding)}>
              {t('Anular')}
            </button>
          ) : (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[12px] text-[#ffb4b5]">{t('Anulado')}</span>
          )}
        </span>
      </div>
      {e.voidReason ? <p className="text-[12.5px] text-muted-foreground">{t('Motivo: {reason}', { reason: e.voidReason })}</p> : null}
      {voiding ? (
        <ActionForm action={voidExpenseAction} onOk={() => setVoiding(false)} className="mt-2 flex flex-wrap items-end gap-2">
          {() => (
            <>
              <input type="hidden" name="expenseId" value={e.id} />
              <div className="min-w-[200px] flex-1">
                <Field label={t('Motivo')} name="reason" required minLength={3} maxLength={200} placeholder={t('Registrado dos veces…')} />
              </div>
              <SubmitButton tone="danger" pendingText={t('Anulando…')}>
                {t('Anular gasto')}
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
