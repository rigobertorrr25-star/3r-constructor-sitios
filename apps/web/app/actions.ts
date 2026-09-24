'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  REFRESH_COOKIE,
  authedApi,
  clearSession,
  rawApi,
  setSession,
} from '@/lib/api';
import { toCents } from '@/lib/orders';
import { errorText, type ApiError } from '@/lib/types';

/**
 * `ok` cambia con cada envío exitoso. `values` devuelve lo que la persona escribió cuando hay un error:
 * React vacía el formulario después de cada acción, y así no se pierde lo escrito. `code` es el código
 * de error de la API (por ejemplo EMAIL_NOT_VERIFIED), para que el formulario ofrezca una salida concreta.
 */
export type FormState = { error?: string; code?: string; ok?: number; values?: Record<string, string> } | undefined;

type Tokens = { accessToken: string; refreshToken: string };

/** Lo escrito, sin contraseñas ni campos internos de React. */
function fail(error: string, formData: FormData, code?: string): FormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.toLowerCase().includes('password') && !key.startsWith('$ACTION')) values[key] = value;
  }
  return { error, code, values };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const optional = (formData: FormData, name: string) => text(formData, name) || undefined;
const checked = (formData: FormData, name: string) => formData.get(name) === 'on';

/** Solo se vuelve a rutas propias: evita redirigir a sitios externos con `?next=`. */
function safeNext(value: string | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}

// ───────── sesión ─────────

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const res = await rawApi<Tokens & ApiError>('/auth/login', {
    method: 'POST',
    body: { email: text(formData, 'email'), password: String(formData.get('password') ?? '') },
  });
  if (res.status === 401) return fail('Email o contraseña incorrectos.', formData);
  if (res.status === 403) return fail('Tu cuenta está suspendida. Contacta a soporte.', formData);
  if (!res.ok) return fail(errorText(res.data, 'No pudimos iniciar sesión. Inténtalo de nuevo.'), formData);

  await setSession(res.data.accessToken, res.data.refreshToken);
  redirect(safeNext(optional(formData, 'next')));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email');
  const password = String(formData.get('password') ?? '');
  const firstName = text(formData, 'firstName');
  const next = safeNext(optional(formData, 'next'));

  const created = await rawApi<ApiError>('/auth/register', {
    method: 'POST',
    body: { email, password, ...(firstName ? { firstName } : {}) },
  });
  if (created.status === 409) return fail('Ya existe una cuenta con ese email.', formData);
  if (!created.ok) return fail(errorText(created.data, 'No pudimos crear la cuenta.'), formData);

  const login = await rawApi<Tokens & ApiError>('/auth/login', { method: 'POST', body: { email, password } });
  if (!login.ok) redirect('/login');

  await setSession(login.data.accessToken, login.data.refreshToken);
  redirect(next);
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await rawApi('/auth/forgot-password', { method: 'POST', body: { email: text(formData, 'email') } });
  // Mismo resultado exista o no la cuenta: no se revela.
  return { ok: Date.now() };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, 'token');
  const password = String(formData.get('password') ?? '');
  const res = await rawApi<ApiError>('/auth/reset-password', { method: 'POST', body: { token, password } });
  if (!res.ok) return { error: errorText(res.data, 'Ese enlace no es válido o ya expiró. Pide uno nuevo.') };
  redirect('/login?reset=1');
}

export async function resendVerificationAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const res = await authedApi<{ sent?: boolean; alreadyVerified?: boolean } & ApiError>('/auth/resend-verification', { method: 'POST' });
  if (res.status === 429) return { error: 'Ya pediste un enlace hace poco. Espera un momento e inténtalo de nuevo.' };
  if (!res.ok) return { error: errorText(res.data, 'No se pudo reenviar el correo.') };
  return { ok: Date.now() };
}

export async function logoutAction() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await rawApi('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
  }
  await clearSession();
  redirect('/');
}

// ───────── cliente: pedidos ─────────

