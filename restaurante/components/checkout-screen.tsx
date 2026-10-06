'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { discountAction, payAction, reversePaymentAction, voidDiscountAction } from '@/app/actions';
import type { Checkout, Method } from '@/lib/cash';
import { formatCop, formatTime } from '@/lib/format';
import { isNetworkError, retryDelay } from '@/lib/offline';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Alert, Field, card, inputClass, primaryButton, quietButton } from './ui';
import { PrintBillButton } from './printer-forms';
import { useLang, useT, useTr } from './i18n';

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

export function CheckoutScreen({ checkout, shiftOpen, canReverse, canUnlimited, timeZone, printBill = false }: { checkout: View; shiftOpen: boolean; canReverse: boolean; canUnlimited: boolean; timeZone: string; printBill?: boolean }) {
  const c = checkout;
  const t = useT();
  const lang = useLang();
  const trx = useTr();
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

  // Pago que no alcanzó a llegar por falta de conexión: se reintenta tal cual (mismo identificador = sin cobro doble).
  type Payload = Parameters<typeof payAction>[1];
  const [queued, setQueued] = useState<Payload | null>(null);
  const attempt = useRef(0);

  const execute = async (payload: Payload) => {
    setError(null);
    setDone(null);
    try {
      const result = await payAction(c.session.id, payload);
      setQueued(null);
      attempt.current = 0;
      if (result.error) return setError(result.error);
      setClientKey(newKey());
      // Pagó una de las partes: quedan las demás.
      setParts((n) => Math.max(1, n - 1));
      setReceived('');
      setReference('');
      setTip('');
      const paid = result.closed ? t('Cuenta pagada y mesa cerrada.') : t('Pago registrado.');
      setDone(result.change ? `${paid} ${t('Vueltas: {amount}.', { amount: formatCop(result.change) })}` : paid);
    } catch (e) {
      if (isNetworkError(e)) setQueued(payload);
      else setError(t('Algo salió mal. Revisa la lista de pagos antes de volver a cobrar.'));
    }
  };

  const submit = () =>
    start(() =>
      execute({
        method,
        amount: value,
        tip: tipValue,
        received: method === 'cash' && receivedValue ? receivedValue : null,
        reference,
        clientKey,
      }),
    );

  useEffect(() => {
    if (!queued) return;
    const retry = () => start(() => execute(queued));
    const timer = setTimeout(() => {
      attempt.current += 1;
      retry();
    }, retryDelay(attempt.current));
    window.addEventListener('online', retry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, pending]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/app/caja" className="text-[14px] text-muted-foreground hover:text-foreground">
            ← {t('Caja')}
          </Link>
          <h1 className="mt-1 font-display text-[26px] font-bold">{t('Cobrar mesa {n}', { n: c.session.tableNumber })}</h1>
          <p className="text-[14px] text-muted-foreground">
            {c.session.guests === 1 ? t('1 persona') : t('{n} personas', { n: c.session.guests })} ·{' '}
            {t('abrió {name} a las {time}', { name: c.session.openedBy, time: formatTime(c.session.openedAt, timeZone, lang) })}
            {closed ? ` · ${t('cerrada')}` : ''}
          </p>
        </div>
        {printBill ? (
          <PrintBillButton sessionId={c.session.id} className="flex" />
        ) : (
          <Link href={`/cuenta/${c.session.id}`} target="_blank" className={quietButton}>
            {t('Imprimir precuenta')}
          </Link>
        )}
      </div>
      {done ? <Alert tone="ok">{done}</Alert> : null}
      {!shiftOpen && !closed ? (
        <Alert>
          {t('La caja está cerrada. {link} para cobrar.')
            .split(/(\{link\})/)
            .map((part, i) =>
              part === '{link}' ? (
                <Link key={i} href="/app/caja" className="underline">
                  {t('Ábrela')}
                </Link>
              ) : (
                part
              ),
            )}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <section className={card}>
          <h2 className="font-display text-[18px] font-bold">{t('Consumo')}</h2>
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
            <Row label={t('Subtotal')} value={formatCop(c.subtotal)} />
            {c.discounts.map((d) => (
              <div key={d.id} className={`flex items-center justify-between gap-3 ${d.voided ? 'line-through opacity-50' : ''}`}>
                <dt className="text-muted-foreground">
                  {d.percent ? t('Descuento {percent} %: {reason}', { percent: d.percent, reason: d.reason }) : t('Descuento: {reason}', { reason: d.reason })} <span className="text-[12.5px]">({d.appliedBy})</span>
                </dt>
                <dd className="flex items-center gap-2">
                  −{formatCop(d.amount)}
                  {!d.voided && !closed ? (
                    <ActionForm action={voidDiscountAction} showOk={false} className="inline">
                      {() => (
                        <>
                          <input type="hidden" name="discountId" value={d.id} />
                          <input type="hidden" name="sessionId" value={c.session.id} />
                          <button className="text-[12.5px] text-muted-foreground hover:text-[#ffb4b5]">{t('Quitar')}</button>
                        </>
                      )}
                    </ActionForm>
                  ) : null}
                </dd>
              </div>
            ))}
            <Row label={t('Total')} value={formatCop(c.total)} strong />
            <Row label={t('Pagado')} value={formatCop(c.paid)} />
            {c.tips ? <Row label={t('Propinas recibidas')} value={formatCop(c.tips)} /> : null}
            <Row label={t('Falta por pagar')} value={formatCop(c.balance)} strong />
          </dl>

          {c.payments.length ? (
            <>
              <h3 className="mt-6 font-display text-[16px] font-bold">{t('Pagos')}</h3>
              <ul className="mt-2 divide-y divide-white/[0.06] text-[14px]">
                {c.payments.map((p) => (
                  <PaymentRow key={p.id} payment={p} sessionId={c.session.id} canReverse={canReverse} timeZone={timeZone} />
                ))}
              </ul>
            </>
          ) : null}

          {!closed && c.balance > 0 ? (
            <details className="mt-6 rounded-2xl border border-white/[0.08] px-4 py-3">
              <summary className="cursor-pointer text-[14.5px] font-medium">{t('Aplicar descuento')}</summary>
              <ActionForm action={discountAction} resetOnOk className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                {(state) => (
                  <>
                    <input type="hidden" name="sessionId" value={c.session.id} />
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="kind">
                        {t('En')}
                      </label>
                      <select id="kind" name="kind" className={inputClass} defaultValue={state?.values?.kind ?? 'percent'}>
                        <option value="percent">{t('Porcentaje (%)')}</option>
                        <option value="amount">{t('Pesos ($)')}</option>
                      </select>
                    </div>
                    <Field label={t('Valor')} name="value" inputMode="numeric" required defaultValue={state?.values?.value} />
                    <div className="sm:col-span-2">
                      <Field label={t('Motivo')} name="reason" required minLength={3} maxLength={200} placeholder={t('Cliente frecuente, demora, cortesía…')} defaultValue={state?.values?.reason} />
                    </div>
                    <p className="text-[12.5px] text-muted-foreground sm:col-span-2">
                      {canUnlimited ? t('Sin límite para tu rol.') : t('Hasta {n} % de la cuenta. Para más, el administrador.', { n: c.discountLimit })} {t('Queda en la auditoría.')}
                    </p>
                    <div className="sm:col-span-2">
                      <SubmitButton tone="quiet" pendingText={t('Aplicando…')}>
                        {t('Aplicar')}
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
            <h2 className="font-display text-[18px] font-bold">{t('Cobrar')}</h2>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('Dividir la cuenta')}</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setParts(n)}
                    className={`rounded-full px-3.5 py-1.5 text-[14px] ${parts === n ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground'}`}
                  >
                    {n === 1 ? t('Todo') : t('{n} partes', { n })}
                  </button>
                ))}
              </div>
              {parts > 1 ? <p className="text-[12.5px] text-muted-foreground">{t('Cada persona paga su parte; la última paga lo que falte.')}</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('Medio de pago')}>
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={`rounded-2xl px-2 py-3 text-[14px] font-medium ${method === m ? 'bg-primary text-primary-foreground' : 'border border-white/[0.1] text-muted-foreground'}`}
                >
                  {t(METHOD_LABEL[m])}
                </button>
              ))}
            </div>
            <Field label={t('Valor a pagar')} name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-[#8a9bff]" checked={tipOn} onChange={(e) => setTipOn(e.target.checked)} />
                {t('Propina voluntaria ({percent} % sugerido: {amount})', { percent: c.suggestedTipPercent, amount: formatCop(suggestedTip) })}
              </label>
              {tipOn ? (
                <input className={inputClass} inputMode="numeric" placeholder={String(suggestedTip)} value={tip} onChange={(e) => setTip(e.target.value)} aria-label={t('Valor de la propina')} />
              ) : null}
            </div>
            {method === 'cash' ? (
              <div className="space-y-1.5">
                <Field label={t('Recibido en efectivo')} name="received" inputMode="numeric" placeholder={String(value + tipValue)} value={received} onChange={(e) => setReceived(e.target.value)} />
                {change !== null ? (
                  <p className={`text-[15px] font-semibold ${change < 0 ? 'text-[#ffb4b5]' : 'text-success'}`}>{change < 0 ? t('Faltan {amount}', { amount: formatCop(-change) }) : t('Vueltas: {amount}', { amount: formatCop(change) })}</p>
                ) : null}
              </div>
            ) : (
              <Field label={method === 'card' ? t('Número del voucher (opcional)') : t('Referencia (opcional)')} name="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
            )}
            <div className="rounded-2xl bg-white/[0.04] p-3 text-[14.5px]">
              <Row label={t('Abona a la cuenta')} value={formatCop(value)} />
              <Row label={t('Propina')} value={formatCop(tipValue)} />
              <Row label={t('Total a cobrar')} value={formatCop(value + tipValue)} strong />
            </div>
            {queued ? (
              <div role="status" className="space-y-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[14px] text-warning">
                <p>{t('Sin conexión: el pago de {amount} todavía no quedó registrado. Se reintenta solo, sin cobrar dos veces.', { amount: formatCop(queued.amount) })}</p>
                <button
                  type="button"
                  className="text-[13px] underline"
                  onClick={() => {
                    setQueued(null);
                    setError(t('Reintento cancelado. Antes de volver a cobrar, recarga y revisa la lista de pagos: puede que sí haya llegado.'));
                  }}
                >
                  {t('Cancelar reintento')}
                </button>
              </div>
            ) : null}
            {error ? <Alert>{trx(error)}</Alert> : null}
            <button type="button" className={`${primaryButton} w-full py-3 text-[16px]`} disabled={pending || Boolean(queued) || !clientKey || value <= 0} onClick={submit}>
              {queued ? t('Esperando conexión…') : pending ? t('Cobrando…') : value >= c.balance ? t('Cobrar y cerrar mesa') : t('Registrar pago')}
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
  const t = useT();
  const lang = useLang();
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={p.reversed ? 'line-through opacity-50' : ''}>
          {t(METHOD_LABEL[p.method])} · {formatCop(p.amount)}
          {p.tip ? ` + ${t('propina {amount}', { amount: formatCop(p.tip) })}` : ''}
          {p.change ? ` · ${t('vueltas {amount}', { amount: formatCop(p.change) })}` : ''}
          {p.reference ? ` · ${p.reference}` : ''}
          <span className="block text-[12.5px] text-muted-foreground no-underline">
            {p.createdBy} · {formatTime(p.createdAt, timeZone, lang)}
          </span>
        </span>
        {p.reversed ? (
          <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[12px] text-[#ffb4b5]">{t('Reversado')}</span>
        ) : canReverse ? (
          <button type="button" className="text-[13px] text-muted-foreground hover:text-[#ffb4b5]" onClick={() => setReversing(!reversing)}>
            {t('Reversar')}
          </button>
        ) : null}
      </div>
      {p.reverseReason ? <p className="text-[12.5px] text-muted-foreground">{t('Motivo: {reason}', { reason: p.reverseReason })}</p> : null}
      {reversing ? (
        <ActionForm action={reversePaymentAction} onOk={() => setReversing(false)} className="mt-2 flex flex-wrap items-end gap-2">
          {() => (
            <>
              <input type="hidden" name="paymentId" value={p.id} />
              <input type="hidden" name="sessionId" value={sessionId} />
              <div className="min-w-[200px] flex-1">
                <Field label={t('Motivo')} name="reason" required minLength={3} maxLength={300} placeholder={t('La transferencia no llegó…')} />
              </div>
              <SubmitButton tone="danger" pendingText={t('Reversando…')}>
                {t('Reversar pago')}
              </SubmitButton>
            </>
          )}
        </ActionForm>
      ) : null}
    </li>
  );
}
