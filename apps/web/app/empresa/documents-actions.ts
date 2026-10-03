'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/documents`;

export type UploadTicket =
  | { ok: true; documentId: string; upload: { url: string; method: 'PUT'; headers: Record<string, string> } }
  | { ok: false; error: string };

/** Paso 1 (desde el navegador): registra el documento y trae el enlace firmado para subir el archivo directo. */
export async function requestDocumentUploadAction(
  companyId: string,
  meta: {
    title: string;
    category: string;
    fileName: string;
    contentType: string;
    size: number;
    memberId?: string;
    audience?: string;
    expiresOn?: string;
  },
): Promise<UploadTicket> {
  const res = await authedApi<{ documentId: string; upload: { url: string; method: 'PUT'; headers: Record<string, string> } } & ApiError>(
    `${path(companyId)}/uploads`,
    { method: 'POST', body: meta },
  );
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo preparar la subida.') };
  return { ok: true, documentId: res.data.documentId, upload: res.data.upload };
}

/** Paso 2: el archivo ya subió; queda disponible. */
export async function confirmDocumentAction(companyId: string, documentId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await authedApi<ApiError>(`${path(companyId)}/${encodeURIComponent(documentId)}/confirm`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'El archivo no quedó guardado. Inténtalo otra vez.') };
  revalidatePath(`/empresa/${companyId}/documentos`);
  return { ok: true };
}

export async function deleteDocumentAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/${encodeURIComponent(text(formData, 'documentId'))}`, { method: 'DELETE' });
  revalidatePath(`/empresa/${companyId}/documentos`);
}
