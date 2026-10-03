'use server';

import { revalidatePath } from 'next/cache';
import { rawApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

export type RespondState = { error?: string; values?: Record<string, string>; done?: string } | undefined;

/** Respuesta del cliente desde el enlace (sin sesión: lo autoriza el token). */
export async function respondQuoteAction(_prev: RespondState, formData: FormData): Promise<RespondState> {
  const token = String(formData.get('token') ?? '');
  const values = {
    name: String(formData.get('name') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
    action: String(formData.get('action') ?? ''),
  };
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { error: 'Enlace no válido.', values };
  const res = await rawApi<{ label: string } & ApiError>(`/public/quotes/${token}/respond`, { method: 'POST', body: values });
  if (!res.ok) return { error: errorText(res.data, 'No se pudo enviar tu respuesta.'), values };
  revalidatePath(`/cotizacion/${token}`);
  return { done: res.data.label };
}
