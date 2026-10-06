'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getLang, trServer } from '@/lib/i18n/server';
import {
  ADMIN_COOKIE,
  STAFF_COOKIE,
  adminSessionValue,
  authConfigured,
  checkAdminPassword,
  cookieOptions,
  requireAdmin,
  requireStaff,
  staffSessionValue,
} from '@/lib/auth';
import { homeOf } from '@/lib/permissions';
import { moveTicket } from '@/lib/kds';
import { saveFiscal, setInvoiceCustomer } from '@/lib/invoices';
import { createAppointment, payAppointment, saveService, setAppointmentStatus } from '@/lib/appointments';
import { getBrief } from '@/lib/brief';
import { createReservation, requestReservation, seatReservation, updatePublicSettings, updateReservation } from '@/lib/reservations';
import { addExpense, voidExpense } from '@/lib/finance';
import { registerCount, registerPurchase, registerWaste, saveItem, saveRecipe } from '@/lib/inventory';
import { addMovement, applyDiscount, closeShift, openShift, pay, reversePayment, voidDiscount } from '@/lib/cash';
import { saveCategory, saveProduct, sendOrder, setProductAvailable, voidItem, type CartLine } from '@/lib/orders';
import { allow, clientIp } from '@/lib/rate-limit';
import { removeBackground, saveBackground } from '@/lib/backgrounds';
import { removeProductPhoto, saveProductPhoto } from '@/lib/product-photos';
import { createAgentCode, enqueueClosing, printBill, printTest, removePrinter, reprint, savePrinter } from '@/lib/printing';
import {
  AppError,
  closeTable,
  createBusiness,
  createLocation,
  createStaff,
  createTable,
  getBusinessBySlug,
  listLoginPeople,
  loginStaff,
  logStaffLogout,
  moveSession,
  openTable,
  removeTable,
  resetPin,
  saveLayout,
  setBill,
  setBusinessActive,
  slugify,
  updateLocation,
  updateSession,
  updateStaff,
  updateTable,
} from '@/lib/store';

/**
 * `ok` cambia con cada envío exitoso (para cerrar formularios o mostrar "Listo"). `values` devuelve lo escrito
 * cuando hay un error: React vacía el formulario después de cada acción, y así no se pierde.
 */
export type FormState =
  | { error?: string; ok?: number; message?: string; values?: Record<string, string>; locations?: { id: string; name: string }[] }
  | undefined;

/** Cookie (legible) con el último negocio usado en este aparato: la portada lleva directo a su ingreso. */
const LAST_BUSINESS_COOKIE = 'rc_negocio';

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();
const int = (formData: FormData, name: string) => {
  const value = text(formData, name);
  return /^-?\d+$/.test(value) ? Number(value) : NaN;
};
const optionalId = (formData: FormData, name: string) => text(formData, name) || null;

function fail(error: string, formData?: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData?.entries() ?? []) {
    if (typeof value === 'string' && !['password', 'pin', 'pin2', 'ownerPin'].includes(key) && !key.startsWith('$ACTION')) values[key] = value;
  }
  return { error, values };
}

async function messageOf(error: unknown) {
  if (error instanceof AppError) return trServer(error.message);
  console.error(error);
  return trServer('Algo salió mal. Intenta otra vez.');
}

/** Corre una acción del equipo y devuelve el error en el formulario en vez de romper la página. */
async function run(formData: FormData, work: () => Promise<unknown>, paths: string[], message?: string): Promise<FormState> {
  try {
    await work();
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  for (const path of paths) revalidatePath(path);
  return { ok: Date.now(), message: message && (await trServer(message)) };
}

// ───────── 3R ─────────

export async function adminLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!allow(`admin:${await clientIp()}`, 8, 60_000)) return { error: await trServer('Demasiados intentos. Espera un minuto.') };
  if (!authConfigured()) return { error: await trServer('Falta configurar ADMIN_PASSWORD y SESSION_SECRET en el servidor.') };
  if (!checkAdminPassword(String(formData.get('password') ?? ''))) return { error: await trServer('Clave incorrecta.') };
  const session = adminSessionValue();
  (await cookies()).set(ADMIN_COOKIE, session.value, cookieOptions(session.maxAge));
  redirect('/admin');
}

