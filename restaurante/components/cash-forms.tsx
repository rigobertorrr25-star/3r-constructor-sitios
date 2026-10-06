'use client';

import { closeShiftAction, movementAction, openShiftAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea } from './ui';
import { useT } from './i18n';

export function OpenShiftForm() {
  const t = useT();
  return (
    <ActionForm action={openShiftAction}>
      {(state) => (
        <>
          <Field label={t('Base en efectivo')} name="openingAmount" inputMode="numeric" placeholder="200000" defaultValue={state?.values?.openingAmount} hint={t('La plata con la que arranca la caja (para dar vueltas).')} />
          <SubmitButton pendingText={t('Abriendo…')}>{t('Abrir caja')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MovementForm() {
  const t = useT();
  return (
    <ActionForm action={movementAction} resetOnOk className="grid gap-3 sm:grid-cols-[140px_1fr]">
      {(state) => (
        <>
          <Select label={t('Tipo')} name="kind" defaultValue={state?.values?.kind ?? 'out'}>
            <option value="out">{t('Sale')}</option>
            <option value="in">{t('Entra')}</option>
          </Select>
          <Field label={t('Valor')} name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <div className="sm:col-span-2">
            <Field label={t('Motivo')} name="reason" required minLength={3} maxLength={200} placeholder={t('Pago del hielo, cambio que trajo el dueño…')} defaultValue={state?.values?.reason} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton tone="quiet" pendingText={t('Guardando…')}>
              {t('Registrar')}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function CloseShiftForm() {
  const t = useT();
  return (
    <ActionForm action={closeShiftAction}>
      {(state) => (
        <>
          <Field label={t('Efectivo contado')} name="countedCash" inputMode="numeric" required defaultValue={state?.values?.countedCash} />
          <TextArea label={t('Nota (opcional)')} name="notes" maxLength={300} placeholder={t('Si no cuadra, ¿por qué?')} defaultValue={state?.values?.notes} />
          <SubmitButton pendingText={t('Cerrando…')}>{t('Cerrar caja')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
