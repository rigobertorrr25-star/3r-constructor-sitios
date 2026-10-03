'use client';

import { useActionState, useState } from 'react';
import { createRequestAction, decideRequestAction } from '@/app/empresa/requests-actions';
import { TYPE_HINT, TYPE_LABEL, type RequestType } from '@/lib/requests';
import { Field, SelectField, TextAreaField } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

export function NewRequestPanel({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createRequestAction, undefined);
  const v = state?.error ? state.values : undefined;
  const [type, setType] = useState<RequestType>((v?.type as RequestType) ?? 'vacation');
  const dated = type !== 'certificate';
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {open ? 'Cerrar' : '+ Nueva solicitud'}
      </button>
      {open ? (
        <form action={action} className="mt-5 space-y-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
          <input type="hidden" name="companyId" value={companyId} />
          <div className="space-y-1.5">
            <SelectField
              label="¿Qué necesitas?"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as RequestType)}
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <p className="text-[13px] text-muted-foreground">{TYPE_HINT[type]}</p>
          </div>
          {dated ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Desde" name="startDate" type="date" required defaultValue={v?.startDate} />
              <Field label="Hasta" name="endDate" type="date" defaultValue={v?.endDate} hint="Si es un solo día, déjalo vacío." />
            </div>
          ) : null}
          <TextAreaField
            label="Motivo"
            name="reason"
            rows={3}
            required
            minLength={3}
            maxLength={2000}
            defaultValue={v?.reason}
            placeholder={type === 'certificate' ? 'Para presentarlo en el banco, con cargo y salario.' : 'Viaje familiar, cita médica…'}
          />
          {state?.error ? <Alert>{state.error}</Alert> : null}
          <SubmitButton pendingText="Enviando…">Enviar solicitud</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

/** Aprobar o rechazar, con una nota opcional que le llega al empleado. */
export function DecisionForm({ companyId, requestId }: { companyId: string; requestId: string }) {
  const [state, action] = useActionState(decideRequestAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="requestId" value={requestId} />
      <TextAreaField
        label="Nota (opcional)"
        name="note"
        rows={2}
        maxLength={1000}
        defaultValue={state?.error ? state.values?.note : ''}
        placeholder="Deja los turnos cubiertos…"
      />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          Aprobar
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          className="rounded-full border border-white/[0.12] px-5 py-2.5 text-[14px] text-foreground transition hover:border-[#ffb4b5]/50 hover:text-[#ffb4b5]"
        >
          Rechazar
        </button>
      </div>
    </form>
  );
}
