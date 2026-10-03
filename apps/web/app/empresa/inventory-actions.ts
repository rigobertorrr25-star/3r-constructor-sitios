'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi } from '@/lib/api';
import { parsePesos } from '@/lib/crm';
import { parseQty } from '@/lib/inventory';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/inventory`;
const page = (companyId: string) => `/empresa/${companyId}/inventario`;

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

/** Cantidad del formulario: vacía → null; con letras → error. */
function qty(formData: FormData, name: string) {
  const n = parseQty(text(formData, name));
  if (Number.isNaN(n)) throw new Error('Escribe las cantidades solo con números (por ejemplo 2,5).');
  return n;
}

const itemBody = (formData: FormData) => ({
  name: text(formData, 'name'),
  sku: text(formData, 'sku'),
  category: text(formData, 'category'),
  unit: text(formData, 'unit') || 'unidad',
  minStock: qty(formData, 'minStock'),
  cost: parsePesos(text(formData, 'cost')),
  location: text(formData, 'location'),
  notes: text(formData, 'notes'),
});

export async function createItemAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  let body;
  try {
    body = { ...itemBody(formData), initialStock: qty(formData, 'initialStock') ?? undefined };
  } catch (e) {
    return fail((e as Error).message, formData);
  }
  const res = await authedApi<{ id: string } & ApiError>(`${path(companyId)}/items`, { method: 'POST', body });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el producto.'), formData);
  redirect(`${page(companyId)}/${res.data.id}`);
}

export async function updateItemAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const itemId = text(formData, 'itemId');
  let body;
  try {
    body = { ...itemBody(formData), active: formData.get('active') === 'on' };
  } catch (e) {
    return fail((e as Error).message, formData);
  }
  const res = await authedApi<ApiError>(`${path(companyId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(page(companyId), 'layout');
  return { ok: Date.now() };
}

export async function moveItemAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const itemId = text(formData, 'itemId');
  let quantity;
  try {
    quantity = qty(formData, 'quantity');
  } catch (e) {
    return fail((e as Error).message, formData);
  }
  if (quantity == null) return fail('Escribe la cantidad.', formData);
  const res = await authedApi<ApiError>(`${path(companyId)}/items/${encodeURIComponent(itemId)}/movements`, {
    method: 'POST',
    body: { type: text(formData, 'type'), quantity, note: text(formData, 'note') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo registrar.'), formData);
  revalidatePath(page(companyId), 'layout');
  return { ok: Date.now() };
}

export async function deleteItemAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/items/${encodeURIComponent(text(formData, 'itemId'))}`, { method: 'DELETE' });
  redirect(page(companyId));
}

const assetBody = (formData: FormData) => ({
  name: text(formData, 'name'),
  code: text(formData, 'code'),
  category: text(formData, 'category'),
  serial: text(formData, 'serial'),
  value: parsePesos(text(formData, 'value')),
  purchasedAt: text(formData, 'purchasedAt') || null,
  notes: text(formData, 'notes'),
});

export async function createAssetAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<{ id: string } & ApiError>(`${path(companyId)}/assets`, { method: 'POST', body: assetBody(formData) });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el equipo.'), formData);
  redirect(`${page(companyId)}/activos/${res.data.id}`);
}

export async function updateAssetAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const assetId = text(formData, 'assetId');
  const res = await authedApi<ApiError>(`${path(companyId)}/assets/${encodeURIComponent(assetId)}`, { method: 'PUT', body: assetBody(formData) });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los cambios.'), formData);
  revalidatePath(page(companyId), 'layout');
  return { ok: Date.now() };
}

export async function assignAssetAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const assetId = text(formData, 'assetId');
  const res = await authedApi<ApiError>(`${path(companyId)}/assets/${encodeURIComponent(assetId)}/assign`, {
    method: 'POST',
    body: { memberId: text(formData, 'memberId'), note: text(formData, 'note') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo entregar.'), formData);
  revalidatePath(page(companyId), 'layout');
  return { ok: Date.now() };
}

export async function assetStatusAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/assets/${encodeURIComponent(text(formData, 'assetId'))}/status`, {
    method: 'POST',
    body: { status: text(formData, 'status'), note: text(formData, 'note') },
  });
  revalidatePath(page(companyId), 'layout');
}

export async function deleteAssetAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/assets/${encodeURIComponent(text(formData, 'assetId'))}`, { method: 'DELETE' });
  redirect(`${page(companyId)}/activos`);
}
