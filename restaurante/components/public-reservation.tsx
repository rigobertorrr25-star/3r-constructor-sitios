'use client';

import { requestReservationAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select } from './ui';

export function PublicReservationForm({ slug, today, locations }: { slug: string; today: string; locations: { id: string; name: string }[] }) {
  return (
    <ActionForm action={requestReservationAction} resetOnOk className="grid gap-3">
      {(state) => (
        <>
          <input type="hidden" name="slug" value={slug} />
          {locations.length > 1 ? (
            <Select label="Sede" name="locationId" required defaultValue={state?.values?.locationId ?? ''}>
              <option value="" disabled>
                Elige la sede
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" name="date" type="date" min={today} required defaultValue={state?.values?.date ?? today} />
            <Field label="Hora" name="time" type="time" required defaultValue={state?.values?.time ?? '20:00'} />
          </div>
          <Field label="¿Cuántas personas?" name="guests" type="number" min={1} max={20} required defaultValue={state?.values?.guests ?? '2'} />
          <Field label="Tu nombre" name="name" required maxLength={120} autoComplete="name" defaultValue={state?.values?.name} />
          <Field label="Teléfono / WhatsApp" name="phone" inputMode="tel" required autoComplete="tel" defaultValue={state?.values?.phone} />
          <Field label="Correo (opcional)" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} />
          <Field label="Comentario (opcional)" name="notes" maxLength={300} placeholder="Cumpleaños, terraza, silla para bebé…" defaultValue={state?.values?.notes} />
          <SubmitButton pendingText="Enviando…" className="w-full py-3">
            Pedir la reserva
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
