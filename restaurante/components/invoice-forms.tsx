'use client';

import { useState } from 'react';
import { invoiceCustomerAction, saveFiscalAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select } from './ui';

export function FiscalForm({ fiscal }: { fiscal: { legalName: string | null; taxId: string | null; taxKind: string; resolution: string | null } }) {
  return (
    <ActionForm action={saveFiscalAction} className="grid gap-3 md:grid-cols-2">
      {(state) => (
        <>
          <Field label="Razón social o nombre" name="legalName" required defaultValue={state?.values?.legalName ?? fiscal.legalName ?? ''} />
          <Field label="NIT o cédula" name="taxId" required placeholder="900123456-7" defaultValue={state?.values?.taxId ?? fiscal.taxId ?? ''} />
          <Select label="Impuesto" name="taxKind" defaultValue={state?.values?.taxKind ?? fiscal.taxKind}>
            <option value="inc">Impuesto al consumo 8 % (restaurantes y bares)</option>
            <option value="iva">IVA 19 %</option>
            <option value="none">No responsable de impuestos</option>
          </Select>
          <Field label="Resolución de facturación (opcional)" name="resolution" maxLength={200} defaultValue={state?.values?.resolution ?? fiscal.resolution ?? ''} hint="Número y fecha de la resolución de la DIAN." />
          <div className="md:col-span-2">
            <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** "Factura a nombre de…": tipo y número de documento, nombre y correo. */
export function InvoiceCustomer({ invoiceId, sessionId }: { invoiceId: string; sessionId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="mt-1 text-[13px] text-primary hover:underline" onClick={() => setOpen(true)}>
        Poner a nombre del cliente
      </button>
    );
  return (
    <ActionForm action={invoiceCustomerAction} onOk={() => setOpen(false)} className="mt-2 grid gap-2 md:grid-cols-[140px_1fr_1.4fr_1.4fr_auto] md:items-end">
      {(state) => (
        <>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Select label="Documento" name="docType" defaultValue={state?.values?.docType ?? 'CC'}>
            <option value="CC">Cédula</option>
            <option value="NIT">NIT</option>
            <option value="CE">Cédula de extranjería</option>
            <option value="PP">Pasaporte</option>
          </Select>
          <Field label="Número" name="docNumber" required defaultValue={state?.values?.docNumber} />
          <Field label="Nombre o razón social" name="name" required defaultValue={state?.values?.name} />
          <Field label="Correo" name="email" type="email" defaultValue={state?.values?.email} />
          <SubmitButton tone="quiet" pendingText="…">
            Guardar
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
