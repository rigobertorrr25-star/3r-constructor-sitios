'use client';

import { useState } from 'react';
import { payExpenseAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select } from './ui';
import { useT } from './i18n';

// Formulario diario de Rigoberto (28 oct 2026): de dónde salió la plata de cada factura, o si queda por pagar con su
// fecha de vencimiento. «Caja» sale de la caja abierta como una salida de efectivo.
const OPTIONS: [string, string][] = [
  ['cash', 'Caja (sale de la caja abierta)'],
  ['safe', 'Caja fuerte'],
  ['kitchen', 'Sobre de la cocina'],
  ['bar', 'Sobre del bar'],
  ['other', 'Otro'],
  ['unpaid', 'Todavía no se paga (por pagar)'],
];

export function PaidFromFields({ defaultValue = 'cash', dueOn }: { defaultValue?: string; dueOn?: string }) {
  const t = useT();
  const [source, setSource] = useState(defaultValue);
  return (
    <>
      <Select label={t('¿De dónde salió la plata?')} name="paidFrom" value={source} onChange={(e) => setSource(e.target.value)}>
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {t(l)}
          </option>
        ))}
      </Select>
      {source === 'unpaid' ? <Field label={t('Fecha de vencimiento')} name="dueOn" type="date" defaultValue={dueOn} /> : null}
    </>
  );
}

/** «Marcar pagada» de una factura por pagar: de dónde salió la plata y listo. */
export function PayExpenseForm({ expenseId }: { expenseId: string }) {
  const t = useT();
  return (
    <ActionForm action={payExpenseAction} className="flex flex-wrap items-end gap-2">
      {() => (
        <>
          <input type="hidden" name="expenseId" value={expenseId} />
          <div className="min-w-[180px]">
            <Select label={t('Se pagó de')} name="paidFrom" defaultValue="cash">
              {OPTIONS.filter(([v]) => v !== 'unpaid').map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </Select>
          </div>
          <SubmitButton tone="quiet" pendingText={t('Guardando…')}>
            {t('Marcar pagada')}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