export async function adminLogoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect('/admin/entrar');
}

export async function createBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (text(formData, 'ownerPin') !== text(formData, 'pin2')) return fail(await trServer('Los dos PIN no coinciden.'), formData);
  try {
    const created = await createBusiness({
      name: text(formData, 'name'),
      locationName: text(formData, 'locationName'),
      ownerName: text(formData, 'ownerName'),
      ownerPin: text(formData, 'ownerPin'),
    });
    revalidatePath('/admin');
    return { ok: Date.now(), message: await trServer(`Listo. El equipo entra en la página de inicio escogiendo «${text(formData, 'name')}» (o directo en /n/${created.slug}). El dueño usa el código ${created.ownerCode} y el PIN que pusiste.`) };
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
}

export async function setBusinessActiveAction(businessId: string, active: boolean) {
  await requireAdmin();
  await setBusinessActive(businessId, active);
  revalidatePath('/admin');
}

// ───────── ingreso del equipo ─────────

/** Desde la portada: el código del negocio lleva a su pantalla de ingreso. */
export async function goToBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = slugify(text(formData, 'slug'));
  if (!allow(`find:${await clientIp()}`, 30, 60_000)) return { error: await trServer('Demasiados intentos. Espera un minuto.') };
  const business = await getBusinessBySlug(slug).catch(() => null);
  if (!business) return fail(await trServer('No encontramos ese negocio. Revisa el enlace que te dio tu administrador.'), formData);
  redirect(`/n/${business.slug}`);
}

/** Lista de nombres del restaurante escogido en la portada. */
export async function loginPeopleAction(slug: string) {
  if (!allow(`people:${await clientIp()}`, 60, 60_000)) return null;
  return listLoginPeople(String(slug).slice(0, 80)).catch(() => null);
}

export async function staffLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!allow(`pin:${ip}`, 20, 60_000)) return { error: await trServer('Demasiados intentos desde este aparato. Espera un minuto.') };
  if (!authConfigured()) return { error: await trServer('La app no está configurada todavía (faltan claves en el servidor).') };
  const slug = text(formData, 'slug');
  let result: Awaited<ReturnType<typeof loginStaff>>;
  try {
    result = await loginStaff({ slug, code: text(formData, 'code'), pin: text(formData, 'pin'), locationId: optionalId(formData, 'locationId'), ip });
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  if (result.kind === 'choose-location') return { locations: result.locations, values: { code: text(formData, 'code') } };
  const jar = await cookies();
  const session = staffSessionValue(result.staffId, result.locationId, result.epoch);
  jar.set(STAFF_COOKIE, session.value, cookieOptions(session.maxAge));
  jar.set(LAST_BUSINESS_COOKIE, slug, { ...cookieOptions(365 * 86_400), httpOnly: false });
  redirect(homeOf(result.role));
}

export async function staffLogoutAction() {
  const staff = await requireStaff().catch(() => null);
  if (staff) await logStaffLogout(staff).catch(() => undefined);
  const jar = await cookies();
  jar.delete(STAFF_COOKIE);
  redirect('/');
}

// ───────── mesas ─────────

/** Abre la mesa y lleva directo a tomar el pedido. */
export async function openTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let sessionId = '';
  const state = await run(
    formData,
    async () => {
      sessionId = await openTable(staff, text(formData, 'tableId'), { guests: int(formData, 'guests'), notes: text(formData, 'notes') });
    },
    ['/app'],
  );
  if (state?.error) return state;
  redirect(`/app/mesa/${sessionId}`);
}

export async function updateSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => updateSession(staff, text(formData, 'sessionId'), { guests: int(formData, 'guests'), notes: text(formData, 'notes') }), ['/app'], 'Guardado.');
}

