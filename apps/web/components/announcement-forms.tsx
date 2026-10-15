'use client';

import { useActionState, useState } from 'react';
import { createAnnouncementAction, updateAnnouncementAction } from '@/app/empresa/announcements-actions';
import { KIND_LABEL, toLocalInput, type AnnouncementDetail, type AnnouncementKind } from '@/lib/announcements';
import { CheckField, Field, SelectField, TextAreaField } from './field';
import { formKey } from './form-key';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

/** Nuevo comunicado (sin `announcement`) o editar uno. */
export function AnnouncementForm({ companyId, announcement }: { companyId: string; announcement?: AnnouncementDetail }) {
  const [state, action] = useActionState(announcement ? updateAnnouncementAction : createAnnouncementAction, undefined);
  const v = state?.error ? state.values : undefined;
  const [kind, setKind] = useState<AnnouncementKind>((v?.kind as AnnouncementKind) ?? announcement?.kind ?? 'news');
  return (
    <form action={action} className="space-y-5" key={formKey(announcement?.updatedAt ?? null, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      {announcement ? <input type="hidden" name="announcementId" value={announcement.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <SelectField
          label="Tipo"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as AnnouncementKind)}
          options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Field
          label="Título"
          name="title"
          required
          minLength={3}
          maxLength={150}
          defaultValue={v?.title ?? announcement?.title}
          placeholder="Nuevo horario de diciembre"
        />
      </div>
      {kind === 'event' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Fecha y hora"
            name="eventAt"
            type="datetime-local"
            required
            defaultValue={v?.eventAt ?? toLocalInput(announcement?.eventAt ?? null)}
          />
          <Field
            label="Lugar"
            name="eventPlace"
            maxLength={150}
            defaultValue={v?.eventPlace ?? announcement?.eventPlace ?? ''}
            placeholder="Terraza del local"
          />
        </div>
      ) : null}
      <TextAreaField label="Mensaje" name="body" rows={6} required minLength={3} maxLength={10000} defaultValue={v?.body ?? announcement?.body} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField
          name="pinned"
          label="Fijarlo arriba"
          hint="Queda primero en la lista hasta que lo quites."
          defaultChecked={v ? v.pinned === 'on' : announcement?.pinned}
        />
        {announcement ? null : (
          <CheckField name="notify" label="Avisar por correo" hint="Le llega a todo el equipo." defaultChecked={v ? v.notify === 'on' : true} />
        )}
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Cambios guardados.</Alert> : null}
      <SubmitButton pendingText={announcement ? 'Guardando…' : 'Publicando…'}>{announcement ? 'Guardar cambios' : 'Publicar'}</SubmitButton>
    </form>
  );
}

export function NewAnnouncementPanel({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {open ? 'Cerrar' : '+ Nuevo comunicado'}
      </button>
      {open ? (
        <div className="mt-5 rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
          <AnnouncementForm companyId={companyId} />
        </div>
      ) : null}
    </div>
  );
}
