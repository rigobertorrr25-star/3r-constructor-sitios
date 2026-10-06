'use client';

import { createReservationAction, seatReservationAction, updateReservationAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { useT } from './i18n';
import { Field, Select, inputClass } from './ui';

type TableOption = { id: string; label: string; free: boolean };

export function ReservationForm({ date, tables }: { date: string; tables: TableOption[] }) {
  const t = useT();
  return (
    <ActionForm action={createReservationAction} resetOnOk className="grid gap-3 md:grid-cols-3">
      {(state) => (
        <>
          <Field label={t('Nombre')} name="name" required maxLength={120} defaultValue={state?.values?.name} />
          <Field label={t('Teléfono / WhatsApp')} name="phone" inputMode="tel" required defaultValue={state?.values?.phone} />
          <Field label={t('Personas')} name="guests" type="number" min={1} max={60} required defaultValue={state?.values?.guests ?? '2'} />
          <Field label={t('Fecha')} name="date" type="date" required defaultValue={state?.values?.date ?? date} />
          <Field label={t('Hora')} name="time" type="time" required defaultValue={state?.values?.time ?? '20:00'} />
          <Select label={t('Mesa (opcional)')} name="tableId" defaultValue={state?.values?.tableId ?? ''}>
            <option value="">{t('Sin mesa todavía')}</option>
            {tables.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Field label={t('Nota (opcional)')} name="notes" maxLength={300} placeholder={t('Cumpleaños, silla para bebé…')} defaultValue={state?.values?.notes} />
          </div>
          <Field label={t('Abono (opcional)')} name="deposit" inputMode="numeric" defaultValue={state?.values?.deposit} />
          <div className="md:col-span-3">
            <SubmitButton pendingText={t('Guardando…')}>{t('Guardar reserva')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Confirmar, asignar mesa, sentar (abre la mesa), no llegó o cancelar. */
export function ReservationActions({ id, status, tableId, tables }: { id: string; status: string; tableId: string | null; tables: TableOption[] }) {
  const t = useT();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <ActionForm action={seatReservationAction} className="flex flex-wrap items-center gap-2" showOk={false}>
        {() => (
          <>
            <input type="hidden" name="reservationId" value={id} />
            <select name="tableId" defaultValue={tableId ?? ''} className={`${inputClass} w-auto py-1.5 text-[13.5px]`} aria-label={t('Mesa')}>
              <option value="">{t('Mesa…')}</option>
              {tables.map((x) => (
                <option key={x.id} value={x.id} disabled={!x.free && x.id !== tableId}>
                  {x.free ? x.label : t('{table} (ocupada)', { table: x.label })}
                </option>
              ))}
            </select>
            <SubmitButton pendingText={t('Abriendo…')} className="py-1.5 text-[13.5px]">
              {t('Llegó: abrir mesa')}
            </SubmitButton>
          </>
        )}
      </ActionForm>
      {(status === 'requested' ? ['confirmed', 'cancelled'] : ['no_show', 'cancelled']).map((s) => (
        <ActionForm key={s} action={updateReservationAction} className="inline-flex" showOk={false}>
          {() => (
            <>
              <input type="hidden" name="reservationId" value={id} />
              <input type="hidden" name="status" value={s} />
              <SubmitButton tone={s === 'confirmed' ? 'primary' : 'quiet'} className="py-1.5 text-[13.5px]">
                {s === 'confirmed' ? t('Confirmar') : s === 'no_show' ? t('No llegó') : t('Cancelar')}
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ))}
    </div>
  );
}
