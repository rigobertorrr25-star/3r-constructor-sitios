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
import { fromLocalInput, type PunchResult } from '@/lib/attendance';
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
  const acceptPrivacy = formData.get('acceptPrivacy') === 'on';
  const next = safeNext(optional(formData, 'next'));
  if (!acceptPrivacy) return fail('Para crear la cuenta debes aceptar la política de privacidad.', formData);

  const created = await rawApi<ApiError>('/auth/register', {
    method: 'POST',
    body: { email, password, acceptPrivacy, ...(firstName ? { firstName } : {}) },
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
    body: {
      packageSlug: text(formData, 'packageSlug'),
      maintenance: checked(formData, 'maintenance'),
      customDomain: text(formData, 'address') === 'own',
      brief,
    },
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

/** Abre el pago en línea (Wompi) por lo que falta del pedido. */
export async function payOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = text(formData, 'orderId');
  const res = await authedApi<{ url: string } & ApiError>(`/orders/${encodeURIComponent(orderId)}/payments/wompi`, { method: 'POST' });
  if (!res.ok) return fail(errorText(res.data, 'No pudimos abrir el pago. Inténtalo de nuevo en un momento.'), formData);
  redirect(res.data.url);
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

/** Asigna o quita (vacío) el dominio propio del cliente a su sitio. */
export async function setCustomDomainAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const siteId = text(formData, 'siteId');
  const res = await authedApi<ApiError>(`/sites/${encodeURIComponent(siteId)}/domain`, {
    method: 'PUT',
    body: { domain: text(formData, 'domain') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el dominio.'), formData);
  revalidatePath('/admin/pedidos/[id]', 'page');
  return { ok: Date.now() };
}

/** Cambia la fecha de vencimiento del dominio propio (la que diga el registrador). */
export async function setDomainExpiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const siteId = text(formData, 'siteId');
  const res = await authedApi<ApiError>(`/sites/${encodeURIComponent(siteId)}/domain/expiry`, {
    method: 'PUT',
    body: { expiresOn: text(formData, 'expiresOn') },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar la fecha.'), formData);
  revalidatePath('/admin/pedidos/[id]', 'page');
  return { ok: Date.now() };
}

/** El cliente pagó la renovación del dominio: un año más. */
export async function renewDomainAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const siteId = text(formData, 'siteId');
  const res = await authedApi<ApiError>(`/sites/${encodeURIComponent(siteId)}/domain/renew`, { method: 'POST' });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo renovar el dominio.'), formData);
  revalidatePath('/admin/pedidos/[id]', 'page');
  return { ok: Date.now() };
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

// ───────── asistencia (control de entrada y salida con QR) ─────────

export type PunchState = { error?: string; code?: string; result?: PunchResult } | undefined;

/** Lo usa el empleado desde su celular, sin sesión: el código del QR y su PIN. */
export async function punchAction(_prev: PunchState, formData: FormData): Promise<PunchState> {
  const slug = text(formData, 'slug');
  const pin = text(formData, 'pin');
  if (!/^\d{4}$/.test(pin)) return { error: 'El PIN tiene 4 números.' };
  try {
    const res = await rawApi<PunchResult & ApiError>(`/attendance/${encodeURIComponent(slug)}/punch`, {
      method: 'POST',
      body: { code: text(formData, 'code'), pin },
    });
    if (res.status === 429) return { error: 'Demasiados intentos. Espera un minuto e intenta de nuevo.' };
    if (!res.ok) return { error: errorText(res.data, 'No se pudo marcar. Intenta de nuevo.'), code: res.data?.code };
    return { result: res.data };
  } catch {
    return { error: 'No hay conexión con el servidor. Intenta de nuevo en un momento.' };
  }
}

export async function createAttendanceBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const res = await authedApi<{ id: string } & ApiError>('/admin/attendance', { method: 'POST', body: { name: text(formData, 'name') } });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo crear el negocio.'), formData);
  redirect(`/admin/asistencia/${res.data.id}`);
}

export async function saveAttendanceEmployeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessId = text(formData, 'businessId');
  const employeeId = optional(formData, 'employeeId');
  const pin = text(formData, 'pin');
  const body = {
    name: text(formData, 'name'),
    shiftStart: text(formData, 'shiftStart'),
    shiftEnd: text(formData, 'shiftEnd'),
    // En una edición, el PIN vacío deja el que tenía.
    ...(pin || !employeeId ? { pin } : {}),
    ...(employeeId ? { isActive: checked(formData, 'isActive') } : {}),
  };
  if ((body.shiftStart && !body.shiftEnd) || (!body.shiftStart && body.shiftEnd)) {
    return fail('Pon la hora de inicio y la de fin del turno, o deja las dos vacías.', formData);
  }
  // Al crear, los campos vacíos se omiten para no chocar con las reglas de formato.
  const payload = employeeId ? body : Object.fromEntries(Object.entries(body).filter(([, value]) => value !== ''));
  const base = `/admin/attendance/${encodeURIComponent(businessId)}/employees`;
  const res = await authedApi<ApiError>(employeeId ? `${base}/${encodeURIComponent(employeeId)}` : base, {
    method: employeeId ? 'PATCH' : 'POST',
    body: payload,
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo guardar el empleado.'), formData);
  revalidatePath(`/admin/asistencia/${businessId}`);
  return { ok: Date.now() };
}

export async function rotateKioskAction(formData: FormData) {
  const businessId = text(formData, 'businessId');
  await authedApi(`/admin/attendance/${encodeURIComponent(businessId)}`, { method: 'PATCH', body: { rotateKiosk: true } });
  revalidatePath(`/admin/asistencia/${businessId}`);
}

export async function updateAttendanceRecordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessId = text(formData, 'businessId');
  const recordId = text(formData, 'recordId');
  const clockIn = fromLocalInput(text(formData, 'clockIn'));
  if (!clockIn) return fail('Revisa la hora de entrada.', formData);
  const exitText = text(formData, 'clockOut');
  const clockOut = exitText ? fromLocalInput(exitText) : null;
  if (exitText && !clockOut) return fail('Revisa la hora de salida.', formData);
  const res = await authedApi<ApiError>(`/admin/attendance/${encodeURIComponent(businessId)}/records/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    body: { clockIn, clockOut },
  });
  if (!res.ok) return fail(errorText(res.data, 'No se pudo corregir el registro.'), formData);
  revalidatePath(`/admin/asistencia/${businessId}`);
  return { ok: Date.now() };
}

export async function deleteAttendanceRecordAction(formData: FormData) {
  const businessId = text(formData, 'businessId');
  const recordId = text(formData, 'recordId');
  await authedApi(`/admin/attendance/${encodeURIComponent(businessId)}/records/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
  revalidatePath(`/admin/asistencia/${businessId}`);
}
