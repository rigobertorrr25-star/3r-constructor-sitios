'use client';

import { useState, useTransition } from 'react';
import { addLossAction, closeShiftAction, movementAction, openShiftAction, voidLossAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select, TextArea, inputClass } from './ui';
import { formatCop } from '@/lib/format';
import { DENOMINATIONS, cashCountTotal, cleanCashCount, denominationKey } from '@/lib/cash-count';
import { useT } from './i18n';

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

export function CloseShiftForm({ expected }: { expected?: number }) {
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
