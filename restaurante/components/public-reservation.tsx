'use client';

import { requestReservationAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select } from './ui';
import { useT } from './i18n';

export function PublicReservationForm({ slug, today, locations }: { slug: string; today: string; locations: { id: string; name: string }[] }) {
  const t = useT();
  return (
    <ActionForm action={requestReservationAction} resetOnOk className="grid gap-3">
      {(state) => (
        <>
          <input type="hidden" name="slug" value={slug} />
          {locations.length > 1 ? (
            <Select label={t('Sede')} name="locationId" required defaultValue={state?.values?.locationId ?? ''}>
              <option value="" disabled>
                {t('Elige la sede')}
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Fecha')} name="date" type="date" min={today} required defaultValue={state?.values?.date ?? today} />
            <Field label={t('Hora')} name="time" type="time" required defaultValue={state?.values?.time ?? '20:00'} />
          </div>
          <Field label={t('¿Cuántas personas?')} name="guests" type="number" min={1} max={20} required defaultValue={state?.values?.guests ?? '2'} />
          <Field label={t('Tu nombre')} name="name" required maxLength={120} autoComplete="name" defaultValue={state?.values?.name} />
          <Field label={t('Teléfono / WhatsApp')} name="phone" inputMode="tel" required autoComplete="tel" defaultValue={state?.values?.phone} />
          <Field label={t('Correo (opcional)')} name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} />
          <Field label={t('Comentario (opcional)')} name="notes" maxLength={300} placeholder={t('Cumpleaños, terraza, silla para bebé…')} defaultValue={state?.values?.notes} />
          <SubmitButton pendingText={t('Enviando…')} className="w-full py-3">
            {t('Pedir la reserva')}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
