'use client';

import { useState, useTransition } from 'react';
import { addLossAction, cashPaidOutAction, closeShiftAction, moveCashPaymentAction, movementAction, openShiftAction, voidLossAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea, inputClass, quietButton } from './ui';
import { formatCop, formatTime } from '@/lib/format';
import { DENOMINATIONS, cashCountTotal, cleanCashCount, denominationKey } from '@/lib/cash-count';
import { useLang, useT } from './i18n';

export function OpenShiftForm() {
  const t = useT();
  return (
    <ActionForm action={openShiftAction}>
      {(state) => (
        <>
          <Field label={t('Base en efectivo')} name="openingAmount" inputMode="numeric" placeholder="200000" defaultValue={state?.values?.openingAmount} hint={t('La plata con la que arranca la caja (para dar vueltas).')} />
          <SubmitButton pendingText={t('Abriendo…')}>{t('Abrir caja')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MovementForm() {
  const t = useT();
  return (
    <ActionForm action={movementAction} resetOnOk className="grid gap-3 sm:grid-cols-[140px_1fr]">
      {(state) => (
        <>
          <Select label={t('Tipo')} name="kind" defaultValue={state?.values?.kind ?? 'out'}>
            <option value="out">{t('Sale')}</option>
            <option value="in">{t('Entra')}</option>
          </Select>
          <Field label={t('Valor')} name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <div className="sm:col-span-2">
            <Field label={t('Motivo')} name="reason" required minLength={3} maxLength={200} placeholder={t('Pago del hielo, cambio que trajo el dueño…')} defaultValue={state?.values?.reason} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton tone="quiet" pendingText={t('Guardando…')}>
              {t('Registrar')}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Caja → «Pérdidas del día»: lo que se rompió o se dañó y no es del inventario, con su valor estimado. */
export function LossForm() {
  const t = useT();
  return (
    <ActionForm action={addLossAction} resetOnOk className="grid gap-3 sm:grid-cols-[1fr_160px]">
      {(state) => (
        <>
          <Field id="loss-description" label={t('¿Qué se perdió?')} name="description" required minLength={3} maxLength={200} placeholder={t('Se rompió un vaso, se dañó un plato…')} defaultValue={state?.values?.description} />
          <Field id="loss-amount" label={t('Valor estimado')} name="amount" inputMode="numeric" required defaultValue={state?.values?.amount} />
          <div className="sm:col-span-2">
            <SubmitButton tone="quiet" pendingText={t('Guardando…')}>
              {t('Anotar pérdida')}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** «Anular» una pérdida mal anotada. */
export function VoidLossButton({ lossId }: { lossId: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        className="text-[12.5px] text-muted-foreground hover:text-[#ffb4b5] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setError(await voidLossAction(lossId));
          })
        }
      >
        {t('Anular')}
      </button>
      {error ? <span className="text-[12px] text-[#ffb4b5]">{error}</span> : null}
    </span>
  );
}

/** Un cobro en efectivo de la caja abierta, para corregir su medio si se marcó mal (fechas ya en texto). */
export type CashPaymentRow = { id: string; tableNumber: string | null; amount: number; tip: number; createdBy: string; createdAt: string };

const digits = (v: string) => Number(v.replace(/[^\d]/g, '') || 0);
// Estas casillas van dentro del formulario del cierre: un Enter en ellas no debe cerrar la caja.
const noEnter = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') e.preventDefault();
};

/**
 * Cuando el arqueo dice que falta plata (29 oct 2026, pedido de Rigoberto en pleno cierre): las dos causas de siempre,
 * para anotarlas sin salir del cierre. Cada una se guarda de una y el efectivo esperado se recalcula (lo contado se queda).
 */
function ShortageHelper({ payments, timeZone }: { payments: CashPaymentRow[]; timeZone: string }) {
  const t = useT();
  const lang = useLang();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [outAmount, setOutAmount] = useState('');
  const [outWhat, setOutWhat] = useState('');
  const [moves, setMoves] = useState<Record<string, { method: string; amount: string }>>({});
  const act = (work: () => Promise<string | null>, ok: string, after?: () => void) =>
    start(async () => {
      setDone(null);
      const err = await work();
      setError(err);
      if (!err) {
        setDone(ok);
        after?.();
      }
    });
  return (
    <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning/[0.04] p-3">
      <p className="text-[14px] font-semibold">{t('¿Por qué falta? Si fue por alguna de estas, anótalo aquí y la cuenta se corrige sola.')}</p>
      <details className="rounded-xl border border-white/[0.08] p-3">
        <summary className="cursor-pointer text-[14.5px] font-semibold">{t('Se sacó plata de la caja para pagar algo')}</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr]">
          <Field id="short-out-amount" onKeyDown={noEnter} label={t('Valor')} inputMode="numeric" value={outAmount} onChange={(e) => setOutAmount(e.target.value.replace(/[^\d]/g, ''))} />
          <Field id="short-out-what" onKeyDown={noEnter} label={t('¿Qué se pagó?')} maxLength={190} placeholder={t('El hielo, el domicilio, un proveedor…')} value={outWhat} onChange={(e) => setOutWhat(e.target.value)} />
        </div>
        <button
          type="button"
          disabled={pending || !outAmount || outWhat.trim().length < 3}
          className={`${quietButton} mt-2 disabled:opacity-50`}
          onClick={() =>
            act(() => cashPaidOutAction(digits(outAmount), outWhat), t('Anotado como salida de la caja.'), () => {
              setOutAmount('');
              setOutWhat('');
            })
          }
        >
          {t('Anotar salida')}
        </button>
      </details>
      <details className="rounded-xl border border-white/[0.08] p-3">
        <summary className="cursor-pointer text-[14.5px] font-semibold">{t('Se cobró por transferencia o datáfono pero se marcó en efectivo')}</summary>
        {payments.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-muted-foreground">{t('No hay cobros en efectivo en esta caja.')}</p>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('Busca el cobro, escoge cómo se pagó de verdad y cuánto (todo o una parte).')}</p>
            <ul className="mt-2 divide-y divide-white/[0.06]">
              {payments.map((p) => {
                const total = p.amount + p.tip;
                const m = moves[p.id] ?? { method: 'transfer', amount: String(total) };
                const set = (patch: Partial<typeof m>) => setMoves((all) => ({ ...all, [p.id]: { ...m, ...patch } }));
                return (
                  <li key={p.id} className="space-y-2 py-2.5">
                    <div className="text-[14px]">
                      <span className="font-semibold">{p.tableNumber ? t('Mesa {n}', { n: p.tableNumber }) : t('Cita')}</span> · {formatCop(total)}
                      <span className="block text-[12.5px] text-muted-foreground">
                        {formatTime(p.createdAt, timeZone, lang)} · {p.createdBy}
                        {p.tip ? t(' · propina {amount}', { amount: formatCop(p.tip) }) : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <Select id={`move-method-${p.id}`} label={t('Fue por')} value={m.method} onChange={(e) => set({ method: e.target.value })}>
                        <option value="transfer">{t('Transferencia')}</option>
                        <option value="card">{t('Datáfono')}</option>
                      </Select>
                      <Field
                        id={`move-amount-${p.id}`}
                        onKeyDown={noEnter}
                        label={t('¿Cuánto?')}
                        inputMode="numeric"
                        value={m.amount}
                        onChange={(e) => set({ amount: e.target.value.replace(/[^\d]/g, '') })}
                      />
                      <button
                        type="button"
                        disabled={pending || !m.amount}
                        className={`${quietButton} disabled:opacity-50`}
                        onClick={() => act(() => moveCashPaymentAction(p.id, m.method, digits(m.amount)), t('Cobro corregido.'))}
                      >
                        {t('Cambiar')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </details>
      {error ? <p className="text-[13.5px] font-semibold text-destructive">{error}</p> : null}
      {done ? <p className="text-[13.5px] font-semibold text-success">{done}</p> : null}
    </div>
  );
}

export function CloseShiftForm({ expected, cashPayments = [], timeZone = 'America/Bogota' }: { expected?: number; cashPayments?: CashPaymentRow[]; timeZone?: string }) {
  const t = useT();
  // Arqueo (28 oct 2026): cuántos billetes y monedas de cada uno; si se llena, el efectivo contado es su suma.
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [manual, setManual] = useState('');
  const count = cleanCashCount(counts);
  const total = cashCountTotal(count);
  const counted = count ? String(total) : manual;
  const diff = expected !== undefined && counted !== '' ? Number(counted.replace(/[^\d]/g, '')) - expected : null;
  return (
    <ActionForm action={closeShiftAction}>
      {(state) => (
        <>
          <details open className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-[15px] font-semibold">{t('Arqueo de billetes y monedas')}</summary>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('Escribe cuántos hay de cada uno; el efectivo contado se suma solo.')}</p>
            {(['bill', 'coin'] as const).map((kind) => (
              <div key={kind} className="mt-3">
                <p className="text-[13px] font-semibold text-muted-foreground">{kind === 'bill' ? t('Billetes') : t('Monedas')}</p>
                <div className="mt-1.5 space-y-1.5">
                  {DENOMINATIONS.filter((d) => d.kind === kind).map((d) => {
                    const key = denominationKey(d);
                    const qty = Number(counts[key] || 0);
                    return (
                      <div key={key} className="grid grid-cols-[96px_1fr_auto] items-center gap-2 text-[14px]">
                        <label htmlFor={`count-${key}`}>{formatCop(d.value)}</label>
                        <input
                          id={`count-${key}`}
                          className={`${inputClass} py-1.5`}
                          inputMode="numeric"
                          placeholder="0"
                          value={counts[key] ?? ''}
                          onChange={(e) => setCounts((c) => ({ ...c, [key]: e.target.value.replace(/[^\d]/g, '') }))}
                          aria-label={t('Cuántos de {amount}', { amount: formatCop(d.value) })}
                        />
                        <span className="min-w-[88px] text-right text-muted-foreground">{qty ? formatCop(qty * d.value) : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="mt-3 flex justify-between border-t border-white/[0.06] pt-2 text-[15px] font-semibold">
              <span>{t('Total del arqueo')}</span>
              <span>{formatCop(total)}</span>
            </p>
          </details>
          <input type="hidden" name="cashCount" value={count ? JSON.stringify(count) : ''} />
          <Field
            label={t('Efectivo contado')}
            name="countedCash"
            inputMode="numeric"
            required
            readOnly={Boolean(count)}
            value={counted || (state?.values?.countedCash ?? '')}
            onChange={(e) => setManual(e.target.value)}
            hint={count ? t('Sale del arqueo.') : t('O escríbelo directo si no hiciste arqueo.')}
          />
          {diff !== null ? (
            <p className={`text-[14px] font-semibold ${diff === 0 ? 'text-success' : 'text-warning'}`}>
              {diff === 0 ? t('Cuadra') : diff > 0 ? t('Sobran {amount}', { amount: formatCop(diff) }) : t('Faltan {amount}', { amount: formatCop(-diff) })}
            </p>
          ) : null}
          {diff !== null && diff < 0 ? <ShortageHelper payments={cashPayments} timeZone={timeZone} /> : null}
          <p className="mt-3 text-[13.5px] text-muted-foreground">{t('¿Cómo se reparte el efectivo? Lo que no vaya en sobres ni en la caja fuerte queda en la caja.')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('Sobre para la cocina')} name="envelopeKitchen" inputMode="numeric" placeholder="0" defaultValue={state?.values?.envelopeKitchen} />
            <Field label={t('Sobre para el bar')} name="envelopeBar" inputMode="numeric" placeholder="0" defaultValue={state?.values?.envelopeBar} />
            <Field label={t('Caja fuerte')} name="safeAmount" inputMode="numeric" placeholder="0" defaultValue={state?.values?.safeAmount} />
          </div>
          <TextArea
            label={t('Observaciones del día (opcional)')}
            name="notes"
            rows={4}
            maxLength={1500}
            placeholder={t('Lo que pasó en el restaurante: se cayó un vaso, se devolvió un plato… Si la caja no cuadra, por qué.')}
            hint={t('Sale impreso en «Comentarios» del formulario diario.')}
            defaultValue={state?.values?.notes}
          />
          <SubmitButton pendingText={t('Cerrando…')}>{t('Cerrar caja')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
