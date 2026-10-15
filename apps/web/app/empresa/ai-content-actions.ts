'use server';

import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import type { AiGeneration, AiKind } from '@/lib/ai-content';
import { errorText, type ApiError } from '@/lib/types';

export async function generateTextAction(
  companyId: string,
  input: { kind: AiKind; tone?: string; topic: string },
): Promise<{ ok: true; generation: AiGeneration } | { ok: false; error: string }> {
  const res = await authedApi<AiGeneration & ApiError>(`/companies/${encodeURIComponent(companyId)}/ai-content`, { method: 'POST', body: input });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'La IA no pudo escribir. Intenta de nuevo.') };
  revalidatePath(`/empresa/${companyId}/textos`);
  return { ok: true, generation: res.data };
}
