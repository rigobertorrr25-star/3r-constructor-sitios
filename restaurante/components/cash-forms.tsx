'use client';

import { closeShiftAction, movementAction, openShiftAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea } from './ui';

export function OpenShiftForm() {
  return (
    <ActionForm action={openShiftAction}>
      {(state) => (
        <>
          <Field label="Base en efectivo" name="openingAmount" inputMode="numeric" placeholder="200000" defaultValue={state?.values?.openingAmount} hint="La plata con la que arranca la caja (para dar vueltas)." />
          <SubmitButton pendingText="Abriendo…">Abrir caja</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MovementForm() {
  return (
    <ActionForm action={movementAction} resetOnOk className="grid gap-3 sm:grid-cols-[140px_1fr]">
      {(state) => (
        <>
          <Select label="Tipo" name="kind" defaultValue={state?.values?.kind ?? 'out'}>
            <option value="out">Sale</option>
            <option value="in">Entra</option>
          </Select>
          <Field label="Valor" name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <div className="sm:col-span-2">
            <Field label="Motivo" name="reason" required minLength={3} maxLength={200} placeholder="Pago del hielo, cambio que trajo el dueño…" defaultValue={state?.values?.reason} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton tone="quiet" pendingText="Guardando…">
              Registrar
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function CloseShiftForm() {
  return (
    <ActionForm action={closeShiftAction}>
      {(state) => (
        <>
          <Field label="Efectivo contado" name="countedCash" inputMode="numeric" required defaultValue={state?.values?.countedCash} />
          <TextArea label="Nota (opcional)" name="notes" maxLength={300} placeholder="Si no cuadra, ¿por qué?" defaultValue={state?.values?.notes} />
          <SubmitButton pendingText="Cerrando…">Cerrar caja</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
