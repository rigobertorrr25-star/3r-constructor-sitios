'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';
import type { Field } from '@/lib/company-web';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/web`;
const page = (companyId: string) => `/empresa/${companyId}/pagina-web`;

export async function savePageFieldsAction(
  companyId: string,
  pageId: string,
  baseVersionId: string,
  changes: (Partial<Field> & { nodeId: string })[],
): Promise<{ ok: true; versionId: string } | { ok: false; error: string; conflict?: boolean }> {
  const res = await authedApi<{ versionId: string } & ApiError>(`${path(companyId)}/pages/${encodeURIComponent(pageId)}`, {
    method: 'PUT',
    body: { baseVersionId, changes },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudieron guardar los cambios.'), conflict: res.status === 409 };
  revalidatePath(page(companyId), 'layout');
  return { ok: true, versionId: res.data.versionId };
}

export async function publishWebAction(companyId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const res = await authedApi<{ url: string } & ApiError>(`${path(companyId)}/publish`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo publicar.') };
  revalidatePath(page(companyId), 'layout');
  return { ok: true, url: res.data.url };
}

/** Permiso para subir una foto; el navegador la sube directo con ese permiso. */
export async function presignWebImageAction(companyId: string, contentType: string) {
  const res = await authedApi<{ uploadUrl: string; method: 'PUT'; headers: Record<string, string>; publicUrl: string } & ApiError>(
    `${path(companyId)}/images/presign`,
    {
      method: 'POST',
      body: { contentType },
    },
  );
  if (!res.ok) return { ok: false as const, error: errorText(res.data, 'No se pudo pedir permiso para subir la foto.') };
  return { ok: true as const, presign: res.data };
}

/** Equipo de 3R: vincular la página con la empresa. */
export async function linkCompanySiteAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  const siteId = String(formData.get('siteId') ?? '');
  await authedApi(`/admin/companies/${encodeURIComponent(companyId)}/site`, { method: 'PUT', body: { siteId: siteId || null } });
  revalidatePath(`/admin/empresas/${companyId}`);
}
