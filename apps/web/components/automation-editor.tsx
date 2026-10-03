'use client';

import { useState, useTransition } from 'react';
import { saveAutomationAction } from '@/app/empresa/automations-actions';
import {
  ACTION_LABEL,
  NOTIFY_LABEL,
  PRIORITY_LABEL,
  fillSample,
  type ActionType,
  type Automation,
  type AutomationAction,
  type AutomationList,
} from '@/lib/automations';
import { Field, SelectField, inputClass } from './field';
import { Alert } from './shop';

const PERSON_TRIGGERS = ['store_order', 'site_contact', 'quote_accepted', 'quote_rejected'];
const blank = (type: ActionType): AutomationAction =>
  type === 'notify'
    ? { type, to: 'supervisors', title: '' }
    : type === 'email'
      ? { type, to: '', title: '', body: '' }
      : type === 'ticket'
        ? { type, title: '', body: '', priority: 'medium', assigneeMemberId: null }
        : { type };

export function AutomationEditor({
  companyId,
  data,
  automation,
  preset,
}: {
  companyId: string;
  data: Pick<AutomationList, 'triggers' | 'members' | 'modules'>;
  automation?: Automation;
  preset?: { name: string; trigger: string; minAmount?: number; actions: AutomationAction[] };
}) {
  const start0 = automation ?? preset;
  const [name, setName] = useState(start0?.name ?? '');
  const [trigger, setTrigger] = useState(start0?.trigger ?? 'store_order');
  const [minAmount, setMinAmount] = useState(start0?.minAmount ? new Intl.NumberFormat('es-CO').format(start0.minAmount) : '');
  const [actions, setActions] = useState<AutomationAction[]>(start0?.actions.map((a) => ({ ...a })) ?? [blank('notify')]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = data.triggers.find((x) => x.key === trigger)!;
  const setA = (i: number, patch: Partial<AutomationAction>) => setActions((as) => as.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const missing = (key: string) => !data.modules.includes(key);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = minAmount.replace(/[^\d]/g, '');
    start(async () => {
      const res = await saveAutomationAction(companyId, automation?.id ?? null, {
        name,
        trigger,
        minAmount: t.amount && digits ? Number(digits) : null,
        actions: actions.map((a) => ({ ...a, assigneeMemberId: a.assigneeMemberId || null })),
        active: automation?.active ?? true,
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Field
        label="Nombre"
        name="name"
        required
        minLength={3}
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pedidos grandes"
      />

      <fieldset className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <legend className="px-1 font-display text-[16px] font-semibold text-foreground">Si pasa esto…</legend>
        <SelectField
          label="Cuando"
          name="trigger"
          value={trigger}
          onChange={(e) => {
            setTrigger(e.target.value);
            if (!PERSON_TRIGGERS.includes(e.target.value)) setActions((as) => as.filter((a) => a.type !== 'crm_contact'));
          }}
          options={data.triggers.map((x) => ({ value: x.key, label: x.label }))}
        />
        {t.amount ? (
          <Field
            label="Solo si el valor es de al menos (opcional, en pesos)"
            name="minAmount"
            inputMode="numeric"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="100.000"
          />
        ) : null}
        <p className="text-[13px] text-muted-foreground">
          En los mensajes puedes usar:{' '}
          {t.vars.map((v) => (
            <span key={v} className="mr-1.5 inline-block rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[12.5px] text-foreground">{`{${v}}`}</span>
          ))}
        </p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-[16px] font-semibold text-foreground">…hacer esto</legend>
        {actions.map((a, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-2">
              <select
                aria-label={`Acción ${i + 1}`}
                value={a.type}
                onChange={(e) => setA(i, blank(e.target.value as ActionType))}
                className={`${inputClass} py-2 sm:max-w-sm`}
              >
                {(Object.keys(ACTION_LABEL) as ActionType[])
                  .filter((k) => k !== 'crm_contact' || PERSON_TRIGGERS.includes(trigger))
                  .map((k) => (
                    <option key={k} value={k} className="bg-[#0a131a]">
                      {ACTION_LABEL[k]}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => setActions((as) => (as.length > 1 ? as.filter((_, j) => j !== i) : as))}
                aria-label={`Quitar la acción ${i + 1}`}
                className="rounded-lg px-2 py-1 text-muted-foreground hover:text-[#ffb4b5]"
              >
                ×
              </button>
            </div>

            {a.type === 'notify' ? (
              <>
                <select aria-label="A quién avisar" value={a.to} onChange={(e) => setA(i, { to: e.target.value })} className={inputClass}>
                  {Object.entries(NOTIFY_LABEL).map(([v, l]) => (
                    <option key={v} value={v} className="bg-[#0a131a]">
                      {l}
                    </option>
                  ))}
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0a131a]">
                      Solo a {m.name}
                    </option>
                  ))}
                </select>
                {missing('alerts') ? (
                  <p className="text-[13px] text-[#ffd27a]">La empresa no tiene el módulo Alertas: los avisos no llegarán.</p>
                ) : null}
              </>
            ) : null}
            {a.type === 'email' ? (
              <input
                aria-label="Correo al que llega"
                type="email"
                value={a.to ?? ''}
                onChange={(e) => setA(i, { to: e.target.value })}
                required
                maxLength={255}
                placeholder="gerencia@tunegocio.com"
                className={inputClass}
              />
            ) : null}
            {a.type === 'crm_contact' ? (
              <p className="text-[13.5px] text-muted-foreground">
                Crea al cliente con su nombre, correo y celular (si ya existe, le deja una nota).
                {missing('crm') ? ' La empresa no tiene el CRM activo.' : ''}
              </p>
            ) : null}
            {a.type !== 'crm_contact' ? (
              <>
                <input
                  aria-label={a.type === 'email' ? 'Asunto' : 'Título'}
                  value={a.title ?? ''}
                  onChange={(e) => setA(i, { title: e.target.value })}
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder={
                    a.type === 'email' ? 'Asunto: Pedido #{numero} de {cliente}' : a.type === 'ticket' ? 'Título del ticket' : 'Título del aviso'
                  }
                  className={inputClass}
                />
                <textarea
                  aria-label="Mensaje"
                  value={a.body ?? ''}
                  onChange={(e) => setA(i, { body: e.target.value })}
                  rows={2}
                  maxLength={2000}
                  placeholder="Mensaje (opcional)"
                  className={`${inputClass} resize-y`}
                />
              </>
            ) : null}
            {a.type === 'ticket' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  aria-label="Prioridad"
                  value={a.priority ?? 'medium'}
                  onChange={(e) => setA(i, { priority: e.target.value })}
                  className={inputClass}
                >
                  {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                    <option key={v} value={v} className="bg-[#0a131a]">
                      Prioridad {l.toLowerCase()}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="A cargo de"
                  value={a.assigneeMemberId ?? ''}
                  onChange={(e) => setA(i, { assigneeMemberId: e.target.value || null })}
                  className={inputClass}
                >
                  <option value="" className="bg-[#0a131a]">
                    Sin responsable
                  </option>
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0a131a]">
                      A cargo de {m.name}
                    </option>
                  ))}
                </select>
                {missing('tickets') ? (
                  <p className="text-[13px] text-[#ffd27a] sm:col-span-2">La empresa no tiene el módulo Tickets activo.</p>
                ) : null}
              </div>
            ) : null}
            {a.title ? (
              <p className="rounded-xl bg-black/25 px-3 py-2 text-[13px] text-foreground/85">
                <span className="text-muted-foreground">Así se vería: </span>
                <strong>{fillSample(a.title)}</strong>
                {a.body ? ` — ${fillSample(a.body)}` : ''}
              </p>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setActions((as) => [...as, blank('notify')])}
          disabled={actions.length >= 5}
          className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          + Agregar acción
        </button>
      </fieldset>

      {error ? <Alert>{error}</Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Guardando…' : automation ? 'Guardar cambios' : 'Crear automatización'}
      </button>
    </form>
  );
}
