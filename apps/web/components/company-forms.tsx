'use client';

import { useActionState, useState } from 'react';
import {
  acceptInviteAction,
  adminSetModulesAction,
  createCompanyAction,
  inviteMemberAction,
  removeMemberAction,
  updateCompanyAction,
  updateMemberAction,
} from '@/app/empresa/actions';
import { MODULE_INFO, ROLE_LABEL, assignableBy, type CompanyDetail, type CompanyMember, type CompanyRole } from '@/lib/companies';
import { Field, SelectField } from './field';
import { formKey } from './form-key';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

const ghost =
  'rounded-full border border-white/[0.1] px-4 py-2 text-[13.5px] transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

/** Crear la empresa (sin `company`) o editar sus datos. */
export function CompanyForm({ company }: { company?: CompanyDetail }) {
  const [state, action] = useActionState(company ? updateCompanyAction : createCompanyAction, undefined);
  const v = state?.values;
  return (
    <form action={action} className="space-y-5">
      {company ? <input type="hidden" name="companyId" value={company.id} /> : null}
      <Field
        label="Nombre de la empresa"
        name="name"
        required
        minLength={2}
        maxLength={150}
        defaultValue={v?.name ?? company?.name}
        placeholder="Café La Muralla"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Sector"
          name="industry"
          maxLength={60}
          defaultValue={v?.industry ?? company?.industry ?? ''}
          placeholder="Restaurante, clínica, tienda…"
        />
        <Field label="Ciudad" name="city" maxLength={100} defaultValue={v?.city ?? company?.city ?? ''} placeholder="Cartagena" />
        <Field label="NIT (opcional)" name="taxId" maxLength={30} defaultValue={v?.taxId ?? company?.taxId ?? ''} />
        <Field label="Teléfono (opcional)" name="phone" maxLength={50} defaultValue={v?.phone ?? company?.phone ?? ''} />
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Datos guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{company ? 'Guardar cambios' : 'Crear mi empresa'}</SubmitButton>
    </form>
  );
}

export function InviteForm({ companyId, actorRole }: { companyId: string; actorRole: CompanyRole }) {
  const [state, action] = useActionState(inviteMemberAction, undefined);
  const roles = assignableBy(actorRole);
  return (
    <form action={action} className="space-y-4" key={state?.ok}>
      <input type="hidden" name="companyId" value={companyId} />
      <div className="space-y-4">
        <Field
          label="Correo"
          name="email"
          type="email"
          required
          maxLength={255}
          placeholder="nombre@correo.com"
          defaultValue={state?.error ? state.values?.email : ''}
        />
        <SelectField
          label="Rol"
          name="role"
          defaultValue={state?.error ? state.values?.role : 'employee'}
          options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Invitación enviada. Le llega un correo con el enlace para unirse.</Alert> : null}
      <SubmitButton pendingText="Enviando…">Enviar invitación</SubmitButton>
    </form>
  );
}

const dateValue = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** Una persona del equipo. Quien tenga permiso la puede editar ahí mismo. */
export function MemberRow({
  companyId,
  member,
  canEditProfile,
  canEditRole,
  canRemove,
  isSelf,
  actorRole,
}: {
  companyId: string;
  member: CompanyMember;
  canEditProfile: boolean;
  canEditRole: boolean;
  canRemove: boolean;
  isSelf: boolean;
  actorRole: CompanyRole;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateMemberAction, undefined);
  const name = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.email;
  const roles = assignableBy(actorRole);
  const disabled = member.status === 'disabled';

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15.5px] font-medium text-foreground">
            {name}
            {isSelf ? <span className="ml-2 text-[13px] font-normal text-muted-foreground">(tú)</span> : null}
          </p>
          <p className="truncate text-[13.5px] text-muted-foreground">
            {[member.jobTitle, member.area].filter(Boolean).join(' · ') || member.user.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {disabled ? <span className="rounded-full bg-[#ffb4b5]/10 px-2.5 py-1 text-[12px] text-[#ffb4b5]">Deshabilitado</span> : null}
          <span className="rounded-full border border-white/[0.1] px-3 py-1 text-[12.5px] text-foreground">{ROLE_LABEL[member.role]}</span>
          {canEditProfile || canEditRole || canRemove ? (
            <button type="button" onClick={() => setOpen((o) => !o)} className={ghost} aria-expanded={open}>
              {open ? 'Cerrar' : canEditProfile || canEditRole ? 'Editar' : 'Opciones'}
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 rounded-2xl bg-white/[0.03] p-4">
          {canEditProfile || canEditRole ? (
            <form action={action} className="space-y-4" key={formKey(`${member.role}|${member.status}`, state)}>
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="memberId" value={member.id} />
              {canEditProfile ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Cargo" name="jobTitle" maxLength={120} defaultValue={member.jobTitle ?? ''} placeholder="Mesera, contador…" />
                  <Field label="Área" name="area" maxLength={120} defaultValue={member.area ?? ''} placeholder="Salón, cocina…" />
                  <Field label="Fecha de ingreso" name="hiredAt" type="date" defaultValue={dateValue(member.hiredAt)} />
                </div>
              ) : null}
              {canEditRole ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Rol" name="role" defaultValue={member.role} options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
                  <SelectField
                    label="Acceso"
                    name="status"
                    defaultValue={member.status}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'disabled', label: 'Deshabilitado (no entra)' },
                    ]}
                  />
                </div>
              ) : null}
              {state?.error ? <Alert>{state.error}</Alert> : null}
              {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
              <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
            </form>
          ) : null}
          {canRemove ? (
            <form
              action={removeMemberAction}
              onSubmit={(event) => {
                const message = isSelf ? '¿Salir de esta empresa?' : `¿Quitar a ${name} de la empresa?`;
                if (!window.confirm(message)) event.preventDefault();
              }}
            >
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="memberId" value={member.id} />
              {isSelf ? <input type="hidden" name="self" value="1" /> : null}
              <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
                {isSelf ? 'Salir de la empresa' : 'Quitar de la empresa'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Uniéndote…">Unirme a la empresa</SubmitButton>
    </form>
  );
}

export function AdminModulesForm({
  companyId,
  catalog,
  enabled,
}: {
  companyId: string;
  catalog: { key: string; ready: boolean }[];
  enabled: string[];
}) {
  const [state, action] = useActionState(adminSetModulesAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {catalog.map((m) => (
          <li key={m.key}>
            <label
              className={`flex items-start gap-3 rounded-2xl border border-white/[0.08] px-4 py-3 ${m.ready ? 'cursor-pointer hover:bg-white/[0.03]' : 'opacity-50'}`}
            >
              <input
                type="checkbox"
                name="modules"
                value={m.key}
                defaultChecked={enabled.includes(m.key)}
                disabled={!m.ready}
                className="mt-1 accent-[#8a9bff]"
              />
              <span>
                <span className="block text-[14.5px] text-foreground">{MODULE_INFO[m.key]?.name ?? m.key}</span>
                <span className="block text-[12.5px] text-muted-foreground">{m.ready ? 'Listo para activar' : 'Todavía en construcción'}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Módulos guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar módulos</SubmitButton>
    </form>
  );
}
