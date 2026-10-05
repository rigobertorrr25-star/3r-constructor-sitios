'use client';

import { createReservationAction, seatReservationAction, updateReservationAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, inputClass } from './ui';

type TableOption = { id: string; label: string; free: boolean };

export function ReservationForm({ date, tables }: { date: string; tables: TableOption[] }) {
  return (
    <ActionForm action={createReservationAction} resetOnOk className="grid gap-3 md:grid-cols-3">
      {(state) => (
        <>
          <Field label="Nombre" name="name" required maxLength={120} defaultValue={state?.values?.name} />
          <Field label="Teléfono / WhatsApp" name="phone" inputMode="tel" required defaultValue={state?.values?.phone} />
          <Field label="Personas" name="guests" type="number" min={1} max={60} required defaultValue={state?.values?.guests ?? '2'} />
          <Field label="Fecha" name="date" type="date" required defaultValue={state?.values?.date ?? date} />
          <Field label="Hora" name="time" type="time" required defaultValue={state?.values?.time ?? '20:00'} />
          <Select label="Mesa (opcional)" name="tableId" defaultValue={state?.values?.tableId ?? ''}>
            <option value="">Sin mesa todavía</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Field label="Nota (opcional)" name="notes" maxLength={300} placeholder="Cumpleaños, silla para bebé…" defaultValue={state?.values?.notes} />
          </div>
          <Field label="Abono (opcional)" name="deposit" inputMode="numeric" defaultValue={state?.values?.deposit} />
          <div className="md:col-span-3">
            <SubmitButton pendingText="Guardando…">Guardar reserva</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Confirmar, asignar mesa, sentar (abre la mesa), no llegó o cancelar. */
export function ReservationActions({ id, status, tableId, tables }: { id: string; status: string; tableId: string | null; tables: TableOption[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <ActionForm action={seatReservationAction} className="flex flex-wrap items-center gap-2" showOk={false}>
        {() => (
          <>
            <input type="hidden" name="reservationId" value={id} />
            <select name="tableId" defaultValue={tableId ?? ''} className={`${inputClass} w-auto py-1.5 text-[13.5px]`} aria-label="Mesa">
              <option value="">Mesa…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.free && t.id !== tableId}>
                  {t.label}
                  {t.free ? '' : ' (ocupada)'}
                </option>
              ))}
            </select>
            <SubmitButton pendingText="Abriendo…" className="py-1.5 text-[13.5px]">
              Llegó: abrir mesa
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
                {s === 'confirmed' ? 'Confirmar' : s === 'no_show' ? 'No llegó' : 'Cancelar'}
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ))}
    </div>
  );
}