export async function setBillAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => setBill(staff, text(formData, 'sessionId'), text(formData, 'bill') === '1'), ['/app']);
}

export async function moveSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => moveSession(staff, text(formData, 'sessionId'), text(formData, 'toTableId')), ['/app']);
}

export async function closeTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => closeTable(staff, text(formData, 'sessionId'), text(formData, 'reason')), ['/app']);
}

// ───────── plano ─────────

export async function createTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () => createTable(staff, { zone: text(formData, 'zone'), number: text(formData, 'number'), capacity: int(formData, 'capacity'), shape: text(formData, 'shape') }),
    ['/app', '/app/plano'],
  );
}

export async function updateTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      updateTable(staff, text(formData, 'tableId'), {
        zone: text(formData, 'zone'),
        number: text(formData, 'number'),
        capacity: int(formData, 'capacity'),
        shape: text(formData, 'shape'),
        isBlocked: formData.get('isBlocked') === 'on',
      }),
    ['/app', '/app/plano'],
    'Mesa guardada.',
  );
}

export async function removeTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => removeTable(staff, text(formData, 'tableId')), ['/app', '/app/plano']);
}

/** Lo llama el editor del plano (no es un formulario): devuelve el error o nada. */
export async function saveLayoutAction(positions: { id: string; x: number; y: number; w: number; h: number }[]): Promise<string | null> {
  const staff = await requireStaff();
  try {
    await saveLayout(staff, positions);
  } catch (error) {
    return await messageOf(error);
  }
  revalidatePath('/app');
  revalidatePath('/app/plano');
  return null;
}

// ───────── equipo y sedes ─────────

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (text(formData, 'pin') !== text(formData, 'pin2')) return fail(await trServer('Los dos PIN no coinciden.'), formData);
  let code = '';
  const state = await run(
    formData,
    async () => {
      code = (await createStaff(staff, { name: text(formData, 'name'), role: text(formData, 'role'), locationId: optionalId(formData, 'locationId'), pin: text(formData, 'pin') })).code;
    },
    ['/app/equipo'],
  );
  return state?.error ? state : { ...state, message: await trServer(`Listo. Su código para entrar es ${code}.`) };
}

export async function updateStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      updateStaff(staff, text(formData, 'staffId'), {
        name: text(formData, 'name'),
        role: text(formData, 'role'),
        locationId: optionalId(formData, 'locationId'),
        isActive: formData.get('isActive') === 'on',
      }),
    ['/app/equipo'],
    'Guardado.',
  );
}

export async function resetPinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (text(formData, 'pin') !== text(formData, 'pin2')) return fail(await trServer('Los dos PIN no coinciden.'), formData);
  return run(formData, () => resetPin(staff, text(formData, 'staffId'), text(formData, 'pin')), ['/app/equipo'], 'PIN cambiado. Ya puede entrar con el nuevo.');
}

export async function createLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => createLocation(staff, { name: text(formData, 'name'), address: text(formData, 'address') }), ['/app/sedes'], 'Sede creada.');
}

export async function updateLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () => updateLocation(staff, text(formData, 'locationId'), { name: text(formData, 'name'), address: text(formData, 'address'), isActive: formData.get('isActive') === 'on' }),
    ['/app/sedes'],
    'Guardado.',
  );
}

// ───────── carta y pedidos ─────────

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      saveCategory(staff, {
        id: optionalId(formData, 'id'),
        name: text(formData, 'name'),
        nameEn: text(formData, 'nameEn'),
        station: text(formData, 'station'),
        sort: int(formData, 'sort') || 0,
        isActive: formData.has('id') ? formData.get('isActive') === 'on' : true,
      }),
    ['/app/carta'],
    'Categoría guardada.',
  );
}

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      saveProduct(staff, {
        id: optionalId(formData, 'id'),
        categoryId: text(formData, 'categoryId'),
        name: text(formData, 'name'),
        description: text(formData, 'description'),
        nameEn: text(formData, 'nameEn'),
        descriptionEn: text(formData, 'descriptionEn'),
        price: text(formData, 'price'),
        station: text(formData, 'station'),
        isActive: formData.has('id') ? formData.get('isActive') === 'on' : true,
      }),
    ['/app/carta'],
    'Producto guardado.',
  );
}

