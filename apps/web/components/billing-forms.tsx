'use client';

import { useActionState } from 'react';
import { generateInvoiceAction, saveSubscriptionAction, setPricesAction } from '@/app/admin/billing-actions';
import { payInvoiceAction } from '@/app/empresa/billing-actions';
import { SUBSCRIPTION_LABEL, type BillingOverview, type ModulePrice } from '@/lib/billing';
import { Field, SelectField, TextAreaField, inputClass } from './field';
import { formKey } from './form-key';
import { Alert } from './shop';
import { SubmitButton } from './submit-button';

const fmt = (n: number | null) => (n == null ? '' : new Intl.NumberFormat('es-CO').format(n));

export function PricesForm({ prices }: { prices: ModulePrice[] }) {
  const [state, action] = useActionState(setPricesAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <ul className="divide-y divide-white/[0.06]">
        {prices.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-4 py-3">
            <label htmlFor={`price-${p.key}`} className="min-w-0">
              <span className="block text-[15px] text-foreground">{p.name}</span>
              {!p.ready ? <span className="block text-[12.5px] text-muted-foreground">Todavía en construcción</span> : null}
            </label>
            <span className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">$</span>
              <input
                id={`price-${p.key}`}
                name={`price:${p.key}`}
                defaultValue={fmt(p.monthlyPrice)}
                inputMode="numeric"
                placeholder="Por definir"
                className={`${inputClass} !w-40 !rounded-xl !py-2 text-right`}
              />
              <span className="text-[13px] text-muted-foreground">/mes</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-muted-foreground">Vacío: precio por definir (no se cobra). 0: incluido gratis.</p>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Precios guardados.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar precios</SubmitButton>
    </form>
  );
}

export function SubscriptionForm({ companyId, subscription }: { companyId: string; subscription: BillingOverview['subscription'] }) {
  const [state, action] = useActionState(saveSubscriptionAction, undefined);
  return (
    <form action={action} className="space-y-4" key={formKey(subscription ? JSON.stringify(subscription) : null, state)}>
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Estado"
          name="status"
          defaultValue={subscription?.status ?? 'trial'}
          options={Object.entries(SUBSCRIPTION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Field label="Prueba hasta" name="trialEndsAt" type="date" defaultValue={subscription?.trialEndsAt ?? ''} />
        <Field label="Día de cobro (1–28)" name="billingDay" type="number" min={1} max={28} required defaultValue={subscription?.billingDay ?? 1} />
      </div>
      <TextAreaField label="Notas internas (la empresa no las ve)" name="notes" rows={2} maxLength={1000} defaultValue={subscription?.notes ?? ''} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Plan guardado.</Alert> : null}
      <SubmitButton pendingText="Guardando…">Guardar plan</SubmitButton>
    </form>
  );
}

export function GenerateInvoiceButton({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(generateInvoiceAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-white/[0.12] px-4 py-2 text-[13.5px] text-foreground transition hover:bg-white/[0.06] disabled:opacity-60"
      >
        {pending ? 'Generando…' : 'Generar la factura de este periodo'}
      </button>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">Factura generada y enviada al dueño.</Alert> : null}
    </form>
  );
}

export function PayInvoiceButton({ companyId, invoiceId }: { companyId: string; invoiceId: string }) {
  const [state, action, pending] = useActionState(payInvoiceAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
      >
        {pending ? 'Abriendo…' : 'Pagar en línea'}
      </button>
      {state?.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}
