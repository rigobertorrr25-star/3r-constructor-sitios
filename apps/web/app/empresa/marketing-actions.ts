'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi, rawApi } from '@/lib/api';
import type { Segment } from '@/lib/marketing';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/marketing`;
const page = (companyId: string) => `/empresa/${companyId}/marketing`;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
export type MarketingResult = { ok: false; error: string } | { ok: true; message?: string } | undefined;

export async function saveCampaignAction(
  companyId: string,
  campaignId: string | null,
  payload: { name: string; subject: string; body: string; segment: Segment },
): Promise<MarketingResult> {
  const res = await authedApi<{ id: string } & ApiError>(
    campaignId ? `${path(companyId)}/campaigns/${encodeURIComponent(campaignId)}` : `${path(companyId)}/campaigns`,
    {
      method: campaignId ? 'PUT' : 'POST',
      body: payload,
    },
  );
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar la campaña.') };
  revalidatePath(page(companyId), 'layout');
  if (!campaignId) redirect(`${page(companyId)}/${res.data.id}`);
  return { ok: true, message: 'Cambios guardados.' };
}

/** Cuántos recibirían el correo con ese grupo. */
export async function audienceAction(companyId: string, segment: Segment): Promise<number | null> {
  const res = await authedApi<{ count: number }>(`${path(companyId)}/audience`, { method: 'POST', body: segment });
  return res.ok ? res.data.count : null;
}

export async function testCampaignAction(companyId: string, campaignId: string): Promise<MarketingResult> {
  const res = await authedApi<{ sentTo: string } & ApiError>(`${path(companyId)}/campaigns/${encodeURIComponent(campaignId)}/test`, {
    method: 'POST',
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo mandar la prueba.') };
  return { ok: true, message: `Te mandamos la prueba a ${res.data.sentTo}.` };
}

export async function sendCampaignAction(companyId: string, campaignId: string): Promise<MarketingResult> {
  const res = await authedApi<ApiError>(`${path(companyId)}/campaigns/${encodeURIComponent(campaignId)}/send`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo enviar la campaña.') };
  revalidatePath(page(companyId), 'layout');
  return { ok: true };
}

export async function deleteCampaignAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/campaigns/${encodeURIComponent(String(formData.get('campaignId') ?? ''))}`, { method: 'DELETE' });
  revalidatePath(page(companyId), 'layout');
  redirect(page(companyId));
}

export async function enableNewsletterAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/newsletter`, { method: 'POST' });
  revalidatePath(page(companyId));
}

export async function disableNewsletterAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/newsletter`, { method: 'DELETE' });
  revalidatePath(page(companyId));
}

// ───────── páginas públicas (sin sesión) ─────────

export async function subscribeAction(token: string, _prev: MarketingResult, formData: FormData): Promise<MarketingResult> {
  if (!TOKEN.test(token)) return { ok: false, error: 'Enlace no válido.' };
  const res = await rawApi<ApiError>(`/public/newsletter/${token}`, {
    method: 'POST',
    body: { name: String(formData.get('name') ?? ''), email: String(formData.get('email') ?? ''), consent: formData.get('consent') === 'on' },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No pudimos guardar tu suscripción. Intenta de nuevo.') };
  return { ok: true };
}

export async function unsubscribeAction(token: string): Promise<MarketingResult> {
  if (!TOKEN.test(token)) return { ok: false, error: 'Enlace no válido.' };
  const res = await rawApi<ApiError>(`/public/marketing/unsubscribe/${token}`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No pudimos darte de baja. Intenta de nuevo.') };
  return { ok: true };
}