/** Agotado / disponible (botón, no formulario). */
export async function setAvailableAction(productId: string, available: boolean): Promise<string | null> {
  const staff = await requireStaff();
  try {
    await setProductAvailable(staff, productId, available);
  } catch (error) {
    return await messageOf(error);
  }
  revalidatePath('/app/carta');
  return null;
}

/** Envía el carrito de una mesa. `clientKey` lo genera el aparato: si se repite, no se duplica el pedido. */
export async function sendOrderAction(sessionId: string, lines: CartLine[], clientKey: string): Promise<{ error?: string; number?: number }> {
  const staff = await requireStaff();
  try {
    const result = await sendOrder(staff, sessionId, lines, clientKey);
    revalidatePath('/app');
    revalidatePath(`/app/mesa/${sessionId}`);
    return { number: result.number };
  } catch (error) {
    return { error: await messageOf(error) };
  }
}

export async function voidItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => voidItem(staff, text(formData, 'itemId'), text(formData, 'reason')), ['/app', `/app/mesa/${text(formData, 'sessionId')}`], 'Anulado.');
}

// ───────── cocina y barra ─────────

/** Avanza (o devuelve un paso) una comanda. Devuelve el error o nada. */
export async function moveTicketAction(ticketId: string, to: string): Promise<string | null> {
  const staff = await requireStaff();
  try {
    await moveTicket(staff, ticketId, to);
  } catch (error) {
    return await messageOf(error);
  }
  revalidatePath('/app');
  revalidatePath('/app/cocina');
  revalidatePath('/app/barra');
  return null;
}

// ───────── caja ─────────

const pesos = (formData: FormData, name: string) => {
  const value = text(formData, name).replace(/[.\s$]/g, '');
  return value === '' ? NaN : /^\d+$/.test(value) ? Number(value) : NaN;
};

export async function openShiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => openShift(staff, pesos(formData, 'openingAmount') || 0), ['/app/caja']);
}

/** Cierra la caja y lleva al cuadre de ese turno (esperado, contado y diferencia). */
export async function closeShiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let shiftId = '';
  const state = await run(
    formData,
    async () => {
      shiftId = (await closeShift(staff, pesos(formData, 'countedCash'), text(formData, 'notes'))).shiftId;
    },
    ['/app/caja'],
  );
  if (state?.error) return state;
  // El resumen sale en la impresora de caja; si falla, la caja igual quedó cerrada (se reimprime desde Impresoras).
  await enqueueClosing(staff, shiftId).catch((error) => console.error('No se pudo mandar a imprimir el cierre:', error));
  redirect(`/app/caja/turno/${shiftId}`);
}

export async function movementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => addMovement(staff, { kind: text(formData, 'kind'), amount: pesos(formData, 'amount'), reason: text(formData, 'reason') }), ['/app/caja'], 'Registrado.');
}

export async function discountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const sessionId = text(formData, 'sessionId');
  const kind = text(formData, 'kind');
  const value = pesos(formData, 'value');
  return run(
    formData,
    () => applyDiscount(staff, sessionId, { percent: kind === 'percent' ? value : null, amount: kind === 'amount' ? value : null, reason: text(formData, 'reason') }),
    [`/app/caja/mesa/${sessionId}`, '/app/caja'],
    'Descuento aplicado.',
  );
}

export async function voidDiscountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => voidDiscount(staff, text(formData, 'discountId')), [`/app/caja/mesa/${text(formData, 'sessionId')}`]);
}

