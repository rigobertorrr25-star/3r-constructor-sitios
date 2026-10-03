'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/calendar/events`;

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

export async function createEventAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const allDay = formData.get('allDay') === 'on';
  const date = text(formData, 'date');
  const start = text(formData, 'startTime');
  const end = text(formData, 'endTime');
  if (!date) return fail('Elige el día.', formData);
  if (!allDay && !start) return fail('Elige la hora de inicio, o marca «Todo el día».', formData);
  // Hora de Colombia (UTC-5, sin cambio de horario).
  const startsAt = allDay ? `${date}T00:00:00-05:00` : `${date}T${start}:00-05:00`;
  const endsAt = !allDay && end ? `${date}T${end}:00-05:00` : null;
  const res = await authedApi<ApiError>(path(companyId), {
    method: 'POST',
    body: {
      kind: text(formData, 'kind') || undefined,
      title: text(formData, 'title'),
      location: text(formData, 'location'),
      description: text(formData, 'description'),
      startsAt,
      endsAt,
      allDay,
      personal: formData.get('personal') === 'on' || formData.get('onlyPersonal') === '1',
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el evento.'), formData);
  revalidatePath(`/empresa/${companyId}/calendario`);
  return { ok: Date.now() };
}

export async function deleteEventAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/${encodeURIComponent(text(formData, 'eventId'))}`, { method: 'DELETE' });
  revalidatePath(`/empresa/${companyId}/calendario`);
}
