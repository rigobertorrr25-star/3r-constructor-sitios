'use client';

import { useState, useTransition } from 'react';
import { addLossAction, closeShiftAction, movementAction, openShiftAction, voidLossAction } from '@/app/actions';
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

/** Caja → «Pérdidas del día»: lo que se rompió o se dañó y no es del inventario, con su valor estimado. */
export function LossForm() {
  const t = useT();
  return (
    <ActionForm action={addLossAction} resetOnOk className="grid gap-3 sm:grid-cols-[1fr_160px]">
      {(state) => (
        <>
          <Field label={t('¿Qué se perdió?')} name="description" required minLength={3} maxLength={200} placeholder={t('Se rompió un vaso, se dañó un plato…')} defaultValue={state?.values?.description} />
          <Field label={t('Valor estimado')} name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <div className="sm:col-span-2">
            <SubmitButton tone="quiet" pendingText={t('Guardando…')}>
              {t('Anotar pérdida')}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** «Anular» una pérdida mal anotada. */
export function VoidLossButton({ lossId }: { lossId: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        className="text-[12.5px] text-muted-foreground hover:text-[#ffb4b5] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setError(await voidLossAction(lossId));
          })
        }
      >
        {t('Anular')}
      </button>
      {error ? <span className="text-[12px] text-[#ffb4b5]">{error}</span> : null}
    </span>
  );
}

export function CloseShiftForm() {
  const t = useT();
  return (
    <ActionForm action={closeShiftAction}>
      {(state) => (
        <>
          <Field label={t('Efectivo contado')} name="countedCash" inputMode="numeric" required defaultValue={state?.values?.countedCash} />
          <p className="mt-3 text-[13.5px] text-muted-foreground">{t('¿Cómo se reparte el efectivo? Lo que no vaya en sobres ni en la caja fuerte queda en la caja.')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('Sobre para la cocina')} name="envelopeKitchen" inputMode="numeric" placeholder="0" defaultValue={state?.values?.envelopeKitchen} />
            <Field label={t('Sobre para el bar')} name="envelopeBar" inputMode="numeric" placeholder="0" defaultValue={state?.values?.envelopeBar} />
            <Field label={t('Caja fuerte')} name="safeAmount" inputMode="numeric" placeholder="0" defaultValue={state?.values?.safeAmount} />
          </div>
          <TextArea
            label={t('Observaciones del día (opcional)')}
            name="notes"
            rows={4}
            maxLength={1500}
            placeholder={t('Lo que pasó en el restaurante: se cayó un vaso, se devolvió un plato… Si la caja no cuadra, por qué.')}
            hint={t('Sale impreso al final de «Ventas por categoría».')}
            defaultValue={state?.values?.notes}
          />
          <SubmitButton pendingText={t('Cerrando…')}>{t('Cerrar caja')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
