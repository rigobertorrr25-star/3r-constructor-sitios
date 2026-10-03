'use server';

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

async function save(formData: FormData, body: Record<string, unknown>): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const memberId = text(formData, 'memberId');
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(companyId)}/employees/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body,
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(`/empresa/${companyId}/personal`, 'layout');
  return { ok: Date.now() };
}

export async function savePersonalAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const fields = [
    'documentType',
    'documentNumber',
    'phone',
    'birthDate',
    'address',
    'city',
    'emergencyName',
    'emergencyPhone',
    'emergencyRelation',
    'eps',
    'pensionFund',
  ];
  return save(formData, { ...Object.fromEntries(fields.map((f) => [f, text(formData, f)])), showPhone: formData.get('showPhone') === 'on' });
}

export async function saveWorkAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  return save(formData, {
    contractType: text(formData, 'contractType'),
    contractEnd: text(formData, 'contractEnd'),
    salary: parsePesos(text(formData, 'salary')),
    schedule: text(formData, 'schedule'),
    hrNotes: text(formData, 'hrNotes'),
  });
}