/** Cobro (no es un formulario simple: lleva su identificador para no cobrar dos veces). */
export async function payAction(
  sessionId: string,
  input: { method: string; amount: number; tip: number; received: number | null; reference: string; clientKey: string },
): Promise<{ error?: string; change?: number | null; closed?: boolean }> {
  const staff = await requireStaff();
  try {
    const result = await pay(staff, sessionId, input);
    revalidatePath('/app');
    revalidatePath('/app/caja');
    revalidatePath(`/app/caja/mesa/${sessionId}`);
    return { change: result.change, closed: result.closed };
  } catch (error) {
    return { error: await messageOf(error) };
  }
}

export async function reversePaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => reversePayment(staff, text(formData, 'paymentId'), text(formData, 'reason')), ['/app', '/app/caja', `/app/caja/mesa/${text(formData, 'sessionId')}`], 'Pago reversado.');
}

// ───────── inventario ─────────

export async function saveItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      saveItem(staff, {
        id: optionalId(formData, 'id'),
        name: text(formData, 'name'),
        unit: text(formData, 'unit'),
        minStock: text(formData, 'minStock') || 0,
        bottleSize: text(formData, 'bottleSize') || null,
        unitCost: text(formData, 'unitCost') || null,
        isActive: formData.has('id') ? formData.get('isActive') === 'on' : true,
      }),
    ['/app/inventario'],
    'Insumo guardado.',
  );
}

export async function inventoryMoveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const kind = text(formData, 'kind');
  const itemId = text(formData, 'itemId');
  let message = 'Registrado.';
  const state = await run(
    formData,
    async () => {
      if (kind === 'purchase') await registerPurchase(staff, { itemId, quantity: text(formData, 'quantity'), total: text(formData, 'total').replace(/[.$\s]/g, ''), reason: text(formData, 'reason') });
      else if (kind === 'waste') await registerWaste(staff, { itemId, quantity: text(formData, 'quantity'), reason: text(formData, 'reason') });
      else if (kind === 'count') {
        const r = await registerCount(staff, { itemId, counted: text(formData, 'counted'), inBottles: formData.get('inBottles') === 'on', reason: text(formData, 'reason') });
        const n = (v: number) => `${Number(v.toFixed(3)).toLocaleString('es-CO')} ${r.unit}`;
        message = r.difference === 0 ? 'Cuadra con lo que había en el sistema.' : `Debía haber ${n(r.expected)} y hay ${n(r.counted)}: ${r.difference > 0 ? 'sobran' : 'faltan'} ${n(Math.abs(r.difference))}.`;
      } else throw new Error('tipo de movimiento');
    },
    ['/app/inventario', `/app/inventario/${itemId}`],
  );
  return state?.error ? state : { ...state, message: await trServer(message) };
}

export async function saveRecipeAction(productId: string, lines: { itemId: string; quantity: string }[]): Promise<string | null> {
  const staff = await requireStaff();
  try {
    await saveRecipe(staff, productId, lines);
  } catch (error) {
    return await messageOf(error);
  }
  revalidatePath('/app/carta');
  revalidatePath(`/app/carta/receta/${productId}`);
  return null;
}

// ───────── gastos ─────────

export async function addExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      addExpense(staff, {
        category: text(formData, 'category'),
        description: text(formData, 'description'),
        supplier: text(formData, 'supplier'),
        amount: pesos(formData, 'amount'),
        spentOn: text(formData, 'spentOn'),
        paidFromCash: formData.get('paidFromCash') === 'on',
      }),
    ['/app/finanzas', '/app/caja'],
    'Gasto registrado.',
  );
}

export async function voidExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => voidExpense(staff, text(formData, 'expenseId'), text(formData, 'reason')), ['/app/finanzas', '/app/caja'], 'Gasto anulado.');
}

// ───────── reservas ─────────

export async function createReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      createReservation(staff, {
        name: text(formData, 'name'),
        phone: text(formData, 'phone'),
        date: text(formData, 'date'),
        time: text(formData, 'time'),
        guests: int(formData, 'guests'),
        tableId: optionalId(formData, 'tableId'),
        notes: text(formData, 'notes'),
        deposit: pesos(formData, 'deposit') || 0,
      }),
    ['/app/reservas', '/app'],
    'Reserva guardada.',
  );
}

