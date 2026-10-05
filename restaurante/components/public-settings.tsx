'use client';

import { publicSettingsAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field } from './ui';

export function PublicSettingsForm({ phone, reservationsEnabled }: { phone: string; reservationsEnabled: boolean }) {
  return (
    <ActionForm action={publicSettingsAction} className="grid gap-3 md:grid-cols-2">
      {() => (
        <>
          <Field label="WhatsApp del restaurante (opcional)" name="phone" inputMode="tel" defaultValue={phone} hint="Aparece en la carta pública." />
          <CheckField name="reservationsEnabled" label="Recibir reservas en línea" hint="Llegan como «por confirmar» a Reservas." defaultChecked={reservationsEnabled} />
          <div className="md:col-span-2">
            <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
