'use client';

import { closeWaiterShiftAction, updateWorkModeAction, verifyWaiterShiftAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field } from './ui';
import { useT } from './i18n';

/** El dueño escoge cómo trabaja su negocio. */
export function WorkModeForm({ waitersCollect, barOnly, suggestedTip, trackPrep }: { waitersCollect: boolean; barOnly: boolean; suggestedTip: number; trackPrep: boolean }) {
  const t = useT();
  return (
    <ActionForm action={updateWorkModeAction} className="grid gap-3 md:grid-cols-2">
      {() => (
        <>
          <CheckField
            name="waitersCollect"
            label={t('Cada mesero cobra sus mesas')}
            hint={t('Para negocios sin cajero: el mesero registra si le pagaron en efectivo, datáfono o transferencia, lleva su propia cuenta y al final entrega su cierre. El administrador lo verifica en «Meseros».')}
            defaultChecked={waitersCollect}
          />
          <CheckField name="barOnly" label={t('Solo bar (sin cocina)')} hint={t('Para negocios que solo venden licores y bebidas: se esconde la cocina.')} defaultChecked={barOnly} />
          <CheckField
            name="trackPrep"
            label={t('Cocina y barra marcan sus comandas en pantalla')}
            hint={t('Quítalo si las comandas le llegan a la cajera y ella avisa: así no se mide cuánto se demoran y el radar de fugas no las cuenta como demoradas.')}
            defaultChecked={trackPrep}
          />
          <div className="md:col-span-2 md:max-w-[320px]">
            <Field
              label={t('Propina sugerida (%)')}
              name="suggestedTip"
              type="number"
              min={0}
              max={30}
              required
              defaultValue={suggestedTip}
              hint={t('Pon 0 si tu negocio no maneja propina: no se ofrece al cobrar ni sale en la precuenta.')}
            />
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText={t('Guardando…')}>{t('Guardar')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Cierre de la cuenta de un mesero: el efectivo que entrega. Sin `staffId`, la cuenta propia. */
export function CloseAccountForm({ staffId, cash, label }: { staffId?: string; cash: number; label: string }) {
  const t = useT();
  return (
    <ActionForm action={closeWaiterShiftAction} className="grid gap-3 sm:grid-cols-[220px_1fr]">
      {(state) => (
        <>
          {staffId ? <input type="hidden" name="staffId" value={staffId} /> : null}
          <Field
            label={t('Efectivo que entrega')}
            name="countedCash"
            inputMode="numeric"
            required
            defaultValue={state?.values?.countedCash ?? String(cash)}
            hint={t('Cuenta los billetes y escribe lo que hay.')}
          />
          <Field label={t('Nota (opcional)')} name="notes" maxLength={300} defaultValue={state?.values?.notes} placeholder={t('Por ejemplo: un cliente quedó debiendo')} />
          <div className="sm:col-span-2">
            <SubmitButton pendingText={t('Cerrando…')}>{label}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** El administrador marca un cierre como revisado. */
export function VerifyClosingForm({ shiftId }: { shiftId: string }) {
  const t = useT();
  return (
    <ActionForm action={verifyWaiterShiftAction} className="flex flex-wrap items-end gap-2">
      {() => (
        <>
          <input type="hidden" name="shiftId" value={shiftId} />
          <div className="min-w-0 flex-1">
            <Field label={t('Nota (opcional)')} name="note" maxLength={300} placeholder={t('Por ejemplo: revisado con los vouchers del datáfono')} />
          </div>
          <SubmitButton pendingText={t('Guardando…')}>{t('Marcar como verificado')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
