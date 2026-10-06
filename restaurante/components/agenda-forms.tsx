'use client';

import { useEffect, useState, useTransition } from 'react';
import { appointmentStatusAction, createAppointmentAction, payAppointmentAction, saveServiceAction } from '@/app/actions';
import type { Service } from '@/lib/appointments';
import { formatCop } from '@/lib/format';
import { isNetworkError } from '@/lib/offline';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Alert, CheckField, Field, Select, inputClass, primaryButton, quietButton } from './ui';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function AppointmentForm({ date, services, pros }: { date: string; services: Service[]; pros: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createAppointmentAction} resetOnOk className="grid gap-3 md:grid-cols-3">
      {(state) => (
        <>
          <Field label="Cliente" name="name" required maxLength={120} defaultValue={state?.values?.name} />
          <Field label="Teléfono / WhatsApp" name="phone" inputMode="tel" required defaultValue={state?.values?.phone} />
          <Select label="Servicio" name="serviceId" required defaultValue={state?.values?.serviceId ?? services[0]?.id}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatCop(s.price)} · {s.duration} min
              </option>
            ))}
          </Select>
          <Select label="Con" name="staffId" required defaultValue={state?.values?.staffId ?? pros[0]?.id}>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Field label="Fecha" name="date" type="date" required defaultValue={state?.values?.date ?? date} />
          <Field label="Hora" name="time" type="time" required defaultValue={state?.values?.time ?? '10:00'} />
          <div className="md:col-span-3">
            <Field label="Nota (opcional)" name="notes" maxLength={300} defaultValue={state?.values?.notes} />
          </div>
          <div className="md:col-span-3">
            <SubmitButton pendingText="Agendando…">Agendar</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ServiceForm({ service }: { service?: Service }) {
  return (
    <ActionForm action={saveServiceAction} resetOnOk={!service} className="grid items-end gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto]">
      {(state) => (
        <>
          {service ? <input type="hidden" name="id" value={service.id} /> : null}
          <Field label="Servicio" name="name" required maxLength={80} defaultValue={state?.values?.name ?? service?.name} />
          <Field label="Precio" name="price" inputMode="numeric" required defaultValue={state?.values?.price ?? service?.price} />
          <Field label="Minutos" name="duration" type="number" min={5} max={600} required defaultValue={state?.values?.duration ?? service?.duration ?? 30} />
          <Field label="Comisión %" name="commission" type="number" min={0} max={100} defaultValue={state?.values?.commission ?? service?.commission ?? 0} />
          <SubmitButton tone="quiet" pendingText="…">
            {service ? 'Guardar' : 'Agregar'}
          </SubmitButton>
          {service ? (
            <div className="sm:col-span-5">
              <CheckField name="isActive" label="Se ofrece" defaultChecked={service.isActive} />
            </div>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}

/** Atendida, no llegó, cancelar y cobrar. */
export function AppointmentActions({ id, status, price, manage, mine, canCharge }: { id: string; status: string; price: number; manage: boolean; mine: boolean; canCharge: boolean }) {
  const [paying, setPaying] = useState(false);
  const options: { status: string; label: string }[] = [];
  if (status === 'scheduled' && (manage || mine)) options.push({ status: 'done', label: 'Atendida' });
  if (status === 'scheduled' && manage) options.push({ status: 'no_show', label: 'No llegó' }, { status: 'cancelled', label: 'Cancelar' });
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <ActionForm key={o.status} action={appointmentStatusAction} className="inline-flex" showOk={false}>
            {() => (
              <>
                <input type="hidden" name="appointmentId" value={id} />
                <input type="hidden" name="status" value={o.status} />
                <SubmitButton tone={o.status === 'done' ? 'primary' : 'quiet'} className="py-1.5 text-[13px]">
                  {o.label}
                </SubmitButton>
              </>
            )}
          </ActionForm>
        ))}
        {canCharge && (status === 'done' || status === 'scheduled') && price > 0 && !paying ? (
          <button type="button" className={`${quietButton} py-1.5 text-[13px]`} onClick={() => setPaying(true)}>
            Cobrar {formatCop(price)}
          </button>
        ) : null}
      </div>
      {paying ? <PayForm id={id} price={price} onDone={() => setPaying(false)} /> : null}
    </div>
  );
}

function PayForm({ id, price, onDone }: { id: string; price: number; onDone: () => void }) {
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [tip, setTip] = useState('');
  const [received, setReceived] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setKey(newKey()), []);
  const n = (v: string) => Number(v.replace(/[.\s$]/g, '')) || 0;
  const change = method === 'cash' && received ? n(received) - price - n(tip) : null;
  return (
    <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="grid grid-cols-3 gap-1.5">
        {(['cash', 'card', 'transfer'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-xl px-2 py-2 text-[13px] ${method === m ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1]'}`}>
            {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Transferencia'}
          </button>
        ))}
      </div>
      <input className={`${inputClass} py-2 text-[14px]`} inputMode="numeric" placeholder="Propina (opcional)" value={tip} onChange={(e) => setTip(e.target.value)} aria-label="Propina" />
      {method === 'cash' ? (
        <input className={`${inputClass} py-2 text-[14px]`} inputMode="numeric" placeholder="Recibido en efectivo" value={received} onChange={(e) => setReceived(e.target.value)} aria-label="Recibido" />
      ) : null}
      {change !== null ? <p className={`text-[13.5px] ${change < 0 ? 'text-[#ffb4b5]' : 'text-success'}`}>{change < 0 ? `Faltan ${formatCop(-change)}` : `Vueltas: ${formatCop(change)}`}</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex gap-2">
        <button
          type="button"
          className={`${primaryButton} py-1.5 text-[13.5px]`}
          disabled={pending || !key}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const r = await payAppointmentAction(id, { method, tip: n(tip), received: method === 'cash' && received ? n(received) : null, reference: '', clientKey: key });
                if (r.error) setError(r.error);
                else onDone();
              } catch (e) {
                // Sin conexión: el mismo identificador hace que reintentar no cobre dos veces.
                setError(isNetworkError(e) ? 'Sin conexión: no se registró. Toca Cobrar de nuevo cuando vuelva el internet (no se duplica).' : 'Algo salió mal.');
              }
            })
          }
        >
          {pending ? 'Cobrando…' : `Cobrar ${formatCop(price + n(tip))}`}
        </button>
        <button type="button" className={`${quietButton} py-1.5 text-[13.5px]`} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
