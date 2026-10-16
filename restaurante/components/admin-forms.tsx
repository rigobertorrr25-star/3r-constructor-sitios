'use client';

import { useTransition } from 'react';
import { createBusinessAction, setBusinessActiveAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, dangerButton, quietButton } from './ui';
import { useT } from './i18n';

export function CreateBusinessForm() {
  const t = useT();
  return (
    <ActionForm action={createBusinessAction} resetOnOk className="grid gap-4 sm:grid-cols-2">
      {(state) => (
        <>
          <Field label={t('Nombre del negocio')} name="name" required defaultValue={state?.values?.name} />
          <Field label={t('Primera sede')} name="locationName" placeholder={t('Principal')} defaultValue={state?.values?.locationName} />
          <Field label={t('Nombre del dueño')} name="ownerName" required defaultValue={state?.values?.ownerName} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('PIN del dueño')} name="ownerPin" type="password" inputMode="numeric" pattern="\d{4,6}" required hint={t('4 a 6 números')} />
            <Field label={t('Repite el PIN')} name="pin2" type="password" inputMode="numeric" pattern="\d{4,6}" required />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText={t('Creando…')}>{t('Crear negocio')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function BusinessToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <button
      type="button"
      disabled={pending}
      className={active ? dangerButton : quietButton}
      onClick={() => {
        if (active && !confirm(t('¿Suspender este negocio? Nadie de su equipo podrá entrar hasta que lo reactives.'))) return;
        start(() => setBusinessActiveAction(id, !active));
      }}
    >
      {active ? t('Suspender') : t('Reactivar')}
    </button>
  );
}
