'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

export type CompanyFormState = { error?: string; ok?: number; values?: Record<string, string> } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

const companyFields = (formData: FormData) => ({
  name: text(formData, 'name'),
  taxId: text(formData, 'taxId'),
  city: text(formData, 'city'),
  phone: text(formData, 'phone'),
  industry: text(formData, 'industry'),
});

export async function createCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const res = await authedApi<{ id: string } & ApiError>('/companies', { method: 'POST', body: companyFields(formData) });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo crear la empresa.'), formData);
  redirect(`/empresa/${res.data.id}`);
}

export async function updateCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const id = text(formData, 'companyId');
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(id)}`, { method: 'PATCH', body: companyFields(formData) });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los datos.'), formData);
  revalidatePath(`/empresa/${id}`, 'layout');
  return { ok: Date.now() };
}

export async function inviteMemberAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const id = text(formData, 'companyId');
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(id)}/invites`, {
    method: 'POST',
    body: { email: text(formData, 'email'), role: text(formData, 'role') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo enviar la invitación.'), formData);
  revalidatePath(`/empresa/${id}/equipo`);
  return { ok: Date.now() };
}

export async function revokeInviteAction(formData: FormData) {
  const id = text(formData, 'companyId');
  await authedApi(`/companies/${encodeURIComponent(id)}/invites/${encodeURIComponent(text(formData, 'inviteId'))}`, { method: 'DELETE' });
  revalidatePath(`/empresa/${id}/equipo`);
}

export async function updateMemberAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const id = text(formData, 'companyId');
  const body: Record<string, string> = {};
  for (const key of ['role', 'status', 'jobTitle', 'area', 'hiredAt']) if (formData.has(key)) body[key] = text(formData, key);
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(id)}/members/${encodeURIComponent(text(formData, 'memberId'))}`, {
    method: 'PATCH',
    body,
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(`/empresa/${id}/equipo`);
  return { ok: Date.now() };
}

export async function removeMemberAction(formData: FormData) {
  const id = text(formData, 'companyId');
  const self = text(formData, 'self') === '1';
  await authedApi(`/companies/${encodeURIComponent(id)}/members/${encodeURIComponent(text(formData, 'memberId'))}`, { method: 'DELETE' });
  if (self) redirect('/empresa');
  revalidatePath(`/empresa/${id}/equipo`);
}

export async function acceptInviteAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const res = await authedApi<{ companyId: string } & ApiError>('/company-invites/accept', {
    method: 'POST',
    body: { token: text(formData, 'token') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo aceptar la invitación.'), formData);
  redirect(`/empresa/${res.data.companyId}`);
}

export async function adminSetModulesAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const id = text(formData, 'companyId');
  const keys = formData.getAll('modules').map(String);
  const res = await authedApi<ApiError>(`/admin/companies/${encodeURIComponent(id)}/modules`, { method: 'PUT', body: { keys } });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los módulos.'), formData);
  revalidatePath(`/admin/empresas/${id}`);
  return { ok: Date.now() };
}

export async function adminSetCompanyStatusAction(formData: FormData) {
  const id = text(formData, 'companyId');
  await authedApi(`/admin/companies/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: text(formData, 'status') } });
  revalidatePath(`/admin/empresas/${id}`);
}
