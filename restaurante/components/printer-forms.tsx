'use client';

import { useState } from 'react';
import { createAgentCodeAction, printBillAction, printTestAction, removePrinterAction, reprintAction, savePrinterAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Alert, CheckField, Field, Select, card, quietButton } from './ui';

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
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" name="name" required maxLength={60} placeholder="Cocina" defaultValue={values?.name ?? p?.name} />
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Dirección IP" name="host" required placeholder="192.168.1.50" defaultValue={values?.host ?? p?.host} autoCapitalize="none" />
          <Field label="Puerto" name="port" inputMode="numeric" required defaultValue={values?.port ?? String(p?.port ?? 9100)} />
        </div>
        <Select label="Papel" name="width" defaultValue={values?.width ?? String(p?.width ?? 48)}>
          {PAPER.map((o) => (
            <option key={o.width} value={o.width}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Copias de cada papel" name="copies" defaultValue={values?.copies ?? String(p?.copies ?? 1)}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <p className="mt-5 text-sm font-medium text-foreground">¿Qué imprime?</p>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <CheckField name="kitchen" label="Comandas de cocina" hint="Los platos de las categorías de cocina." defaultChecked={p?.printsKitchen} />
        <CheckField name="bar" label="Comandas de barra" hint="Los tragos de las categorías de barra." defaultChecked={p?.printsBar} />
        <CheckField name="cashier" label="Caja" hint="Precuentas y cierre de caja." defaultChecked={p?.printsCashier} />
      </div>
    </>
  );
}

export function NewPrinterForm() {
  return (
    <ActionForm action={savePrinterAction} resetOnOk>
      {(state) => (
        <>
          <PrinterFields values={state?.values} />
          <SubmitButton pendingText="Agregando…">Agregar impresora</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const targets = (p: PrinterView) =>
  [p.printsKitchen ? 'Cocina' : null, p.printsBar ? 'Barra' : null, p.printsCashier ? 'Caja' : null].filter(Boolean).join(' · ') || 'No imprime nada todavía';

export function PrinterRow({ printer }: { printer: PrinterView }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view');
  return (
    <li className={`${card} ${printer.isActive ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[17px] font-semibold">{printer.name}</p>
          <p className="text-[14px] text-muted-foreground">
            {targets(printer)} · {printer.host}:{printer.port} · {PAPER.find((o) => o.width === printer.width)?.label}
            {printer.copies > 1 ? ` · ${printer.copies} copias` : ''}
            {printer.isActive ? '' : ' · Apagada'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionForm action={printTestAction} className="flex">
            {() => (
              <>
                <input type="hidden" name="printerId" value={printer.id} />
                <SubmitButton tone="quiet" pendingText="Enviando…">
                  Imprimir prueba
                </SubmitButton>
              </>
            )}
          </ActionForm>
          <button type="button" className={quietButton} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>
            {mode === 'edit' ? 'Cerrar' : 'Editar'}
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
                <CheckField name="isActive" label="Prendida" hint="Apagada no recibe nada (por ejemplo, si está dañada)." defaultChecked={printer.isActive} />
                <div className="flex flex-wrap gap-2">
                  <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
                  <button type="button" className={quietButton} onClick={() => setMode('remove')}>
                    Quitar impresora
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
                <p className="text-[14.5px]">¿Quitar «{printer.name}»? Se borra también su lista de impresiones.</p>
                <div className="flex gap-2">
                  <SubmitButton tone="danger" pendingText="Quitando…">
                    Sí, quitar
                  </SubmitButton>
                  <button type="button" className={quietButton} onClick={() => setMode('view')}>
                    No
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
  return (
    <ActionForm action={createAgentCodeAction} showOk={false}>
      {(state) =>
        state?.ok && state.message ? (
          <div className="space-y-3">
            <Alert tone="ok">Código nuevo. Cópialo ahora: por seguridad no se vuelve a mostrar.</Alert>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px]">{state.message}</code>
              <button
                type="button"
                className={quietButton}
                onClick={() => {
                  void navigator.clipboard?.writeText(state.message!).then(() => setCopied(true));
                }}
              >
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {hasCode ? (
              <p className="text-[14px] text-muted-foreground">
                Ya hay un código. Si haces uno nuevo, el programa del computador deja de funcionar hasta que le pongas el nuevo.
              </p>
            ) : null}
            <SubmitButton tone={hasCode ? 'quiet' : 'primary'} pendingText="Creando…">
              {hasCode ? 'Cambiar el código' : 'Crear el código'}
            </SubmitButton>
          </div>
        )
      }
    </ActionForm>
  );
}

export function ReprintButton({ jobId }: { jobId: string }) {
  return (
    <ActionForm action={reprintAction} className="flex items-center gap-2">
      {() => (
        <>
          <input type="hidden" name="jobId" value={jobId} />
          <SubmitButton tone="quiet" pendingText="Enviando…" className="py-1.5 text-[13px]">
            Reimprimir
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** «Imprimir precuenta» en la impresora de caja (cuando la sede tiene una). */
export function PrintBillButton({ sessionId, className }: { sessionId: string; className?: string }) {
  return (
    <ActionForm action={printBillAction} className={className ?? 'flex flex-col gap-2'}>
      {() => (
        <>
          <input type="hidden" name="sessionId" value={sessionId} />
          <SubmitButton tone="quiet" pendingText="Enviando…" className="w-full">
            Imprimir precuenta
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