export async function updateReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const input: { status?: string; tableId?: string | null } = {};
  if (formData.has('status')) input.status = text(formData, 'status');
  if (formData.has('tableId')) input.tableId = optionalId(formData, 'tableId');
  return run(formData, () => updateReservation(staff, text(formData, 'reservationId'), input), ['/app/reservas', '/app']);
}

/** Llegó el cliente: abre su mesa y lleva al pedido. */
export async function seatReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let sessionId = '';
  const state = await run(
    formData,
    async () => {
      sessionId = await seatReservation(staff, text(formData, 'reservationId'), optionalId(formData, 'tableId'));
    },
    ['/app/reservas', '/app'],
  );
  if (state?.error) return state;
  redirect(`/app/mesa/${sessionId}`);
}

export async function publicSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => updatePublicSettings(staff, { phone: text(formData, 'phone'), reservationsEnabled: formData.get('reservationsEnabled') === 'on' }), ['/app/qr'], 'Guardado.');
}

/** Reserva pedida por el cliente desde el enlace público (sin cuenta). */
export async function requestReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!allow(`reserva:${await clientIp()}`, 5, 10 * 60_000)) return { error: await trServer('Demasiadas solicitudes desde este aparato. Intenta más tarde.') };
  try {
    const r = await requestReservation(text(formData, 'slug'), {
      name: text(formData, 'name'),
      phone: text(formData, 'phone'),
      email: text(formData, 'email'),
      date: text(formData, 'date'),
      time: text(formData, 'time'),
      guests: int(formData, 'guests'),
      notes: text(formData, 'notes'),
      locationId: optionalId(formData, 'locationId'),
    });
    return { ok: Date.now(), message: await trServer(`¡Listo! ${r.businessName} recibió tu solicitud para ${text(formData, 'date')} a las ${text(formData, 'time')}. Te confirman por teléfono o WhatsApp.`) };
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
}

// ───────── resumen con IA ─────────

/** Vuelve a escribir el resumen del día (por ejemplo, al cerrar la noche con todas las ventas). */
export async function refreshBriefAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (!allow(`brief:${staff.businessId}`, 10, 60 * 60_000)) return { error: await trServer('Ya se reescribió varias veces en la última hora. Intenta más tarde.') };
  const lang = await getLang();
  return run(
    formData,
    () => getBrief(staff, { day: text(formData, 'day'), locationId: optionalId(formData, 'scope'), timeZone: staff.timezone, refresh: true, lang }),
    ['/app/tablero'],
  );
}

// ───────── servicios y citas ─────────

export async function saveServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      saveService(staff, {
        id: optionalId(formData, 'id'),
        name: text(formData, 'name'),
        price: pesos(formData, 'price'),
        duration: int(formData, 'duration'),
        commission: int(formData, 'commission') || 0,
        isActive: formData.has('id') ? formData.get('isActive') === 'on' : true,
      }),
    ['/app/agenda'],
    'Servicio guardado.',
  );
}

export async function createAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () =>
      createAppointment(staff, {
        name: text(formData, 'name'),
        phone: text(formData, 'phone'),
        serviceId: text(formData, 'serviceId'),
        staffId: text(formData, 'staffId'),
        date: text(formData, 'date'),
        time: text(formData, 'time'),
        notes: text(formData, 'notes'),
      }),
    ['/app/agenda'],
    'Cita agendada.',
  );
}

export async function appointmentStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => setAppointmentStatus(staff, text(formData, 'appointmentId'), text(formData, 'status')), ['/app/agenda']);
}

/** Cobra una cita (con su identificador para no cobrar dos veces si se repite). */
export async function payAppointmentAction(
  id: string,
  input: { method: string; tip: number; received: number | null; reference: string; clientKey: string },
): Promise<{ error?: string; change?: number | null }> {
  const staff = await requireStaff();
  try {
    const r = await payAppointment(staff, id, input);
    revalidatePath('/app/agenda');
    revalidatePath('/app/caja');
    return { change: r.change };
  } catch (error) {
    return { error: await messageOf(error) };
  }
}