export async function createOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const hasDomain = text(formData, 'hasDomain');
  const brief = {
    businessName: text(formData, 'businessName'),
    businessType: text(formData, 'businessType'),
    description: text(formData, 'description'),
    phone: optional(formData, 'phone'),
    city: optional(formData, 'city'),
    hasDomain: hasDomain === 'yes' ? true : hasDomain === 'no' ? false : undefined,
    domainWanted: optional(formData, 'domainWanted'),
    pagesWanted: optional(formData, 'pagesWanted'),
    styleNotes: optional(formData, 'styleNotes'),
    references: optional(formData, 'references'),
    extra: optional(formData, 'extra'),
  };

  const res = await authedApi<{ id: string } & ApiError>('/orders', {
    method: 'POST',
    body: { packageSlug: text(formData, 'packageSlug'), maintenance: checked(formData, 'maintenance'), brief },
  });
  if (!res.ok) return fail(errorText(res.data, 'No pudimos crear tu pedido. Inténtalo de nuevo.'), formData, res.data?.code);
  redirect(`/dashboard/pedidos/${res.data.id}?nuevo=1`);
}

export async function sendMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = text(formData, 'orderId');
  const res = await authedApi<ApiError>(`/orders/${encodeURIComponent(orderId)}/messages`, {
    method: 'POST',
    body: { body: text(formData, 'body') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo enviar el mensaje.'), formData);
  revalidatePath(`/dashboard/pedidos/${orderId}`);
  return { ok: Date.now() };
}

export async function cancelOrderAction(formData: FormData) {
  const orderId = text(formData, 'orderId');
  await authedApi(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
  revalidatePath(`/dashboard/pedidos/${orderId}`);
  revalidatePath('/dashboard');
}

/** Mueve un mensaje de contacto de tu página por el embudo (Nuevo, Contactado, Cotizado, Ganado, Perdido). */
export async function updateLeadAction(formData: FormData) {
  const orderId = text(formData, 'orderId');
  const leadId = text(formData, 'leadId');
  await authedApi(`/orders/${encodeURIComponent(orderId)}/leads/${encodeURIComponent(leadId)}`, {
    method: 'PATCH',
    body: { status: text(formData, 'status') },
  });
  revalidatePath(`/dashboard/pedidos/${orderId}`);
}

// ───────── equipo: pedidos, paquetes y sitios ─────────

export async function updateOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = text(formData, 'orderId');
  const paid = text(formData, 'amountPaid');
  const amountPaidCents = paid === '' ? undefined : toCents(paid);
  if (amountPaidCents === null) return fail('El monto pagado no es un número válido.', formData);

  const res = await authedApi<ApiError>(`/admin/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: {
      status: text(formData, 'status'),
      ...(amountPaidCents !== undefined ? { amountPaidCents } : {}),
      deliveryUrl: text(formData, 'deliveryUrl'),
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar.'), formData);
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath('/admin');
  return { ok: Date.now() };
}

export async function adminEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = text(formData, 'orderId');
  const res = await authedApi<ApiError>(`/admin/orders/${encodeURIComponent(orderId)}/events`, {
    method: 'POST',
    body: { body: text(formData, 'body'), internal: checked(formData, 'internal') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo enviar.'), formData);
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: Date.now() };
}

export async function createOrderSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = text(formData, 'orderId');
  const res = await authedApi<{ id: string } & ApiError>(`/admin/orders/${encodeURIComponent(orderId)}/site`, {
    method: 'POST',
    body: { templateSlug: optional(formData, 'templateSlug') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo crear el sitio.'), formData);
  redirect(`/editor/${res.data.id}`);
}

export async function savePackageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const packageId = optional(formData, 'packageId');
  const price = toCents(text(formData, 'price'));
  if (price === null) return fail('El precio no es un número válido.', formData);

  const monthlyText = text(formData, 'monthly');
  let monthly: number | null = null;
  if (monthlyText !== '') {
    monthly = toCents(monthlyText);
    if (monthly === null) return fail('La mensualidad no es un número válido.', formData);
  }

  const deliveryText = text(formData, 'deliveryDays');
  const body = {
    name: text(formData, 'name'),
    ...(packageId ? {} : { slug: text(formData, 'slug') }),
    tagline: text(formData, 'tagline'),
    description: text(formData, 'description'),
    priceCents: price,
    monthlyPriceCents: monthly,
    features: text(formData, 'features').split('\n').map((line) => line.trim()).filter(Boolean),
    pagesIncluded: Number(text(formData, 'pagesIncluded')) || 1,
    deliveryDays: deliveryText === '' ? null : Number(deliveryText),
    sortOrder: Number(text(formData, 'sortOrder')) || 0,
    isFeatured: checked(formData, 'isFeatured'),
    isActive: checked(formData, 'isActive'),
  };

  const res = await authedApi<ApiError>(packageId ? `/admin/packages/${encodeURIComponent(packageId)}` : '/admin/packages', {
    method: packageId ? 'PATCH' : 'POST',
    body,
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el paquete.'), formData);
  revalidatePath('/admin/paquetes');
  revalidatePath('/');
  return { ok: Date.now() };
}

export async function savePortfolioAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const itemId = optional(formData, 'itemId');
  const body = {
    title: text(formData, 'title'),
    url: text(formData, 'url'),
    category: text(formData, 'category'),
    description: text(formData, 'description'),
    // Vacío = sin captura (en una edición, quita la que había).
    thumbnailUrl: text(formData, 'thumbnailUrl'),
    sortOrder: Number(text(formData, 'sortOrder')) || 0,
    isActive: checked(formData, 'isActive'),
  };
  // Al crear, los campos vacíos se omiten para no chocar con las reglas de formato.
  const payload = itemId ? body : Object.fromEntries(Object.entries(body).filter(([, value]) => value !== ''));

  const res = await authedApi<ApiError>(itemId ? `/admin/portfolio/${encodeURIComponent(itemId)}` : '/admin/portfolio', {
    method: itemId ? 'PATCH' : 'POST',
    body: payload,
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el ejemplo.'), formData);
  revalidatePath('/admin/portafolio');
  revalidatePath('/');
  return { ok: Date.now() };
}

export async function deletePortfolioAction(formData: FormData) {
  const itemId = text(formData, 'itemId');
  await authedApi(`/admin/portfolio/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  revalidatePath('/admin/portafolio');
  revalidatePath('/');
}

export async function publishSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const siteId = text(formData, 'siteId');
  const res = await authedApi<ApiError>(`/sites/${encodeURIComponent(siteId)}/publish`, { method: 'POST' });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo publicar el sitio.'), formData);
  revalidatePath('/admin/pedidos/[id]', 'page');
  return { ok: Date.now() };
}

export async function unpublishSiteAction(formData: FormData) {
  const siteId = text(formData, 'siteId');
  await authedApi(`/sites/${encodeURIComponent(siteId)}/unpublish`, { method: 'POST' });
  revalidatePath('/admin/pedidos/[id]', 'page');
}

/** Usa la dirección publicada como el enlace que recibe el cliente al entregar. */
export async function setDeliveryUrlAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = text(formData, 'orderId');
  const res = await authedApi<ApiError>(`/admin/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: { deliveryUrl: text(formData, 'url') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el enlace.'), formData);
  revalidatePath('/admin/pedidos/[id]', 'page');
  return { ok: Date.now() };
}

// ───────── equipo: sitios (editor) ─────────

export async function createSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const description = text(formData, 'description');
  const res = await authedApi<ApiError>('/sites', {
    method: 'POST',
    body: {
      name: text(formData, 'name'),
      templateSlug: text(formData, 'templateSlug') || 'blank',
      ...(description ? { description } : {}),
    },
  });
  if (!res.ok) return fail(errorText(res.data, 'No pudimos crear el sitio.'), formData);
  redirect('/admin/sitios');
}

export async function deleteSiteAction(formData: FormData) {
  const siteId = text(formData, 'siteId');
  await authedApi(`/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE' });
  revalidatePath('/admin/sitios');
}
