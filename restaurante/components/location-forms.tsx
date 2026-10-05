'use client';

import { useState } from 'react';
import { createLocationAction, updateLocationAction } from '@/app/actions';
import type { Location } from '@/lib/store';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field, card, quietButton } from './ui';

export function CreateLocationForm() {
  return (
    <ActionForm action={createLocationAction} resetOnOk className="grid gap-4 md:grid-cols-2">
      {(state) => (
        <>
          <Field label="Nombre" name="name" required maxLength={80} defaultValue={state?.values?.name} />
          <Field label="Dirección (opcional)" name="address" maxLength={160} defaultValue={state?.values?.address} />
          <div className="md:col-span-2">
            <SubmitButton pendingText="Creando…">Crear sede</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function LocationRow({ location, current }: { location: Location; current: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={`${card} ${location.isActive ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[17px] font-semibold">
            {location.name} {current ? <span className="text-[13px] font-normal text-muted-foreground">(estás aquí)</span> : null}
          </p>
          <p className="text-[14px] text-muted-foreground">
            {location.address ?? 'Sin dirección'}
            {location.isActive ? '' : ' · Desactivada'}
          </p>
        </div>
        <button type="button" className={quietButton} onClick={() => setEditing(!editing)}>
          Editar
        </button>
      </div>
      {editing ? (
        <ActionForm action={updateLocationAction} onOk={() => setEditing(false)} className="mt-5 grid gap-4 border-t border-white/[0.06] pt-5 md:grid-cols-2">
          {() => (
            <>
              <input type="hidden" name="locationId" value={location.id} />
              <Field label="Nombre" name="name" required defaultValue={location.name} />
              <Field label="Dirección" name="address" defaultValue={location.address ?? ''} />
              {current ? <input type="hidden" name="isActive" value="on" /> : <CheckField name="isActive" label="Activa" defaultChecked={location.isActive} />}
              <div className="md:col-span-2">
                <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
