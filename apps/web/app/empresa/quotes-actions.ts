'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/quotes`;

export type QuoteSaveResult = { ok: false; error: string } | undefined;

/** Guarda (nueva o existente) y lleva al detalle. `payload` lo arma el editor en el navegador. */
export async function saveQuoteAction(companyId: string, quoteId: string | null, payload: Record<string, unknown>): Promise<QuoteSaveResult> {
  const res = await authedApi<{ id: string } & ApiError>(quoteId ? `${path(companyId)}/${encodeURIComponent(quoteId)}` : path(companyId), {
    method: quoteId ? 'PUT' : 'POST',
    body: payload,
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar la cotización.') };
  revalidatePath(`/empresa/${companyId}/cotizaciones`, 'layout');
  redirect(`/empresa/${companyId}/cotizaciones/${res.data.id}`);
}

export type SendState = { error?: string; url?: string; emailed?: boolean } | undefined;

export async function sendQuoteAction(_prev: SendState, formData: FormData): Promise<SendState> {
  const companyId = String(formData.get('companyId') ?? '');
  const quoteId = String(formData.get('quoteId') ?? '');
  const email = formData.get('mode') === 'email';
  const res = await authedApi<{ url: string } & ApiError>(`${path(companyId)}/${encodeURIComponent(quoteId)}/send`, {
    method: 'POST',
    body: { email },
  });
  if (!res.ok) return { error: errorText(res.data, 'No se pudo enviar.') };
  revalidatePath(`/empresa/${companyId}/cotizaciones`, 'layout');
  return { url: res.data.url, emailed: email };
}

export async function reopenQuoteAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  const quoteId = String(formData.get('quoteId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(quoteId)}/reopen`, { method: 'POST' });
  redirect(`/empresa/${companyId}/cotizaciones/${quoteId}/editar`);
}

export async function deleteQuoteAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(String(formData.get('quoteId') ?? ''))}`, { method: 'DELETE' });
  redirect(`/empresa/${companyId}/cotizaciones`);
}
