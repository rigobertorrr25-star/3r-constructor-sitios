'use client';

import { useState } from 'react';
import { invoiceCustomerAction, saveFiscalAction } from '@/app/actions';
import { ActionForm } from './form-state';
import { SubmitButton } from './submit-button';
import { Field, Select } from './ui';
import { useT } from './i18n';

export function FiscalForm({ fiscal }: { fiscal: { legalName: string | null; taxId: string | null; taxKind: string; resolution: string | null } }) {
  const t = useT();
  return (
    <ActionForm action={saveFiscalAction} className="grid gap-3 md:grid-cols-2">
      {(state) => (
        <>
          <Field label={t('Razón social o nombre')} name="legalName" required defaultValue={state?.values?.legalName ?? fiscal.legalName ?? ''} />
          <Field label={t('NIT o cédula')} name="taxId" required placeholder="900123456-7" defaultValue={state?.values?.taxId ?? fiscal.taxId ?? ''} />
          <Select label={t('Impuesto')} name="taxKind" defaultValue={state?.values?.taxKind ?? fiscal.taxKind}>
            <option value="inc">{t('Impuesto al consumo 8 % (restaurantes y bares)')}</option>
            <option value="iva">{t('IVA 19 %')}</option>
            <option value="none">{t('No responsable de impuestos')}</option>
          </Select>
          <Field label={t('Resolución de facturación (opcional)')} name="resolution" maxLength={200} defaultValue={state?.values?.resolution ?? fiscal.resolution ?? ''} hint={t('Número y fecha de la resolución de la DIAN.')} />
          <div className="md:col-span-2">
            <SubmitButton pendingText={t('Guardando…')}>{t('Guardar')}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** "Factura a nombre de…": tipo y número de documento, nombre y correo. */
export function InvoiceCustomer({ invoiceId, sessionId }: { invoiceId: string; sessionId: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  if (!open)
    return (
      <button type="button" className="mt-1 text-[13px] text-primary hover:underline" onClick={() => setOpen(true)}>
        {t('Poner a nombre del cliente')}
      </button>
    );
  return (
    <ActionForm action={invoiceCustomerAction} onOk={() => setOpen(false)} className="mt-2 grid gap-2 md:grid-cols-[140px_1fr_1.4fr_1.4fr_auto] md:items-end">
      {(state) => (
        <>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Select label={t('Documento')} name="docType" defaultValue={state?.values?.docType ?? 'CC'}>
            <option value="CC">{t('Cédula')}</option>
            <option value="NIT">NIT</option>
            <option value="CE">{t('Cédula de extranjería')}</option>
            <option value="PP">{t('Pasaporte')}</option>
          </Select>
          <Field label={t('Número')} name="docNumber" required defaultValue={state?.values?.docNumber} />
          <Field label={t('Nombre o razón social')} name="name" required defaultValue={state?.values?.name} />
          <Field label={t('Correo')} name="email" type="email" defaultValue={state?.values?.email} />
          <SubmitButton tone="quiet" pendingText="…">
            {t('Guardar')}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
