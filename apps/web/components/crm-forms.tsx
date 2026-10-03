'use client';

import { useActionState, useState } from 'react';
import { addActivityAction, createContactAction, updateContactAction } from '@/app/empresa/crm-actions';
import { ACTIVITY_LABEL, CRM_STAGES, SOURCE_LABEL, STAGE_LABEL, type CrmContact } from '@/lib/crm';
import { Field, SelectField, TextAreaField } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

type MemberOption = { id: string; name: string };

const pesos = (cents: number | null | undefined) => (cents == null ? '' : new Intl.NumberFormat('es-CO').format(Math.round(cents / 100)));

/** Nuevo cliente (sin `contact`) o editar uno. */
export function ContactForm({ companyId, contact, members }: { companyId: string; contact?: CrmContact; members: MemberOption[] }) {
  const [state, action] = useActionState(contact ? updateContactAction : createContactAction, undefined);
  const v = state?.error ? state.values : undefined;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="companyId" value={companyId} />
      {contact ? <input type="hidden" name="contactId" value={contact.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" name="name" required minLength={2} maxLength={150} defaultValue={v?.name ?? contact?.name} placeholder="Juan Pérez" />
        <Field
          label="Empresa o negocio"
          name="organization"
          maxLength={150}
          defaultValue={v?.organization ?? contact?.organization ?? ''}
          placeholder="Hotel Las Américas"
        />
        <Field label="Teléfono" name="phone" maxLength={50} defaultValue={v?.phone ?? contact?.phone ?? ''} />
        <Field label="Correo" name="email" type="email" maxLength={255} defaultValue={v?.email ?? contact?.email ?? ''} />
        <SelectField
          label="Etapa"
          name="stage"
          defaultValue={v?.stage ?? contact?.stage ?? 'lead'}
          options={CRM_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
        />
        <Field
          label="Valor del negocio (pesos)"
          name="value"
          inputMode="numeric"
          defaultValue={v?.value ?? pesos(contact?.valueCents)}
          placeholder="2.500.000"
        />
        <SelectField
          label="¿Cómo llegó?"
          name="source"
          defaultValue={v?.source ?? contact?.source ?? 'manual'}
          options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Responsable"
          name="ownerMemberId"
          defaultValue={v?.ownerMemberId ?? contact?.ownerMemberId ?? ''}
          options={[{ value: '', label: 'Sin responsable' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </div>
      <TextAreaField label="Notas" name="notes" rows={3} maxLength={4000} defaultValue={v?.notes ?? contact?.notes ?? ''} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{contact ? 'Guardar cambios' : 'Guardar cliente'}</SubmitButton>
    </form>
  );
}

export function NewContactPanel({ companyId, members }: { companyId: string; members: MemberOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {open ? 'Cerrar' : '+ Nuevo cliente'}
      </button>
      {open ? (
        <div className="mt-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
          <ContactForm companyId={companyId} members={members} />
        </div>
      ) : null}
    </div>
  );
}

export function ActivityForm({ companyId, contactId }: { companyId: string; contactId: string }) {
  const [state, action] = useActionState(addActivityAction, undefined);
  return (
    <form action={action} className="space-y-4" key={state?.ok}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="contactId" value={contactId} />
      <SelectField
        label="¿Qué pasó?"
        name="kind"
        defaultValue={state?.values?.kind ?? 'call'}
        options={['call', 'whatsapp', 'email', 'meeting', 'note'].map((k) => ({ value: k, label: ACTIVITY_LABEL[k] }))}
      />
      <TextAreaField
        label="Detalle"
        name="body"
        rows={3}
        required
        maxLength={4000}
        defaultValue={state?.error ? state.values?.body : ''}
        placeholder="Llamé a compras, piden cotización formal…"
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Guardando…">Agregar al historial</SubmitButton>
    </form>
  );
}
