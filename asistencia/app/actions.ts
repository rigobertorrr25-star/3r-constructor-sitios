'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SESSION_COOKIE, authConfigured, checkPassword, requireAdmin, sessionValue, type SessionSubject } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { allow, clientIp } from '@/lib/rate-limit';
import { fromLocalInput } from '@/lib/report';
import {
  AppError,
  createBusiness,
  createManager,
  deleteManager,
  findManagerByPassword,
  createEmployee,
  deleteRecord,
  punch,
  resetPin,
  rotateKiosk,
  updateEmployee,
  updateRecord,
  updateShifts,
  type PunchResult,
} from '@/lib/store';

/**
 * `ok` cambia con cada envío exitoso. `values` devuelve lo escrito cuando hay un error: React vacía el
 * formulario después de cada acción, y así no se pierde.
 */
export type FormState = { error?: string; ok?: number; values?: Record<string, string> } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

/** Lo escrito, sin claves, PIN ni campos internos de React. */
function fail(error: string, formData: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !['password', 'pin'].includes(key) && !key.startsWith('$ACTION')) values[key] = value;
  }
  return { error, values };
}

/** El error en el idioma de quien hizo el envío. */
async function messageOf(error: unknown) {
  const lang = await getLang();
  if (error instanceof AppError) return t(lang, error.key, error.vars);
  console.error(error);
  return t(lang, 'errGeneric');
}

const say = async (key: Parameters<typeof t>[1]) => t(await getLang(), key);

// ───────── ingreso al panel ─────────

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!allow(`login:${await clientIp()}`, 8, 60_000)) return { error: await say('errTooManyAttempts') };
  if (!authConfigured()) return { error: await say('errAuthNotConfigured') };
  const password = String(formData.get('password') ?? '');
  let subject: SessionSubject;
  if (checkPassword(password)) subject = 'admin';
  else {
    const manager = await findManagerByPassword(password);
    if (!manager) return { error: await say('errWrongPassword') };
    subject = `m-${manager.id}`;
  }
  const session = sessionValue(subject);
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.maxAge,
  });
  redirect('/panel');
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/entrar');
}

// ───────── empleado (sin sesión) ─────────

export type PunchState = { error?: string; code?: string; result?: PunchResult } | undefined;

export async function punchAction(_prev: PunchState, formData: FormData): Promise<PunchState> {
  // Todos comparten el wifi del restaurante (la misma IP): el límite deja pasar un cambio de turno completo,
  // y adivinar un PIN igual exige un código vigente de la tablet.
  if (!allow(`punch:${await clientIp()}`, 30, 60_000)) return { error: await say('errTooManyAttempts') };
  const pin = text(formData, 'pin');
  // Primera vez: el empleado crea su PIN y lo escribe dos veces.
  if (formData.get('creating') === '1' && pin !== text(formData, 'pinConfirm')) {
    return { error: await say('errPinMismatch'), code: 'PIN_MISMATCH' };
  }
  try {
    return { result: await punch(text(formData, 'slug'), text(formData, 'code'), text(formData, 'employeeId'), pin) };
  } catch (error) {
    return { error: await messageOf(error), code: error instanceof AppError ? error.code : undefined };
  }
}

// ───────── panel ─────────

export async function createBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  let id: string;
  try {
    id = await createBusiness(text(formData, 'name'));
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  redirect(`/panel/${id}`);
}

export async function saveEmployeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  const employeeId = text(formData, 'employeeId');
  const name = text(formData, 'name');
  try {
    if (employeeId) await updateEmployee(businessId, employeeId, { name, isActive: formData.get('isActive') === 'on' });
    else await createEmployee(businessId, { name });
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath(`/panel/${businessId}`);
  return { ok: Date.now() };
}

export async function resetPinAction(formData: FormData) {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  await resetPin(businessId, text(formData, 'employeeId'));
  revalidatePath(`/panel/${businessId}`);
}

/** Turnos del negocio: filas start0/end0, start1/end1…; las vacías se ignoran. */
export async function saveShiftsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  const rows = Array.from({ length: 6 }, (_, i) => ({ start: text(formData, `start${i}`), end: text(formData, `end${i}`) }));
  try {
    await updateShifts(businessId, rows);
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath(`/panel/${businessId}`);
  return { ok: Date.now() };
}

export async function rotateKioskAction(formData: FormData) {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  await rotateKiosk(businessId);
  revalidatePath(`/panel/${businessId}`);
}

export async function updateRecordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  const clockIn = fromLocalInput(text(formData, 'clockIn'));
  if (!clockIn) return fail(await say('errCheckClockIn'), formData);
  const exitText = text(formData, 'clockOut');
  const clockOut = exitText ? fromLocalInput(exitText) : null;
  if (exitText && !clockOut) return fail(await say('errCheckClockOut'), formData);
  try {
    await updateRecord(businessId, text(formData, 'recordId'), new Date(clockIn), clockOut ? new Date(clockOut) : null);
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath(`/panel/${businessId}`);
  return { ok: Date.now() };
}

export async function deleteRecordAction(formData: FormData) {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  await deleteRecord(businessId, text(formData, 'recordId'));
  revalidatePath(`/panel/${businessId}`);
}

// ───────── jefes ─────────

export async function createManagerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  try {
    await createManager(businessId, { name: text(formData, 'name'), password: String(formData.get('password') ?? '') }, process.env.ADMIN_PASSWORD ?? '');
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath(`/panel/${businessId}`);
  return { ok: Date.now() };
}

export async function deleteManagerAction(formData: FormData) {
  await requireAdmin();
  const businessId = text(formData, 'businessId');
  await deleteManager(businessId, text(formData, 'managerId'));
  revalidatePath(`/panel/${businessId}`);
}
