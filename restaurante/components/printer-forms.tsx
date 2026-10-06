'use client';

import { useState } from 'react';
import { createAgentCodeAction, printBillAction, printTestAction, removePrinterAction, reprintAction, savePrinterAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Alert, CheckField, Field, Select, card, quietButton } from './ui';
import { useT } from './i18n';
import type { T } from '@/lib/i18n';

export type PrinterView = {
  id: string;
  name: string;
  host: string;
  port: number;
  width: number;
  printsKitchen: boolean;
  printsBar: boolean;
  printsCashier: boolean;
  copies: number;
  isActive: boolean;
};

const PAPER = [
  { width: 48, label: '80 mm' },
  { width: 42, label: '80 mm (letra más grande)' },
  { width: 32, label: '58 mm' },
];

function PrinterFields({ p, values }: { p?: PrinterView; values?: Record<string, string> }) {
  const t = useT();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('Nombre')} name="name" required maxLength={60} placeholder={t('Cocina')} defaultValue={values?.name ?? p?.name} />
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={t('Dirección IP')} name="host" required placeholder="192.168.1.50" defaultValue={values?.host ?? p?.host} autoCapitalize="none" />
          <Field label={t('Puerto')} name="port" inputMode="numeric" required defaultValue={values?.port ?? String(p?.port ?? 9100)} />
        </div>
        <Select label={t('Papel')} name="width" defaultValue={values?.width ?? String(p?.width ?? 48)}>
          {PAPER.map((o) => (
            <option key={o.width} value={o.width}>
              {t(o.label)}
            </option>
          ))}
        </Select>
        <Select label={t('Copias de cada papel')} name="copies" defaultValue={values?.copies ?? String(p?.copies ?? 1)}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <p className="mt-5 text-sm font-medium text-foreground">{t('¿Qué imprime?')}</p>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <CheckField name="kitchen" label={t('Comandas de cocina')} hint={t('Los platos de las categorías de cocina.')} defaultChecked={p?.printsKitchen} />
        <CheckField name="bar" label={t('Comandas de barra')} hint={t('Los tragos de las categorías de barra.')} defaultChecked={p?.printsBar} />
        <CheckField name="cashier" label={t('Caja')} hint={t('Precuentas y cierre de caja.')} defaultChecked={p?.printsCashier} />
      </div>
    </>
  );
}

export function NewPrinterForm() {
  const t = useT();
  return (
    <ActionForm action={savePrinterAction} resetOnOk>
      {(state) => (
        <>
          <PrinterFields values={state?.values} />
          <SubmitButton pendingText={t('Agregando…')}>{t('Agregar impresora')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const targets = (p: PrinterView, t: T) =>
  [p.printsKitchen ? t('Cocina') : null, p.printsBar ? t('Barra') : null, p.printsCashier ? t('Caja') : null].filter(Boolean).join(' · ') || t('No imprime nada todavía');

export function PrinterRow({ printer }: { printer: PrinterView }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view');
  const t = useT();
  const paper = PAPER.find((o) => o.width === printer.width)?.label;
  return (
    <li className={`${card} ${printer.isActive ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[17px] font-semibold">{printer.name}</p>
          <p className="text-[14px] text-muted-foreground">
            {targets(printer, t)} · {printer.host}:{printer.port} · {paper ? t(paper) : ''}
            {printer.copies > 1 ? ` · ${t('{n} copias', { n: printer.copies })}` : ''}
            {printer.isActive ? '' : ` · ${t('Apagada')}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionForm action={printTestAction} className="flex">
            {() => (
              <>
                <input type="hidden" name="printerId" value={printer.id} />
                <SubmitButton tone="quiet" pendingText={t('Enviando…')}>
                  {t('Imprimir prueba')}
                </SubmitButton>
              </>
            )}
          </ActionForm>
          <button type="button" className={quietButton} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>
            {mode === 'edit' ? t('Cerrar') : t('Editar')}
          </button>
        </div>
      </div>
      {mode === 'edit' ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <ActionForm action={savePrinterAction} onOk={() => setMode('view')}>
            {(state) => (
              <>
                <input type="hidden" name="printerId" value={printer.id} />
                <PrinterFields p={printer} values={state?.values} />
                <CheckField name="isActive" label={t('Prendida')} hint={t('Apagada no recibe nada (por ejemplo, si está dañada).')} defaultChecked={printer.isActive} />
                <div className="flex flex-wrap gap-2">
                  <SubmitButton pendingText={t('Guardando…')}>{t('Guardar')}</SubmitButton>
                  <button type="button" className={quietButton} onClick={() => setMode('remove')}>
                    {t('Quitar impresora')}
                  </button>
                </div>
              </>
            )}
          </ActionForm>
        </div>
      ) : null}
      {mode === 'remove' ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <ActionForm action={removePrinterAction}>
            {() => (
              <>
                <input type="hidden" name="printerId" value={printer.id} />
                <p className="text-[14.5px]">{t('¿Quitar «{name}»? Se borra también su lista de impresiones.', { name: printer.name })}</p>
                <div className="flex gap-2">
                  <SubmitButton tone="danger" pendingText={t('Quitando…')}>
                    {t('Sí, quitar')}
                  </SubmitButton>
                  <button type="button" className={quietButton} onClick={() => setMode('view')}>
                    {t('No')}
                  </button>
                </div>
              </>
            )}
          </ActionForm>
        </div>
      ) : null}
    </li>
  );
}

export function AgentCodeForm({ hasCode }: { hasCode: boolean }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  return (
    <ActionForm action={createAgentCodeAction} showOk={false}>
      {(state) =>
        state?.ok && state.message ? (
          <div className="space-y-3">
            <Alert tone="ok">{t('Código nuevo. Cópialo ahora: por seguridad no se vuelve a mostrar.')}</Alert>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px]">{state.message}</code>
              <button
                type="button"
                className={quietButton}
                onClick={() => {
                  void navigator.clipboard?.writeText(state.message!).then(() => setCopied(true));
                }}
              >
                {copied ? t('Copiado') : t('Copiar')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {hasCode ? (
              <p className="text-[14px] text-muted-foreground">
                {t('Ya hay un código. Si haces uno nuevo, el programa del computador deja de funcionar hasta que le pongas el nuevo.')}
              </p>
            ) : null}
            <SubmitButton tone={hasCode ? 'quiet' : 'primary'} pendingText={t('Creando…')}>
              {hasCode ? t('Cambiar el código') : t('Crear el código')}
            </SubmitButton>
          </div>
        )
      }
    </ActionForm>
  );
}

export function ReprintButton({ jobId }: { jobId: string }) {
  const t = useT();
  return (
    <ActionForm action={reprintAction} className="flex items-center gap-2">
      {() => (
        <>
          <input type="hidden" name="jobId" value={jobId} />
          <SubmitButton tone="quiet" pendingText={t('Enviando…')} className="py-1.5 text-[13px]">
            {t('Reimprimir')}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** «Imprimir precuenta» en la impresora de caja (cuando la sede tiene una). */
export function PrintBillButton({ sessionId, className }: { sessionId: string; className?: string }) {
  const t = useT();
  return (
    <ActionForm action={printBillAction} className={className ?? 'flex flex-col gap-2'}>
      {() => (
        <>
          <input type="hidden" name="sessionId" value={sessionId} />
          <SubmitButton tone="quiet" pendingText={t('Enviando…')} className="w-full">
            {t('Imprimir precuenta')}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