// ───────── facturas ─────────

export async function saveFiscalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () => saveFiscal(staff, { legalName: text(formData, 'legalName'), taxId: text(formData, 'taxId'), taxKind: text(formData, 'taxKind'), resolution: text(formData, 'resolution') }),
    ['/app/facturas'],
    'Datos de facturación guardados.',
  );
}

export async function invoiceCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () => setInvoiceCustomer(staff, text(formData, 'invoiceId'), { docType: text(formData, 'docType'), docNumber: text(formData, 'docNumber'), name: text(formData, 'name'), email: text(formData, 'email') }),
    ['/app/facturas', `/app/caja/mesa/${text(formData, 'sessionId')}`],
    'Factura a nombre del cliente.',
  );
}

// ───────── fondo del restaurante ─────────

export async function saveBackgroundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('locations.manage');
  const file = formData.get('foto');
  if (!(file instanceof File) || !file.size) return { error: await trServer('Escoge una foto.') };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return run(formData, () => saveBackground(staff, bytes), ['/', '/app', '/app/sedes'], 'Listo. Ya se ve el fondo nuevo.');
}

export async function removeBackgroundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('locations.manage');
  return run(formData, () => removeBackground(staff), ['/', '/app', '/app/sedes'], 'Listo. Se quitó el fondo.');
}

// ───────── fotos de los productos ─────────

export async function saveProductPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('menu.edit');
  const file = formData.get('foto');
  if (!(file instanceof File) || !file.size) return { error: await trServer('Escoge una foto.') };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return run(formData, () => saveProductPhoto(staff, text(formData, 'productId'), bytes), ['/app/carta', '/app/mesa'], 'Listo. Ya se ve la foto en la carta.');
}

export async function removeProductPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('menu.edit');
  return run(formData, () => removeProductPhoto(staff, text(formData, 'productId')), ['/app/carta', '/app/mesa'], 'Listo. Se quitó la foto.');
}

// ───────── impresión ─────────

const checked = (formData: FormData, name: string) => formData.get(name) === 'on' || formData.get(name) === '1';

export async function savePrinterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('printers.manage');
  const id = optionalId(formData, 'printerId');
  return run(
    formData,
    () =>
      savePrinter(staff, id, {
        name: text(formData, 'name'),
        host: text(formData, 'host'),
        port: int(formData, 'port'),
        width: int(formData, 'width'),
        printsKitchen: checked(formData, 'kitchen'),
        printsBar: checked(formData, 'bar'),
        printsCashier: checked(formData, 'cashier'),
        copies: int(formData, 'copies'),
        isActive: id ? checked(formData, 'isActive') : true,
      }),
    ['/app/impresoras'],
    id ? 'Guardado.' : 'Impresora agregada. Imprime una prueba para revisar que quedó bien.',
  );
}

export async function removePrinterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('printers.manage');
  return run(formData, () => removePrinter(staff, text(formData, 'printerId')), ['/app/impresoras'], 'Impresora quitada.');
}

export async function printTestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('printers.manage');
  return run(formData, () => printTest(staff, text(formData, 'printerId')), ['/app/impresoras'], 'Prueba enviada. Debe salir en unos segundos.');
}

export async function reprintAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('printers.manage');
  return run(formData, () => reprint(staff, text(formData, 'jobId')), ['/app/impresoras'], 'Enviado otra vez.');
}

/** El código se muestra una sola vez en el mensaje (no se guarda tal cual). */
export async function createAgentCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('printers.manage');
  let code = '';
  const state = await run(formData, async () => (code = await createAgentCode(staff)), ['/app/impresoras']);
  return state?.error ? state : { ok: Date.now(), message: code };
}

export async function printBillAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => printBill(staff, text(formData, 'sessionId')), [], 'Precuenta enviada a la impresora de caja.');
}
