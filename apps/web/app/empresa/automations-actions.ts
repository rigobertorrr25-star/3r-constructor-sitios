'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/automations`;
const page = (companyId: string) => `/empresa/${companyId}/automatizaciones`;

export async function saveAutomationAction(
  companyId: string,
  automationId: string | null,
  payload: Record<string, unknown>,
): Promise<{ ok: false; error: string } | undefined> {
  const res = await authedApi<ApiError>(automationId ? `${path(companyId)}/${encodeURIComponent(automationId)}` : path(companyId), {
    method: automationId ? 'PUT' : 'POST',
    body: payload,
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar la automatización.') };
  revalidatePath(page(companyId), 'layout');
  redirect(page(companyId));
}

export async function toggleAutomationAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  const id = String(formData.get('automationId') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  await authedApi(`${path(companyId)}/${encodeURIComponent(id)}?active=${active}`, { method: 'PATCH' });
  revalidatePath(page(companyId), 'layout');
}

export async function deleteAutomationAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(String(formData.get('automationId') ?? ''))}`, { method: 'DELETE' });
  redirect(page(companyId));
}
