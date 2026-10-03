'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import type { AssistantQuestion } from '@/lib/assistant';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/assistant`;

export async function askAction(
  companyId: string,
  question: string,
): Promise<{ ok: true; question: AssistantQuestion } | { ok: false; error: string }> {
  const res = await authedApi<AssistantQuestion & ApiError>(`${path(companyId)}/ask`, { method: 'POST', body: { question } });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'El asistente no pudo responder. Intenta de nuevo.') };
  return { ok: true, question: res.data };
}

export async function feedbackAction(companyId: string, questionId: string, helpful: boolean) {
  const res = await authedApi(`${path(companyId)}/questions/${encodeURIComponent(questionId)}/feedback`, { method: 'POST', body: { helpful } });
  return res.ok;
}

export async function toggleDocumentAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  const documentId = String(formData.get('documentId') ?? '');
  await authedApi(`${path(companyId)}/documents/${encodeURIComponent(documentId)}`, {
    method: 'PUT',
    body: { enabled: String(formData.get('enabled') ?? '') === 'true' },
  });
  revalidatePath(`/empresa/${companyId}/asistente`);
}
