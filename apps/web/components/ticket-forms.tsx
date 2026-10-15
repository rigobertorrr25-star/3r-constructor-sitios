'use client';

import { useActionState, useState } from 'react';
import { commentTicketAction, createTicketAction, manageTicketAction } from '@/app/empresa/tickets-actions';
import { CATEGORY_LABEL, PRIORITY_LABEL, type Ticket } from '@/lib/tickets';
import { formKey } from './form-key';
import { Field, SelectField, TextAreaField } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

type MemberOption = { id: string; name: string };
const categories = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }));
const priorities = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }));

export function NewTicketPanel({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createTicketAction, undefined);
  const v = state?.error ? state.values : undefined;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {open ? 'Cerrar' : '+ Nuevo ticket'}
      </button>
      {open ? (
        <form action={action} className="mt-5 space-y-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
          <input type="hidden" name="companyId" value={companyId} />
          <Field
            label="¿Qué pasa?"
            name="title"
            required
            minLength={4}
            maxLength={150}
            defaultValue={v?.title}
            placeholder="La nevera de la cocina no enfría"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="¿A qué área va?" name="category" defaultValue={v?.category ?? 'support'} options={categories} />
            <SelectField label="Prioridad" name="priority" defaultValue={v?.priority ?? 'medium'} options={priorities} />
          </div>
          <TextAreaField
            label="Cuéntalo con detalle"
            name="description"
            required
            minLength={5}
            maxLength={8000}
            defaultValue={v?.description}
            placeholder="Desde cuándo pasa, dónde, qué ya intentaste…"
          />
          {state?.error ? <Alert>{state.error}</Alert> : null}
          <SubmitButton pendingText="Enviando…">Enviar ticket</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

/** Responsable, prioridad y área. Solo para quien atiende tickets. */
export function ManageTicketForm({ companyId, ticket, members }: { companyId: string; ticket: Ticket; members: MemberOption[] }) {
  const [state, action] = useActionState(manageTicketAction, undefined);
  const v = state?.error ? state.values : undefined;
  return (
    <form action={action} className="space-y-4" key={formKey(ticket.updatedAt, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="ticketId" value={ticket.id} />
      <SelectField
        label="Responsable"
        name="assigneeMemberId"
        defaultValue={v?.assigneeMemberId ?? ticket.assigneeMemberId ?? ''}
        options={[{ value: '', label: 'Sin responsable' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
      />
      <SelectField label="Prioridad" name="priority" defaultValue={v?.priority ?? ticket.priority} options={priorities} />
      <SelectField label="Área" name="category" defaultValue={v?.category ?? ticket.category} options={categories} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
    </form>
  );
}

export function TicketCommentForm({ companyId, ticketId }: { companyId: string; ticketId: string }) {
  const [state, action] = useActionState(commentTicketAction, undefined);
  return (
    <form action={action} className="space-y-4" key={state?.ok}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <TextAreaField
        label="Escribe un comentario"
        name="body"
        rows={3}
        required
        maxLength={4000}
        defaultValue={state?.error ? state.values?.body : ''}
        placeholder="Ya pedí el repuesto, llega el jueves…"
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingText="Enviando…">Comentar</SubmitButton>
    </form>
  );
}
