'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { connectWhatsappAction, sendWaTemplateAction, sendWaTextAction, startWaAction, type WaResult } from '@/app/empresa/whatsapp-actions';
import { fillTemplate, type WaAdmin, type WaTemplate } from '@/lib/whatsapp';
import { Field, SelectField, inputClass } from './field';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

const primary =
  'rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-50';

/** Escoger una plantilla aprobada, llenar sus datos y ver cómo queda. */
function TemplatePicker({
  templates,
  onSend,
  pending,
}: {
  templates: WaTemplate[];
  onSend: (templateId: string, params: string[]) => void;
  pending: boolean;
}) {
  const [picked, setId] = useState('');
  // Si todavía no se ha escogido (o la lista cambió), la primera.
  const t = templates.find((x) => x.id === picked) ?? templates[0];
  const id = t?.id ?? '';
  const [params, setParams] = useState<string[]>([]);
  if (!templates.length) {
    return (
      <p className="text-[14px] text-muted-foreground">No hay plantillas aprobadas. Un administrador las trae de Meta con «Traer plantillas».</p>
    );
  }
  return (
    <div className="space-y-3">
      <SelectField
        label="Plantilla"
        name="templateId"
        value={id}
        onChange={(e) => {
          setId(e.target.value);
          setParams([]);
        }}
        options={templates.map((x) => ({ value: x.id, label: `${x.name} (${x.language})` }))}
      />
      {t
        ? Array.from({ length: t.params }, (_, i) => (
            <input
              key={`${t.id}-${i}`}
              aria-label={`Dato ${i + 1}`}
              placeholder={`Dato ${i + 1}`}
              value={params[i] ?? ''}
              onChange={(e) => setParams((p) => Object.assign([...p], { [i]: e.target.value }))}
              maxLength={500}
              className={inputClass}
            />
          ))
        : null}
      {t ? (
        <p className="whitespace-pre-line rounded-2xl bg-[#1f6f4a]/20 px-4 py-3 text-[14.5px] text-foreground/90">{fillTemplate(t.body, params)}</p>
      ) : null}
      <button type="button" disabled={pending || !t} onClick={() => t && onSend(t.id, params.slice(0, t.params))} className={primary}>
        {pending ? 'Enviando…' : 'Enviar plantilla'}
      </button>
    </div>
  );
}

/** Responder en una conversación: texto si está dentro de las 24 horas; si no, plantilla. */
export function WaComposer({
  companyId,
  conversationId,
  canReply,
  clientWrote,
  templates,
}: {
  companyId: string;
  conversationId: string;
  canReply: boolean;
  /** Si el cliente ya escribió alguna vez (para explicar por qué solo hay plantillas). */
  clientWrote: boolean;
  templates: WaTemplate[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [useTemplate, setUseTemplate] = useState(!canReply);
  const [result, setResult] = useState<WaResult>(undefined);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<WaResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r?.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      {!canReply ? (
        <p className="rounded-2xl border border-[#ffd27a]/25 bg-[#ffd27a]/[0.05] px-4 py-3 text-[13.5px] text-[#ffe2a6]">
          {clientWrote
            ? 'Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo deja mandarle una plantilla aprobada; cuando responda, ya puedes escribirle normal.'
            : 'El cliente todavía no ha respondido. Hasta que responda, WhatsApp solo deja mandarle plantillas aprobadas.'}
        </p>
      ) : null}
      {useTemplate ? (
        <TemplatePicker
          templates={templates}
          pending={pending}
          onSend={(id, params) => run(() => sendWaTemplateAction(companyId, conversationId, id, params))}
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim())
              run(
                () => sendWaTextAction(companyId, conversationId, text.trim()),
                () => setText(''),
              );
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label htmlFor="wa-text" className="sr-only">
            Mensaje
          </label>
          <textarea
            id="wa-text"
            rows={2}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escribe tu respuesta"
            className={`${inputClass} resize-none`}
          />
          <button type="submit" disabled={pending || !text.trim()} className={`${primary} shrink-0 py-3`}>
            {pending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      )}
      {canReply ? (
        <button type="button" onClick={() => setUseTemplate((v) => !v)} className="text-[13px] text-muted-foreground hover:text-foreground">
          {useTemplate ? 'Escribir un mensaje normal' : 'Usar una plantilla'}
        </button>
      ) : null}
      {result && !result.ok ? <Alert>{result.error}</Alert> : null}
    </div>
  );
}

/** Escribirle primero a un cliente (con plantilla). */
export function WaStartForm({ companyId, templates }: { companyId: string; templates: WaTemplate[] }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<WaResult>(undefined);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Celular" name="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" />
        <Field label="Nombre (opcional)" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
      </div>
      <TemplatePicker
        templates={templates}
        pending={pending}
        onSend={(templateId, params) =>
          start(async () => {
            setResult(await startWaAction(companyId, { phone, name, templateId, params }));
          })
        }
      />
      {result && !result.ok ? <Alert>{result.error}</Alert> : null}
    </div>
  );
}

/** El equipo de 3R pega los datos del número de WhatsApp Business de la empresa (de Meta). */
export function WhatsappConnectForm({ companyId, data }: { companyId: string; data: WaAdmin }) {
  const [state, action] = useActionState(connectWhatsappAction, undefined);
  const a = data.account;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Identificador del número (Phone number ID)"
          name="phoneNumberId"
          required
          inputMode="numeric"
          defaultValue={a?.phoneNumberId ?? ''}
        />
        <Field
          label="Identificador de la cuenta (WhatsApp Business Account ID)"
          name="wabaId"
          required
          inputMode="numeric"
          defaultValue={a?.wabaId ?? ''}
        />
        <Field label="Número que ven los clientes" name="displayPhone" required defaultValue={a?.displayPhone ?? ''} placeholder="+57 300 123 4567" />
        <SelectField
          label="Estado"
          name="status"
          defaultValue={a?.status ?? 'active'}
          options={[
            { value: 'active', label: 'Activo' },
            { value: 'paused', label: 'En pausa (no se puede enviar)' },
          ]}
        />
      </div>
      <Field
        label={a ? 'Token de acceso (déjalo vacío para no cambiarlo)' : 'Token de acceso permanente'}
        name="accessToken"
        type="password"
        autoComplete="off"
        required={!a}
        hint="Se guarda cifrado y nunca se vuelve a mostrar."
      />
      {state && !state.ok ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">WhatsApp conectado.</Alert> : null}
      <SubmitButton pendingText="Guardando…">{a ? 'Guardar cambios' : 'Conectar WhatsApp'}</SubmitButton>
    </form>
  );
}
