'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi, rawApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/surveys`;
export type SurveyActionResult = { ok: false; error: string } | { ok: true } | undefined;

export async function saveSurveyAction(companyId: string, surveyId: string | null, payload: Record<string, unknown>): Promise<SurveyActionResult> {
  const res = await authedApi<{ id: string } & ApiError>(surveyId ? `${path(companyId)}/${encodeURIComponent(surveyId)}` : path(companyId), {
    method: surveyId ? 'PUT' : 'POST',
    body: payload,
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar la encuesta.') };
  revalidatePath(`/empresa/${companyId}/encuestas`, 'layout');
  redirect(`/empresa/${companyId}/encuestas/${res.data.id}`);
}

export async function answerSurveyAction(companyId: string, surveyId: string, answers: Record<string, unknown>): Promise<SurveyActionResult> {
  const res = await authedApi<ApiError>(`${path(companyId)}/${encodeURIComponent(surveyId)}/responses`, { method: 'POST', body: { answers } });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo enviar tu respuesta.') };
  revalidatePath(`/empresa/${companyId}`, 'layout');
  return { ok: true };
}

/** Respuesta de un cliente desde el enlace público (sin sesión). */
export async function answerPublicSurveyAction(token: string, answers: Record<string, unknown>, name?: string): Promise<SurveyActionResult> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false, error: 'Enlace no válido.' };
  const res = await rawApi<ApiError>(`/public/surveys/${token}/responses`, { method: 'POST', body: { answers, name } });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo enviar tu respuesta.') };
  return { ok: true };
}

async function act(formData: FormData, action: 'open' | 'close') {
  const companyId = String(formData.get('companyId') ?? '');
  const surveyId = String(formData.get('surveyId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(surveyId)}/${action}`, { method: 'POST' });
  revalidatePath(`/empresa/${companyId}/encuestas`, 'layout');
}
export async function openSurveyAction(formData: FormData) {
  await act(formData, 'open');
}
export async function closeSurveyAction(formData: FormData) {
  await act(formData, 'close');
}

export async function deleteSurveyAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(String(formData.get('surveyId') ?? ''))}`, { method: 'DELETE' });
  redirect(`/empresa/${companyId}/encuestas`);
}
