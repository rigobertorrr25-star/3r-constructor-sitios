'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

export async function saveSeoMetaAction(
  companyId: string,
  pageId: string,
  seoTitle: string,
  seoDescription: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await authedApi<ApiError>(`/companies/${encodeURIComponent(companyId)}/seo/pages/${encodeURIComponent(pageId)}`, {
    method: 'PUT',
    body: { seoTitle, seoDescription },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar.') };
  revalidatePath(`/empresa/${companyId}`, 'layout');
  return { ok: true };
}
