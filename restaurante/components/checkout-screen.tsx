'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { discountAction, payAction, reversePaymentAction, voidDiscountAction } from '@/app/actions';
import type { Checkout, Method } from '@/lib/cash';
import { formatCop, formatTime } from '@/lib/format';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Alert, Field, card, inputClass, primaryButton, quietButton } from './ui';

type View = Omit<Checkout, 'session' | 'payments'> & {
  session: Omit<Checkout['session'], 'openedAt' | 'closedAt'> & { openedAt: string; closedAt: string | null };
  payments: (Omit<Checkout['payments'][number], 'createdAt'> & { createdAt: string })[];
};

const METHOD_LABEL: Record<Method, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const toInt = (value: string) => {
  const n = Number(value.replace(/[.\s$]/g, ''));
  return Number.isInteger(n) && n >= 0 ? n : 0;
};
const tipFor = (amount: number, percent: number) => Math.round((amount * percent) / 100 / 100) * 100;

export function CheckoutScreen({ checkout, shiftOpen, canReverse, canUnlimited, timeZone }: { checkout: View; shiftOpen: boolean; canReverse: boolean; canUnlimited: boolean; timeZone: string }) {
  const c = checkout;
  const closed = c.session.status === 'closed';
  const [parts, setParts] = useState(1);
  const [method, setMethod] = useState<Method>('cash');
  const [amount, setAmount] = useState(String(c.balance));
  const [tipOn, setTipOn] = useState(true);
  const [tip, setTip] = useState('');
  const [received, setReceived] = useState('');
  const [reference, setReference] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setClientKey(newKey()), []);
  // Cuando cambia el saldo (otro pago, un descuento), se propone la siguiente parte.
  useEffect(() => {
    // Cada parte redondeada a la centena; la última paga lo que falte.
    setAmount(String(parts > 1 ? Math.min(c.balance, Math.ceil(c.balance / parts / 100) * 100) : c.balance));
  }, [c.balance, parts]);

  const value = toInt(amount);
  const suggestedTip = tipFor(value, c.suggestedTipPercent);
  const tipValue = tipOn ? (tip === '' ? suggestedTip : toInt(tip)) : 0;
  const receivedValue = toInt(received);
  const change = method === 'cash' && receivedValue ? receivedValue - value - tipValue : null;

  const submit = () =>
    start(async () => {
      setError(null);
      setDone(null);
      const result = await payAction(c.session.id, {
        method,
        amount: value,
        tip: tipValue,
        received: method === 'cash' && receivedValue ? receivedValue : null,
        reference,
        clientKey,
      });
      if (result.error) return setError(result.error);
      setClientKey(newKey());
      // Pagó una de las partes: quedan las demás.
      setParts((n) => Math.max(1, n - 1));
      setReceived('');
      setReference('');
      setTip('');
      setDone(
        `${result.closed ? 'Cuenta pagada y mesa cerrada.' : 'Pago registrado.'}${result.change ? ` Vueltas: ${formatCop(result.change)}.` : ''}`,
      );
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/caja" className="text-[14px] text-muted-foreground hover:text-foreground">
            ← Caja
          </Link>
          <h1 className="mt-1 font-display text-[26px] font-bold">Cobrar mesa {c.session.tableNumber}</h1>
          <p className="text-[14px] text-muted-foreground">
            {c.session.guests} personas · abrió {c.session.openedBy} a las {formatTime(c.session.openedAt, timeZone)}
            {closed ? ' · cerrada' : ''}
          </p>
        </div>
        <Link href={`/cuenta/${c.session.id}`} target="_blank" className={quietButton}>
          Imprimir precuenta
        </Link>
      </div>
      {done ? <Alert tone="ok">{done}</Alert> : null}
      {!shiftOpen && !closed ? (
        <Alert>
          La caja está cerrada.{' '}
          <Link href="/app/caja" className="underline">
            Ábrela
          </Link>{' '}
          para cobrar.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">Consumo</h2>
          <ul className="mt-3 divide-y divide-white/[0.06] text-[14.5px]">
            {c.lines.map((l) => (
              <li key={`${l.name}-${l.unitPrice}`} className="flex justify-between gap-3 py-2">
                <span>
                  {l.quantity} × {l.name} <span className="text-muted-foreground">({formatCop(l.unitPrice)})</span>
                </span>
                <span>{formatCop(l.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4 text-[15px]">
            <Row label="Subtotal" value={formatCop(c.subtotal)} />
            {c.discounts.map((d) => (
              <div key={d.id} className={`flex items-center justify-between gap-3 ${d.voided ? 'line-through opacity-50' : ''}`}>
                <dt className="text-muted-foreground">
                  Descuento{d.percent ? ` ${d.percent} %` : ''}: {d.reason} <span className="text-[12.5px]">({d.appliedBy})</span>
                </dt>
                <dd className="flex items-center gap-2">
                  −{formatCop(d.amount)}
                  {!d.voided && !closed ? (
                    <ActionForm action={voidDiscountAction} showOk={false} className="inline">
                      {() => (
                        <>
                          <input type="hidden" name="discountId" value={d.id} />
                          <input type="hidden" name="sessionId" value={c.session.id} />
                          <button className="text-[12.5px] text-muted-foreground hover:text-[#ffb4b5]">Quitar</button>
                        </>
                      )}
                    </ActionForm>
                  ) : null}
                </dd>
              </div>
            ))}
            <Row label="Total" value={formatCop(c.total)} strong />
            <Row label="Pagado" value={formatCop(c.paid)} />
            {c.tips ? <Row label="Propinas recibidas" value={formatCop(c.tips)} /> : null}
            <Row label="Falta por pagar" value={formatCop(c.balance)} strong />
          </dl>

          {c.payments.length ? (
            <>
              <h3 className="mt-6 font-display text-[16px] font-bold">Pagos</h3>
              <ul className="mt-2 divide-y divide-white/[0.06] text-[14px]">
                {c.payments.map((p) => (
                  <PaymentRow key={p.id} payment={p} sessionId={c.session.id} canReverse={canReverse} timeZone={timeZone} />
                ))}
              </ul>
            </>
          ) : null}

          {!closed && c.balance > 0 ? (
            <details className="mt-6 rounded-2xl border border-white/[0.08] px-4 py-3">
              <summary className="cursor-pointer text-[14.5px] font-medium">Aplicar descuento</summary>
              <ActionForm action={discountAction} resetOnOk className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                {(state) => (
                  <>
                    <input type="hidden" name="sessionId" value={c.session.id} />
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="kind">
                        En
                      </label>
                      <select id="kind" name="kind" className={inputClass} defaultValue={state?.values?.kind ?? 'percent'}>
                        <option value="percent">Porcentaje (%)</option>
                        <option value="amount">Pesos ($)</option>
                      </select>
                    </div>
                    <Field label="Valor" name="value" inputMode="numeric" required defaultValue={state?.values?.value} />
                    <div className="sm:col-span-2">
                      <Field label="Motivo" name="reason" required minLength={3} maxLength={200} placeholder="Cliente frecuente, demora, cortesía…" defaultValue={state?.values?.reason} />
                    </div>
                    <p className="text-[12.5px] text-muted-foreground sm:col-span-2">
                      {canUnlimited ? 'Sin límite para tu rol.' : `Hasta ${c.discountLimit} % de la cuenta. Para más, el administrador.`} Queda en la auditoría.
                    </p>
                    <div className="sm:col-span-2">
                      <SubmitButton tone="quiet" pendingText="Aplicando…">
                        Aplicar
                      </SubmitButton>
                    </div>
                  </>
                )}
              </ActionForm>
            </details>
          ) : null}
        </section>

        {!closed && c.balance > 0 && shiftOpen ? (
          <aside className={`${card} space-y-4 lg:sticky lg:top-[132px] lg:self-start`}>
            <h2 className="font-display text-[18px] font-bold">Cobrar</h2>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Dividir la cuenta</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setParts(n)}
                    className={`rounded-full px-3.5 py-1.5 text-[14px] ${parts === n ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground'}`}
                  >
                    {n === 1 ? 'Todo' : `${n} partes`}
                  </button>
                ))}
              </div>
              {parts > 1 ? <p className="text-[12.5px] text-muted-foreground">Cada persona paga su parte; la última paga lo que falte.</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Medio de pago">
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={`rounded-2xl px-2 py-3 text-[14px] font-medium ${method === m ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground'}`}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            <Field label="Valor a pagar" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-[#8a9bff]" checked={tipOn} onChange={(e) => setTipOn(e.target.checked)} />
                Propina voluntaria ({c.suggestedTipPercent} % sugerido: {formatCop(suggestedTip)})
              </label>
              {tipOn ? (
                <input className={inputClass} inputMode="numeric" placeholder={String(suggestedTip)} value={tip} onChange={(e) => setTip(e.target.value)} aria-label="Valor de la propina" />
              ) : null}
            </div>
            {method === 'cash' ? (
              <div className="space-y-1.5">
                <Field label="Recibido en efectivo" name="received" inputMode="numeric" placeholder={String(value + tipValue)} value={received} onChange={(e) => setReceived(e.target.value)} />
                {change !== null ? (
                  <p className={`text-[15px] font-semibold ${change < 0 ? 'text-[#ffb4b5]' : 'text-success'}`}>{change < 0 ? `Faltan ${formatCop(-change)}` : `Vueltas: ${formatCop(change)}`}</p>
                ) : null}
              </div>
            ) : (
              <Field label={method === 'card' ? 'Número del voucher (opcional)' : 'Referencia (opcional)'} name="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
            )}
            <div className="rounded-2xl bg-white/[0.04] p-3 text-[14.5px]">
              <Row label="Abona a la cuenta" value={formatCop(value)} />
              <Row label="Propina" value={formatCop(tipValue)} />
              <Row label="Total a cobrar" value={formatCop(value + tipValue)} strong />
            </div>
            {error ? <Alert>{error}</Alert> : null}
            <button type="button" className={`${primaryButton} w-full py-3 text-[16px]`} disabled={pending || !clientKey || value <= 0} onClick={submit}>
              {pending ? 'Cobrando…' : value >= c.balance ? 'Cobrar y cerrar mesa' : 'Registrar pago'}
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
      <dd className={strong ? 'font-display text-[17px] font-bold' : ''}>{value}</dd>
    </div>
  );
}

function PaymentRow({ payment: p, sessionId, canReverse, timeZone }: { payment: View['payments'][number]; sessionId: string; canReverse: boolean; timeZone: string }) {
  const [reversing, setReversing] = useState(false);
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={p.reversed ? 'line-through opacity-50' : ''}>
          {METHOD_LABEL[p.method]} · {formatCop(p.amount)}
          {p.tip ? ` + propina ${formatCop(p.tip)}` : ''}
          {p.change ? ` · vueltas ${formatCop(p.change)}` : ''}
          {p.reference ? ` · ${p.reference}` : ''}
          <span className="block text-[12.5px] text-muted-foreground no-underline">
            {p.createdBy} · {formatTime(p.createdAt, timeZone)}
          </span>
        </span>
        {p.reversed ? (
          <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[12px] text-[#ffb4b5]">Reversado</span>
        ) : canReverse ? (
          <button type="button" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]" onClick={() => setReversing(!reversing)}>
            Reversar
          </button>
        ) : null}
      </div>
      {p.reverseReason ? <p className="text-[12.5px] text-muted-foreground">Motivo: {p.reverseReason}</p> : null}
      {reversing ? (
        <ActionForm action={reversePaymentAction} onOk={() => setReversing(false)} className="mt-2 flex flex-wrap items-end gap-2">
          {() => (
            <>
              <input type="hidden" name="paymentId" value={p.id} />
              <input type="hidden" name="sessionId" value={sessionId} />
              <div className="min-w-[200px] flex-1">
                <Field label="Motivo" name="reason" required minLength={3} maxLength={300} placeholder="La transferencia no llegó…" />
              </div>
              <SubmitButton tone="danger" pendingText="Reversando…">
                Reversar pago
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
