'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authedApi, rawApi } from '@/lib/api';
import { parsePesos } from '@/lib/crm';
import type { CartItem, PublicOrder, Quote } from '@/lib/store';
import { errorText, type ApiError } from '@/lib/types';
import type { CompanyFormState } from './actions';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/store`;
const page = (companyId: string) => `/empresa/${companyId}/tienda`;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

function fail(error: string, formData: FormData): CompanyFormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string' && !key.startsWith('$ACTION')) values[key] = value;
  return { error, values };
}

export async function saveStoreSettingsAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<ApiError>(`${path(companyId)}/settings`, {
    method: 'PUT',
    body: {
      slug: text(formData, 'slug').toLowerCase(),
      name: text(formData, 'name'),
      tagline: text(formData, 'tagline'),
      whatsapp: text(formData, 'whatsapp'),
      open: formData.get('open') === 'on',
      pickupEnabled: formData.get('pickupEnabled') === 'on',
      pickupNote: text(formData, 'pickupNote'),
      deliveryEnabled: formData.get('deliveryEnabled') === 'on',
      deliveryFee: parsePesos(text(formData, 'deliveryFee')) ?? 0,
      freeFrom: parsePesos(text(formData, 'freeFrom')),
      deliveryNote: text(formData, 'deliveryNote'),
      paymentNote: text(formData, 'paymentNote'),
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudieron guardar los ajustes.'), formData);
  revalidatePath(page(companyId), 'layout');
  return { ok: Date.now() };
}

export type ProductActionResult = { ok: false; error: string } | undefined;

export async function saveProductAction(companyId: string, productId: string | null, payload: Record<string, unknown>): Promise<ProductActionResult> {
  const res = await authedApi<{ id: string } & ApiError>(
    productId ? `${path(companyId)}/products/${encodeURIComponent(productId)}` : `${path(companyId)}/products`,
    {
      method: productId ? 'PUT' : 'POST',
      body: payload,
    },
  );
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo guardar el producto.') };
  revalidatePath(page(companyId), 'layout');
  redirect(`${page(companyId)}/productos`);
}

export async function deleteProductAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/products/${encodeURIComponent(text(formData, 'productId'))}`, { method: 'DELETE' });
  redirect(`${page(companyId)}/productos`);
}

/** Permiso para subir la foto de un producto; el navegador la sube directo con ese permiso. */
export async function presignStoreImageAction(companyId: string, contentType: string) {
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

const couponBody = (formData: FormData) => {
  const kind = text(formData, 'kind');
  const value = parsePesos(text(formData, 'value'));
  return {
    code: text(formData, 'code'),
    percent: kind === 'percent' ? value : null,
    amount: kind === 'amount' ? value : null,
    minOrder: parsePesos(text(formData, 'minOrder')),
    maxUses: parsePesos(text(formData, 'maxUses')),
    expiresAt: text(formData, 'expiresAt') || null,
    active: true,
  };
};

export async function createCouponAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const companyId = text(formData, 'companyId');
  const res = await authedApi<ApiError>(`${path(companyId)}/coupons`, { method: 'POST', body: couponBody(formData) });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el cupón.'), formData);
  revalidatePath(`${page(companyId)}/cupones`);
  return { ok: Date.now() };
}

export async function toggleCouponAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  const c = JSON.parse(text(formData, 'coupon')) as Record<string, unknown>;
  await authedApi(`${path(companyId)}/coupons/${encodeURIComponent(String(c.id))}`, {
    method: 'PUT',
    body: {
      code: c.code,
      percent: c.percent,
      amount: c.amount,
      minOrder: c.minOrder,
      maxUses: c.maxUses,
      expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 10) : null,
      active: !c.active,
    },
  });
  revalidatePath(`${page(companyId)}/cupones`);
}

export async function deleteCouponAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  await authedApi(`${path(companyId)}/coupons/${encodeURIComponent(text(formData, 'couponId'))}`, { method: 'DELETE' });
  revalidatePath(`${page(companyId)}/cupones`);
}

export async function updateOrderAction(formData: FormData) {
  const companyId = text(formData, 'companyId');
  const orderId = text(formData, 'orderId');
  const body: Record<string, unknown> = {};
  if (formData.has('status')) body.status = text(formData, 'status');
  if (formData.has('paid')) body.paid = text(formData, 'paid') === 'true';
  if (formData.has('staffNote')) body.staffNote = text(formData, 'staffNote');
  await authedApi(`${path(companyId)}/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body });
  revalidatePath(page(companyId), 'layout');
}

// ───── tienda pública (sin sesión) ─────

export async function quoteCartAction(
  slug: string,
  items: CartItem[],
  delivery: string,
  coupon?: string,
): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  if (!SLUG.test(slug)) return { ok: false, error: 'Tienda no encontrada.' };
  const res = await rawApi<Quote & ApiError>(`/public/store/${slug}/quote`, {
    method: 'POST',
    body: { items, delivery, coupon: coupon || undefined },
  });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo calcular el total.') };
  return { ok: true, quote: res.data };
}

export async function placeOrderAction(
  slug: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; order: PublicOrder } | { ok: false; error: string }> {
  if (!SLUG.test(slug)) return { ok: false, error: 'Tienda no encontrada.' };
  const res = await rawApi<PublicOrder & ApiError>(`/public/store/${slug}/orders`, { method: 'POST', body: payload });
  if (!res.ok) return { ok: false, error: errorText(res.data, 'No se pudo hacer el pedido.') };
  return { ok: true, order: res.data };
}
