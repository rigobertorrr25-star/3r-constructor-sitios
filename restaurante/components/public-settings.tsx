'use client';

import { publicSettingsAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field } from './ui';
import { useT } from './i18n';

export function PublicSettingsForm({ phone, reservationsEnabled }: { phone: string; reservationsEnabled: boolean }) {
  const t = useT();
  return (
    <ActionForm action={publicSettingsAction} className="grid gap-3 md:grid-cols-2">
      {() => (
        <>
          <Field label={t('WhatsApp del restaurante (opcional)')} name="phone" inputMode="tel" defaultValue={phone} hint={t('Aparece en la carta pública.')} />
          <CheckField name="reservationsEnabled" label={t('Recibir reservas en línea')} hint={t('Llegan como «por confirmar» a Reservas.')} defaultChecked={reservationsEnabled} />
          <div className="md:col-span-2">
            <SubmitButton pendingText={t('Guardando…')}>{t('Guardar')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
