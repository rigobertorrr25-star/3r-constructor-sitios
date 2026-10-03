'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi, rawApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/knowledge`;
const page = (companyId: string) => `/empresa/${companyId}/conocimiento`;
export type ArticleActionResult = { ok: false; error: string } | { ok: true } | undefined;

export async function saveArticleAction(companyId: string, articleId: string | null, payload: Record<string, unknown>): Promise<ArticleActionResult> {
  const res = await authedApi<{ id: string } & ApiError>(articleId ? `${path(companyId)}/${encodeURIComponent(articleId)}` : path(companyId), {
    method: articleId ? 'PUT' : 'POST',
    body: payload,
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar el artículo.') };
  revalidatePath(page(companyId), 'layout');
  redirect(`${page(companyId)}/${res.data.id}`);
}

export async function deleteArticleAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/${encodeURIComponent(String(formData.get('articleId') ?? ''))}`, { method: 'DELETE' });
  redirect(page(companyId));
}

export async function voteArticleAction(companyId: string, articleId: string, helpful: boolean): Promise<ArticleActionResult> {
  const res = await authedApi<ApiError>(`${path(companyId)}/${encodeURIComponent(articleId)}/vote`, { method: 'POST', body: { helpful } });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar tu respuesta.') };
  return { ok: true };
}

/** Voto de un cliente desde el centro de ayuda público (sin sesión). */
export async function votePublicArticleAction(token: string, articleId: string, helpful: boolean): Promise<ArticleActionResult> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(articleId)) return { ok: false, error: 'Enlace no válido.' };
  const res = await rawApi<ApiError>(`/public/help/${token}/${articleId}/vote`, { method: 'POST', body: { helpful } });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar tu respuesta.') };
  return { ok: true };
}

export async function enableHelpAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/public-link`, { method: 'POST' });
  revalidatePath(page(companyId));
}

export async function disableHelpAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/public-link`, { method: 'DELETE' });
  revalidatePath(page(companyId));
}
