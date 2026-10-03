'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { parsePesos } from '@/lib/crm';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

const contactBody = (formData: FormData) => ({
  name: text(formData, 'name'),
  organization: text(formData, 'organization'),
  email: text(formData, 'email'),
  phone: text(formData, 'phone'),
  stage: text(formData, 'stage') || undefined,
  source: text(formData, 'source') || undefined,
  value: parsePesos(text(formData, 'value')),
  notes: text(formData, 'notes'),
  ownerMemberId: text(formData, 'ownerMemberId') || null,
});

export async function createContactAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const body = contactBody(formData);
  const res = await authedApi<{ id: string } & ApiError>(`/companies/${encodeURIComponent(companyId)}/crm/contacts`, {
    method: 'POST',
    body: { ...body, value: body.value ?? undefined },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el cliente.'), formData);
  redirect(`/empresa/${companyId}/crm/${res.data.id}`);
}

export async function updateContactAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const contactId = text(formData, 'contactId');
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(companyId)}/crm/contacts/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    body: contactBody(formData),
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(`/empresa/${companyId}/crm`, 'layout');
  return { ok: Date.now() };
}

/** Mover de etapa desde el tablero, sin abrir la ficha. */
export async function moveContactAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`/companies/${encodeURIComponent(companyId)}/crm/contacts/${encodeURIComponent(text(formData, 'contactId'))}`, {
    method: 'PATCH',
    body: { stage: text(formData, 'stage') },
  });
  revalidatePath(`/empresa/${companyId}/crm`, 'layout');
}

export async function addActivityAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const contactId = text(formData, 'contactId');
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(companyId)}/crm/contacts/${encodeURIComponent(contactId)}/activities`, {
    method: 'POST',
    body: { kind: text(formData, 'kind'), body: text(formData, 'body') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar.'), formData);
  revalidatePath(`/empresa/${companyId}/crm/${contactId}`);
  return { ok: Date.now() };
}

export async function deleteContactAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`/companies/${encodeURIComponent(companyId)}/crm/contacts/${encodeURIComponent(text(formData, 'contactId'))}`, {
    method: 'DELETE',
  });
  redirect(`/empresa/${companyId}/crm`);
}
