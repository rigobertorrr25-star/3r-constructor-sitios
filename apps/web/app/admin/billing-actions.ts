'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { parsePesos } from '@/lib/crm';
import { errorText, type ApiError } from '@/lib/types';

export type AdminBillingState = { error?: string; ok?: number } | undefined;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

export async function setPricesAction(_prev: AdminBillingState, formData: FormData): Promise<AdminBillingState> {
  const prices: Record<string, number | null> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('price:') || typeof value !== 'string') continue;
    prices[key.slice(6)] = value.trim() === '' ? null : parsePesos(value);
  }
  const res = await authedApi<ApiError>('/admin/billing/prices', { method: 'PUT', body: { prices } });
  if (!res.ok) return { error: errorText(res.data, 'No se pudieron guardar los precios.') };
  revalidatePath('/admin', 'layout');
  return { ok: Date.now() };
}

export async function saveSubscriptionAction(_prev: AdminBillingState, formData: FormData): Promise<AdminBillingState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<ApiError>(`/admin/companies/${encodeURIComponent(companyId)}/subscription`, {
    method: 'PUT',
    body: {
      status: text(formData, 'status'),
      trialEndsAt: text(formData, 'trialEndsAt'),
      billingDay: Number(text(formData, 'billingDay')),
      notes: text(formData, 'notes'),
    },
  });
  if (!res.ok) return { error: errorText(res.data, 'No se pudo guardar el plan.') };
  revalidatePath(`/admin/empresas/${companyId}`);
  return { ok: Date.now() };
}

export async function generateInvoiceAction(_prev: AdminBillingState, formData: FormData): Promise<AdminBillingState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<ApiError>(`/admin/companies/${encodeURIComponent(companyId)}/invoices`, { method: 'POST' });
  if (!res.ok) return { error: errorText(res.data, 'No se pudo generar la factura.') };
  revalidatePath(`/admin/empresas/${companyId}`);
  return { ok: Date.now() };
}

export async function markInvoicePaidAction(formData: FormData) {
  await authedApi(`/admin/invoices/${encodeURIComponent(text(formData, 'invoiceId'))}/paid`, {
    method: 'POST',
    body: { method: text(formData, 'method') || 'transfer', note: text(formData, 'note') },
  });
  revalidatePath(`/admin/empresas/${text(formData, 'companyId')}`);
}

export async function voidInvoiceAction(formData: FormData) {
  await authedApi(`/admin/invoices/${encodeURIComponent(text(formData, 'invoiceId'))}/void`, { method: 'POST' });
  revalidatePath(`/admin/empresas/${text(formData, 'companyId')}`);
}
