'use server';

import { redirect } from 'next/navigation';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

export type PayState = { error?: string } | undefined;

/** Lleva a pagar la factura en Wompi. */
export async function payInvoiceAction(_prev: PayState, formData: FormData): Promise<PayState> {
  const companyId = String(formData.get('companyId') ?? '');
  const invoiceId = String(formData.get('invoiceId') ?? '');
  const res = await authedApi<{ url: string } & ApiError>(
    `/companies/${encodeURIComponent(companyId)}/billing/invoices/${encodeURIComponent(invoiceId)}/wompi`,
    {
      method: 'POST',
    },
  );
  if (!res.ok) return { error: errorText(res.data, 'No se pudo abrir el pago en línea.') };
  redirect(res.data.url);
}
