'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authedApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/whatsapp`;
const page = (companyId: string) => `/empresa/${companyId}/whatsapp`;
export type WaResult = { ok: false; error: string } | { ok: true } | undefined;

export async function sendWaTextAction(companyId: string, conversationId: string, body: string): Promise<WaResult> {
  const res = await authedApi<ApiError>(`${path(companyId)}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: { body },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo enviar el mensaje.') };
  revalidatePath(`${page(companyId)}/${conversationId}`);
  return { ok: true };
}

export async function sendWaTemplateAction(companyId: string, conversationId: string, templateId: string, params: string[]): Promise<WaResult> {
  const res = await authedApi<ApiError>(`${path(companyId)}/conversations/${encodeURIComponent(conversationId)}/template`, {
    method: 'POST',
    body: { templateId, params },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo enviar la plantilla.') };
  revalidatePath(`${page(companyId)}/${conversationId}`);
  return { ok: true };
}

export async function startWaAction(
  companyId: string,
  input: { phone: string; name: string; templateId: string; params: string[] },
): Promise<WaResult> {
  const res = await authedApi<{ conversationId: string } & ApiError>(`${path(companyId)}/conversations`, { method: 'POST', body: input });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo escribir al cliente.') };
  redirect(`${page(companyId)}/${res.data.conversationId}`);
}

export async function updateWaConversationAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  const conversationId = String(formData.get('conversationId') ?? '');
  const body: Record<string, unknown> = {};
  if (formData.has('status')) body.status = String(formData.get('status'));
  if (formData.has('assignedMemberId')) body.assignedMemberId = String(formData.get('assignedMemberId')) || null;
  await authedApi(`${path(companyId)}/conversations/${encodeURIComponent(conversationId)}`, { method: 'PATCH', body });
  revalidatePath(page(companyId), 'layout');
}

export async function syncWaTemplatesAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`${path(companyId)}/templates/sync`, { method: 'POST' });
  revalidatePath(page(companyId), 'layout');
}

// ───────── equipo de 3R ─────────

export async function connectWhatsappAction(_prev: WaResult, formData: FormData): Promise<WaResult> {
  const companyId = String(formData.get('companyId') ?? '');
  const text = (k: string) => String(formData.get(k) ?? '').trim();
  const res = await authedApi<ApiError>(`/admin/companies/${encodeURIComponent(companyId)}/whatsapp`, {
    method: 'PUT',
    body: {
      phoneNumberId: text('phoneNumberId'),
      wabaId: text('wabaId'),
      displayPhone: text('displayPhone'),
      status: text('status') || 'active',
      ...(text('accessToken') ? { accessToken: text('accessToken') } : {}),
    },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo conectar el WhatsApp.') };
  revalidatePath(`/admin/empresas/${companyId}`);
  return { ok: true };
}

export async function disconnectWhatsappAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  await authedApi(`/admin/companies/${encodeURIComponent(companyId)}/whatsapp`, { method: 'DELETE' });
  revalidatePath(`/admin/empresas/${companyId}`);
}
