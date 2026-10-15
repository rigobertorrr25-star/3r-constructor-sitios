'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/announcements`;
/** "2026-12-20T19:00" (hora de Colombia, sin cambio de horario) → ISO con zona. */
const bogota = (local: string) => (local ? `${local}:00-05:00` : null);

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

const body = (formData: FormData) => {
  const kind = text(formData, 'kind');
  return {
    kind,
    title: text(formData, 'title'),
    body: text(formData, 'body'),
    eventAt: kind === 'event' ? bogota(text(formData, 'eventAt')) : null,
    eventPlace: kind === 'event' ? text(formData, 'eventPlace') : '',
    pinned: formData.get('pinned') === 'on',
  };
};

export async function createAnnouncementAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<{ id: string } & ApiError>(path(companyId), {
    method: 'POST',
    body: { ...body(formData), notify: formData.get('notify') === 'on' },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo publicar.'), formData);
  revalidatePath(`/empresa/${companyId}`, 'layout');
  redirect(`/empresa/${companyId}/comunicados/${res.data.id}`);
}

export async function updateAnnouncementAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const id = text(formData, 'announcementId');
  const res = await authedApi<ApiError>(`${path(companyId)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: body(formData) });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(`/empresa/${companyId}/comunicados`, 'layout');
  return { ok: Date.now() };
}

export async function deleteAnnouncementAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/${encodeURIComponent(text(formData, 'announcementId'))}`, { method: 'DELETE' });
  redirect(`/empresa/${companyId}/comunicados`);
}
