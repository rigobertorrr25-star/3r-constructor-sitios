'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/requests`;

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

export async function createRequestAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const type = text(formData, 'type');
  const res = await authedApi<{ id: string } & ApiError>(path(companyId), {
    method: 'POST',
    body: {
      type,
      startDate: type === 'certificate' ? undefined : text(formData, 'startDate') || undefined,
      endDate: type === 'certificate' ? undefined : text(formData, 'endDate') || undefined,
      reason: text(formData, 'reason'),
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo enviar la solicitud.'), formData);
  redirect(`/empresa/${companyId}/solicitudes/${res.data.id}`);
}

export async function decideRequestAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const requestId = text(formData, 'requestId');
  const res = await authedApi<ApiError>(`${path(companyId)}/${encodeURIComponent(requestId)}/decision`, {
    method: 'POST',
    body: { decision: text(formData, 'decision'), note: text(formData, 'note') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar la decisión.'), formData);
  revalidatePath(`/empresa/${companyId}/solicitudes`, 'layout');
  return { ok: Date.now() };
}

export async function cancelRequestAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/${encodeURIComponent(text(formData, 'requestId'))}/cancel`, { method: 'POST' });
  revalidatePath(`/empresa/${companyId}/solicitudes`, 'layout');
}
