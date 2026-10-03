'use client';

import { useActionState, useState } from 'react';
import { createEventAction } from '@/app/empresa/calendar-actions';
import { CheckField, Field, SelectField, TextAreaField } from './field';
import { formKey } from './form-key';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

/** Nuevo evento. Quien no es supervisor solo crea recordatorios personales. */
export function NewEventPanel({ companyId, canTeam, defaultDate }: { companyId: string; canTeam: boolean; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createEventAction, undefined);
  const [allDay, setAllDay] = useState(false);
  const v = state?.error ? state.values : undefined;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {open ? 'Cerrar' : canTeam ? '+ Nuevo evento' : '+ Nuevo recordatorio'}
      </button>
      {open ? (
        <form
          action={action}
          key={formKey(null, state)}
          className="mt-5 space-y-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]"
        >
          <input type="hidden" name="companyId" value={companyId} />
          {canTeam ? null : <input type="hidden" name="onlyPersonal" value="1" />}
          <div className={`grid gap-5 ${canTeam ? 'sm:grid-cols-[180px_1fr]' : ''}`}>
            {canTeam ? (
              <SelectField
                label="Tipo"
                name="kind"
                defaultValue={v?.kind ?? 'meeting'}
                options={[
                  { value: 'meeting', label: 'Reunión' },
                  { value: 'event', label: 'Evento' },
                  { value: 'deadline', label: 'Fecha límite' },
                ]}
              />
            ) : null}
            <Field label="Título" name="title" required minLength={2} maxLength={150} defaultValue={v?.title} placeholder="Reunión de turnos" />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Día" name="date" type="date" required defaultValue={v?.date ?? defaultDate} />
            {allDay ? null : (
              <>
                <Field label="Desde" name="startTime" type="time" required defaultValue={v?.startTime ?? '09:00'} />
                <Field label="Hasta (opcional)" name="endTime" type="time" defaultValue={v?.endTime} />
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckField name="allDay" label="Todo el día" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            {canTeam ? (
              <CheckField name="personal" label="Solo para mí" hint="Un recordatorio que nadie más ve." defaultChecked={v?.personal === 'on'} />
            ) : null}
          </div>
          <Field label="Lugar (opcional)" name="location" maxLength={150} defaultValue={v?.location} />
          <TextAreaField label="Detalle (opcional)" name="description" rows={2} maxLength={2000} defaultValue={v?.description} />
          {state?.error ? <Alert>{state.error}</Alert> : null}
          {state?.ok ? <Alert tone="ok">Guardado en el calendario.</Alert> : null}
          <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
