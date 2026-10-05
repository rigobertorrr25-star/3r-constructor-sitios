'use client';

import { useState } from 'react';
import { createStaffAction, resetPinAction, updateStaffAction } from '@/app/actions';
import { ROLE_HINT, ROLE_LABEL, type Role } from '@/lib/permissions';
import type { StaffMember } from '@/lib/store';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { CheckField, Field, Select, card, quietButton } from './ui';

type Sede = { id: string; name: string };
type Member = Omit<StaffMember, 'lockedUntil' | 'createdAt'> & { lockedUntil: string | null; createdAt: string };

function RoleSelect({ roles, defaultValue }: { roles: Role[]; defaultValue?: string }) {
  const [role, setRole] = useState(defaultValue ?? roles[roles.length - 1] ?? 'waiter');
  return (
    <Select label="Rol" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} hint={ROLE_HINT[role as Role]}>
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </Select>
  );
}

function LocationSelect({ locations, defaultValue }: { locations: Sede[]; defaultValue?: string | null }) {
  if (locations.length < 2 && !defaultValue) return <input type="hidden" name="locationId" value="" />;
  return (
    <Select label="Sede" name="locationId" defaultValue={defaultValue ?? ''} hint="«Todas» le pregunta la sede al entrar.">
      <option value="">Todas las sedes</option>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </Select>
  );
}

const PinFields = () => (
  <div className="grid grid-cols-2 gap-3">
    <Field label="PIN" name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" required hint="4 a 6 números" autoComplete="new-password" />
    <Field label="Repite el PIN" name="pin2" type="password" inputMode="numeric" pattern="\d{4,6}" required autoComplete="new-password" />
  </div>
);

export function CreateStaffForm({ roles, locations }: { roles: Role[]; locations: Sede[] }) {
  return (
    <ActionForm action={createStaffAction} resetOnOk className="grid gap-4 md:grid-cols-2">
      {(state) => (
        <>
          <Field label="Nombre" name="name" required maxLength={120} defaultValue={state?.values?.name} />
          <RoleSelect roles={roles} defaultValue={state?.values?.role} />
          <LocationSelect locations={locations} defaultValue={state?.values?.locationId} />
          <PinFields />
          <div className="md:col-span-2">
            <SubmitButton pendingText="Agregando…">Agregar</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function StaffRow({ member, roles, locations, editable, isMe }: { member: Member; roles: Role[]; locations: Sede[]; editable: boolean; isMe: boolean }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'pin'>('view');
  return (
    <li className={`${card} ${member.isActive ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[17px] font-semibold">
            {member.name} {isMe ? <span className="text-[13px] font-normal text-muted-foreground">(tú)</span> : null}
          </p>
          <p className="text-[14px] text-muted-foreground">
            Código <span className="font-semibold text-foreground">{member.code}</span> · {ROLE_LABEL[member.role]} · {member.locationName ?? 'Todas las sedes'}
            {member.isActive ? '' : ' · Desactivado'}
            {member.lockedUntil ? ' · Bloqueado por PIN equivocados' : ''}
          </p>
        </div>
        {editable ? (
          <div className="flex gap-2">
            <button type="button" className={quietButton} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>
              Editar
            </button>
            <button type="button" className={quietButton} onClick={() => setMode(mode === 'pin' ? 'view' : 'pin')}>
              Cambiar PIN
            </button>
          </div>
        ) : null}
      </div>
      {mode === 'edit' ? (
        <ActionForm action={updateStaffAction} onOk={() => setMode('view')} className="mt-5 grid gap-4 border-t border-white/[0.06] pt-5 md:grid-cols-2">
          {() => (
            <>
              <input type="hidden" name="staffId" value={member.id} />
              <Field label="Nombre" name="name" required defaultValue={member.name} />
              {isMe ? <input type="hidden" name="role" value={member.role} /> : <RoleSelect roles={roles} defaultValue={member.role} />}
              <LocationSelect locations={locations} defaultValue={member.locationId} />
              {isMe ? (
                <input type="hidden" name="isActive" value="on" />
              ) : (
                <CheckField name="isActive" label="Activo" hint="Si lo desactivas, sale de inmediato y no puede volver a entrar." defaultChecked={member.isActive} />
              )}
              <div className="md:col-span-2">
                <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      ) : null}
      {mode === 'pin' ? (
        <ActionForm action={resetPinAction} className="mt-5 space-y-4 border-t border-white/[0.06] pt-5">
          {() => (
            <>
              <input type="hidden" name="staffId" value={member.id} />
              <PinFields />
              <SubmitButton pendingText="Guardando…">Guardar PIN nuevo</SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
