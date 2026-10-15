'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string, ticketId = '') =>
  `/companies/${encodeURIComponent(companyId)}/tickets${ticketId ? `/${encodeURIComponent(ticketId)}` : ''}`;

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

export async function createTicketAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<{ id: string } & ApiError>(path(companyId), {
    method: 'POST',
    body: {
      title: text(formData, 'title'),
      description: text(formData, 'description'),
      category: text(formData, 'category'),
      priority: text(formData, 'priority') || undefined,
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo crear el ticket.'), formData);
  redirect(`/empresa/${companyId}/tickets/${res.data.id}`);
}

/** Responsable, prioridad y área (quien atiende tickets). */
export async function manageTicketAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const ticketId = text(formData, 'ticketId');
  const res = await authedApi<ApiError>(path(companyId, ticketId), {
    method: 'PATCH',
    body: {
      assigneeMemberId: text(formData, 'assigneeMemberId') || null,
      priority: text(formData, 'priority'),
      category: text(formData, 'category'),
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(`/empresa/${companyId}/tickets`, 'layout');
  return { ok: Date.now() };
}

/** Un botón por estado posible (empezar, resolver, cerrar, reabrir…). */
export async function setTicketStatusAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(path(companyId, text(formData, 'ticketId')), { method: 'PATCH', body: { status: text(formData, 'status') } });
  revalidatePath(`/empresa/${companyId}/tickets`, 'layout');
}

export async function commentTicketAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const ticketId = text(formData, 'ticketId');
  const res = await authedApi<ApiError>(`${path(companyId, ticketId)}/comments`, { method: 'POST', body: { body: text(formData, 'body') } });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el comentario.'), formData);
  revalidatePath(`/empresa/${companyId}/tickets/${ticketId}`);
  return { ok: Date.now() };
}

export async function deleteTicketAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(path(companyId, text(formData, 'ticketId')), { method: 'DELETE' });
  redirect(`/empresa/${companyId}/tickets`);
}
