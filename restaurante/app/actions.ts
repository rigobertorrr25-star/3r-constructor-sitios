'use server';

import { importMenu, parseMenuText } from '@/lib/menu-import';
import { importRecipes, parseRecipesText } from '@/lib/recipe-import';
import { matchPhotosWithAi, readReceiptWithAi, readStockWithAi, readWithAi, type ReadKind } from '@/lib/ai-read';
import { bulkStock, inventoryFromMenu, type NewStockItem, type StockRow } from '@/lib/inventory-bulk';
import { applyLibraryPhotos } from '@/lib/photo-library';
import { createFixture, removeFixture, saveFixtureLayout, updateFixture } from '@/lib/floor';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getLang, trServer } from '@/lib/i18n/server';
import { closeWaiterShift, updateWorkMode, verifyWaiterShift } from '@/lib/waiters';
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
import { can, homeOf, ownStation } from '@/lib/permissions';
import { moveTicket } from '@/lib/kds';
import { saveFiscal, setInvoiceCustomer } from '@/lib/invoices';
import { createAppointment, payAppointment, saveService, setAppointmentStatus } from '@/lib/appointments';
import { getBrief } from '@/lib/brief';
import { createReservation, requestReservation, seatReservation, updatePublicSettings, updateReservation } from '@/lib/reservations';
import { addExpense, voidExpense, type PurchaseLine } from '@/lib/finance';
import { itemsForPurchase, listItems, registerCount, registerPurchase, registerWaste, saveItem, saveRecipe } from '@/lib/inventory';
import { addMovement, applyDiscount, closeShift, openShift, pay, reversePayment, voidDiscount } from '@/lib/cash';
import { getMenu, saveCategory, setCategoryStations, saveProduct, sendOrder, setProductAvailable, voidItem, type CartLine } from '@/lib/orders';
import { allow, clientIp } from '@/lib/rate-limit';
import { clearInventory, clearMenu, clearSales } from '@/lib/sales-reset';
import { removeBackground, saveBackground, setFloorBackground } from '@/lib/backgrounds';
import { removeProductPhoto, saveProductPhoto } from '@/lib/product-photos';
import { createAgentCode, enqueueClosing, printBill, printTest, removePrinter, reprint, savePrinter } from '@/lib/printing';
import {
  AppError,
  closeTable,
  createBusiness,
  createLocation,
  createStaff,
  createTable,
  createTables,
  getBusinessBySlug,
  listLoginPeople,
  loginStaff,
  logStaffLogout,
  moveSession,
  openTable,
  removeTable,
  removeTables,
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

/** Borra las ventas de prueba de un negocio (solo 3R). Hay que escribir el nombre del negocio para confirmar. */
export async function clearSalesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await clearSales(text(formData, 'businessId'), text(formData, 'confirmName'));
    revalidatePath('/admin');
    revalidatePath('/app', 'layout');
    return {
      ok: Date.now(),
      message: await trServer(`Listo. Se borraron ${r.sessions} mesas, ${r.payments} pagos y ${r.shifts} turnos de caja. El negocio arranca a vender de cero.`),
    };
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
}

/** Borra toda la carta de un negocio (solo 3R). Hay que escribir el nombre del negocio para confirmar. */
export async function clearMenuAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await clearMenu(text(formData, 'businessId'), text(formData, 'confirmName'));
    revalidatePath('/admin');
    revalidatePath('/app', 'layout');
    return { ok: Date.now(), message: await trServer(`Listo. Se borraron ${r.categories} categorías y ${r.products} productos. Ya puedes cargar la carta de nuevo.`) };
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
}

/** Borra todo el inventario de un negocio (solo 3R). Hay que escribir el nombre del negocio para confirmar. */
export async function clearInventoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await clearInventory(text(formData, 'businessId'), text(formData, 'confirmName'));
    revalidatePath('/admin');
    revalidatePath('/app', 'layout');
    return { ok: Date.now(), message: await trServer(`Listo. Se borraron ${r.items} insumos y ${r.movements} movimientos. Ya puedes cargar el inventario de nuevo.`) };
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

export async function createTablesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let created: string[] = [];
  try {
    created = await createTables(staff, { zone: text(formData, 'zone'), count: int(formData, 'count'), capacity: int(formData, 'capacity'), shape: text(formData, 'shape') });
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app');
  revalidatePath('/app/plano');
  return { ok: Date.now(), message: await trServer(`Listo: ${created.length} mesas nuevas, de la ${created[0]} a la ${created.at(-1)}.`) };
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

export async function removeTablesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  if (formData.get('scope') === 'all' && formData.get('confirm') !== 'on')
    return { error: await trServer('Marca la casilla para confirmar que quieres quitar todas las mesas.') };
  let result: { removed: number; kept: string[] };
  try {
    result = await removeTables(staff, formData.get('scope') === 'all' ? 'all' : formData.getAll('tableId').map(String));
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app');
  revalidatePath('/app/plano');
  const message = result.kept.length
    ? await trServer(`Listo: se quitaron ${result.removed} mesas. Quedan las abiertas: ${result.kept.join(', ')}.`)
    : await trServer(`Listo: se quitaron ${result.removed} mesas.`);
  return { ok: Date.now(), message };
}

/** Lo llama el editor del plano (no es un formulario): devuelve el error o nada. */
export async function saveLayoutAction(
  positions: { id: string; x: number; y: number; w: number; h: number }[],
  fixtures: { id: string; x: number; y: number; w: number; h: number }[] = [],
): Promise<string | null> {
  const staff = await requireStaff();
  try {
    if (positions.length) await saveLayout(staff, positions);
    if (fixtures.length) await saveFixtureLayout(staff, fixtures);
  } catch (error) {
    return await messageOf(error);
  }
  revalidatePath('/app');
  revalidatePath('/app/plano');
  return null;
}

export async function createFixtureAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () => createFixture(staff, { zone: text(formData, 'zone'), label: text(formData, 'label'), seats: int(formData, 'seats'), seatSide: text(formData, 'seatSide') }),
    ['/app', '/app/plano'],
  );
}

export async function updateFixtureAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(
    formData,
    () => updateFixture(staff, text(formData, 'fixtureId'), { label: text(formData, 'label'), seats: int(formData, 'seats'), seatSide: text(formData, 'seatSide') }),
    ['/app', '/app/plano'],
    'Barra guardada.',
  );
}

export async function removeFixtureAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => removeFixture(staff, text(formData, 'fixtureId')), ['/app', '/app/plano']);
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

/** Carta → «Poner fotos de la biblioteca»: los productos sin foto reciben la de la biblioteca de 3R. */
export async function applyLibraryPhotosAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let result: Awaited<ReturnType<typeof applyLibraryPhotos>>;
  try {
    const h = await headers();
    result = await applyLibraryPhotos(staff, h.get('host') ? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}` : undefined);
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app/carta');
  revalidatePath('/app');
  const parts = [await trServer(`Listo: ${result.placed} productos quedaron con foto.`)];
  if (result.missing.length) parts.push(await trServer(`Sin foto en la biblioteca: ${result.missing.slice(0, 12).join(', ')}${result.missing.length > 12 ? '…' : ''}.`));
  return { ok: Date.now(), message: parts.join(' ') };
}

/** Importar la carta pegada en texto (Carta → Importar carta). */
export async function importMenuAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let counts: Awaited<ReturnType<typeof importMenu>>;
  try {
    counts = await importMenu(staff, String(formData.get('menu') ?? ''), staff.barOnly ? 'bar' : text(formData, 'station') === 'kitchen' ? 'kitchen' : 'bar');
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app/carta');
  revalidatePath('/app');
  return {
    ok: Date.now(),
    message: await trServer(
      `Listo: ${counts.categories} categorías nuevas, ${counts.products} productos nuevos y ${counts.prices} precios cambiados; ${counts.same} sin cambios.`,
    ),
  };
}

/** Pasa a texto el PDF o las fotos (de la carta o de las recetas) con IA, para revisarlo antes de importarlo. */
async function readFiles(kind: ReadKind, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  let text: string;
  try {
    const files = await Promise.all(
      formData
        .getAll('files')
        .filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f)
        .map(async (f) => ({ type: f.type, size: f.size, data: Buffer.from(await f.arrayBuffer()) })),
    );
    text = await readWithAi(staff, kind, files);
  } catch (error) {
    return fail(await messageOf(error));
  }
  // Se cuenta lo leído; si el texto no pasa la revisión, igual se entrega para que la persona lo corrija.
  let message: string;
  try {
    if (kind === 'menu') {
      const menu = parseMenuText(text);
      const products = menu.categories.reduce((n, c) => n + c.products.length, 0);
      message = await trServer(`Leímos ${menu.categories.length} categorías y ${products} productos. Revísalos abajo, corrige lo que haga falta y toca «Importar carta».`);
    } else {
      const recipes = parseRecipesText(text);
      message = await trServer(`Leímos ${recipes.products.length} recetas. Revísalas abajo, corrige lo que haga falta y toca «Importar recetas».`);
    }
  } catch {
    message = await trServer('Leímos el archivo, pero hay líneas que revisar. Corrígelas abajo antes de importar.');
  }
  return { ok: Date.now(), message, values: { text } };
}

export async function readMenuFileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return readFiles('menu', formData);
}

export async function readRecipesFileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return readFiles('recipes', formData);
}

/** Importar las recetas pegadas o leídas del PDF (Inventario → Importar recetas). */
export async function importRecipesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('inventory.manage');
  let r: Awaited<ReturnType<typeof importRecipes>>;
  try {
    r = await importRecipes(staff, String(formData.get('recipes') ?? ''));
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app/inventario');
  revalidatePath('/app/carta');
  const parts = [await trServer(`Listo: ${r.recipes} productos con receta y ${r.items} insumos nuevos.`)];
  if (r.missing.length) parts.push(await trServer(`No están en la carta (revisa el nombre): ${r.missing.slice(0, 15).join(', ')}${r.missing.length > 15 ? '…' : ''}.`));
  if (r.conflicts.length) parts.push(await trServer(`Sin tocar (ya existe ese insumo en otra unidad): ${r.conflicts.slice(0, 15).join(', ')}${r.conflicts.length > 15 ? '…' : ''}.`));
  return { ok: Date.now(), message: parts.join(' ') };
}

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

/** Carta → «¿A dónde va cada categoría?» (campos station:ID). */
export async function setCategoryStationsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const changes: { id: string; station: string }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^station:(.+)$/.exec(key);
    if (m && typeof value === 'string') changes.push({ id: m[1], station: value });
  }
  let moved: number;
  try {
    moved = await setCategoryStations(staff, changes);
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app/carta');
  return { ok: Date.now(), message: await trServer(moved ? `Listo: ${moved} categorías cambiaron de estación, con sus productos.` : 'No había nada que cambiar.') };
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
        options: formData.has('options') ? String(formData.get('options') ?? '') : undefined,
      }),
    ['/app/carta'],
    'Producto guardado.',
  );
}

/** Agotado / disponible (botón, no formulario). */
/** Carta → «Todo a cocina» / «Todo a barra» en una categoría: ella y todos sus productos van a esa estación. */
export async function moveCategoryAction(categoryId: string, station: string): Promise<string | null> {
  const staff = await requireStaff();
  try {
    await setCategoryStations(staff, [{ id: categoryId, station }]);
  } catch (error) {
    return await messageOf(error);
  }
  revalidatePath('/app/carta');
  return null;
}

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
  return run(
    formData,
    () => voidItem(staff, text(formData, 'itemId'), text(formData, 'reason'), formData.has('preparedChoice') ? formData.get('prepared') === 'on' : undefined),
    ['/app', `/app/mesa/${text(formData, 'sessionId')}`],
    'Anulado.',
  );
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

// ───────── bar sin cajero: cada mesero cobra y entrega su cierre ─────────

export async function updateWorkModeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('locations.manage');
  return run(
    formData,
    () =>
      updateWorkMode(staff, {
        waitersCollect: formData.get('waitersCollect') === 'on',
        barOnly: formData.get('barOnly') === 'on',
        suggestedTip: int(formData, 'suggestedTip'),
      }),
    ['/app', '/app/sedes', '/app/meseros', '/app/mi-cuenta'],
    'Guardado.',
  );
}

/** El mesero entrega su cuenta (o el administrador la cierra por él). El cierre sale en la impresora de caja. */
export async function closeWaiterShiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const staffId = text(formData, 'staffId') || staff.id;
  let result: { shiftId: string; waiter: string } | null = null;
  const state = await run(
    formData,
    async () => {
      result = await closeWaiterShift(staff, staffId, pesos(formData, 'countedCash'), text(formData, 'notes'));
    },
    ['/app/mi-cuenta', '/app/meseros'],
    'Cuenta cerrada. El administrador la va a verificar.',
  );
  if (state?.error || !result) return state;
  const done: { shiftId: string; waiter: string } = result;
  await enqueueClosing(staff, done.shiftId, done.waiter).catch((error) => console.error('No se pudo mandar a imprimir el cierre:', error));
  return state;
}

export async function verifyWaiterShiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('waiters.verify');
  return run(formData, () => verifyWaiterShift(staff, text(formData, 'shiftId'), text(formData, 'note')), ['/app/meseros', '/app/mi-cuenta'], 'Cierre verificado.');
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
    revalidatePath('/app/mi-cuenta');
    revalidatePath('/app/meseros');
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
        area: text(formData, 'area') || null,
      }),
    ['/app/inventario'],
    'Insumo guardado.',
  );
}

/** Arma el inventario desde la carta: un insumo por producto de las categorías marcadas, y cada venta descuenta 1. */
export async function inventoryFromMenuAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('inventory.load');
  let r: { created: number; linked: number; skipped: string[] };
  try {
    r = await inventoryFromMenu(staff, formData.getAll('categoryId').map(String));
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app/inventario');
  revalidatePath('/app/carta');
  const base = await trServer(`Listo: ${r.created} insumos nuevos y ${r.linked} productos que descuentan 1 por venta.`);
  const skipped = r.skipped.length ? ' ' + (await trServer(`Sin tocar (ya hay un insumo con ese nombre en ml o g): ${r.skipped.join(', ')}.`)) : '';
  return { ok: Date.now(), message: base + skipped };
}

/** Carga de existencias, costos y mínimos de muchos insumos a la vez (campos count:ID, cost:ID, min:ID). */
export async function bulkStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('inventory.load');
  const rows = new Map<string, StockRow>();
  for (const [key, value] of formData.entries()) {
    const m = /^(count|cost|min):(.+)$/.exec(key);
    if (!m || typeof value !== 'string') continue;
    const row = rows.get(m[2]) ?? { itemId: m[2] };
    if (m[1] === 'count') row.counted = value;
    else if (m[1] === 'cost') row.unitCost = value;
    else row.minStock = value;
    rows.set(m[2], row);
  }
  // Insumos nuevos que vio la IA en la foto y la persona dejó marcados (new:N:name, new:N:count, new:N:unit).
  const newItems: NewStockItem[] = [];
  const area = text(formData, 'area');
  for (const [key, value] of formData.entries()) {
    const m = /^new:(\d+):create$/.exec(key);
    if (!m || value !== 'on') continue;
    const unit = text(formData, `new:${m[1]}:unit`);
    newItems.push({
      name: text(formData, `new:${m[1]}:name`),
      counted: text(formData, `new:${m[1]}:count`) || '0',
      unit: unit === 'kg' || unit === 'L' ? unit : 'und',
      area: area === 'bar' ? 'bar' : 'kitchen',
    });
  }
  let r: { counted: number; costs: number; mins: number; created?: number };
  try {
    r = await bulkStock(staff, [...rows.values()], undefined, newItems);
  } catch (error) {
    return fail(await messageOf(error), formData);
  }
  revalidatePath('/app/inventario');
  const created = r.created ? ' ' + (await trServer(`Insumos nuevos: ${r.created}.`)) : '';
  return { ok: Date.now(), message: (await trServer(`Guardado: ${r.counted} cantidades, ${r.costs} costos y ${r.mins} mínimos.`)) + created };
}

/** Inventario → «Llenar con una foto»: la IA cuenta lo que ve en la foto y llena la tabla (la persona revisa y guarda). */
export async function readStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('inventory.load');
  const area = (can(staff.role, 'inventory.manage') ? null : ownStation(staff.role)) ?? text(formData, 'area');
  try {
    const files = await Promise.all(
      formData
        .getAll('files')
        .filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f)
        .map(async (f) => ({ type: f.type, size: f.size, data: Buffer.from(await f.arrayBuffer()) })),
    );
    const items = (await listItems(staff)).filter((i) => i.isActive && (area !== 'bar' && area !== 'kitchen' ? true : i.area === area));
    const reading = await readStockWithAi(
      staff,
      files,
      items.map((i) => ({ id: i.id, name: i.name, countUnit: i.bottleSize ? 'botellas' : i.unit === 'und' ? 'und' : i.unit === 'g' ? 'kg' : 'L' })),
    );
    return {
      ok: Date.now(),
      message: await trServer(
        `La IA leyó ${reading.found.length} insumos${reading.others.length ? ` y ${reading.others.length} que no están en tu inventario` : ''}. Revisa las cantidades abajo, corrige lo que haga falta y toca «Guardar todo».`,
      ),
      values: { reading: JSON.stringify(reading) },
    };
  } catch (error) {
    return fail(await messageOf(error));
  }
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
  const file = formData.get('foto');
  const photo = file instanceof File && file.size ? new Uint8Array(await file.arrayBuffer()) : null;
  return run(
    formData,
    () =>
      addExpense(staff, {
        kind: text(formData, 'kind'),
        category: text(formData, 'category'),
        description: text(formData, 'description'),
        supplier: text(formData, 'supplier'),
        amount: pesos(formData, 'amount'),
        spentOn: text(formData, 'spentOn'),
        paidFromCash: formData.get('paidFromCash') === 'on',
        photo,
        lines: purchaseLines(formData),
        bags: formData.get('bags') ? pesos(formData, 'bags') : 0,
      }),
    ['/app/finanzas', '/app/caja', '/app/facturas', '/app/inventario'],
    'Gasto registrado.',
  );
}

/** Los productos de la factura que van al inventario (campo «lines», JSON que arma la pantalla). */
function purchaseLines(formData: FormData): PurchaseLine[] {
  const raw = String(formData.get('lines') ?? '').trim();
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as PurchaseLine[]) : [];
  } catch {
    return [];
  }
}

/** Facturas → «Facturas de compra»: la IA lee la foto de la factura y propone el gasto (la cajera lo revisa antes de guardar). */
export async function readReceiptAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('expenses.add');
  const file = formData.get('foto');
  if (!(file instanceof File) || !file.size) return { error: await trServer('Escoge una foto.') };
  try {
    const items = await itemsForPurchase(staff);
    const r = await readReceiptWithAi(staff, { type: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) }, items.map((i) => i.name));
    return {
      ok: Date.now(),
      message: await trServer('Listo: revisa lo que leyó la IA, corrige lo que haga falta y guarda.'),
      values: {
        supplier: r.supplier,
        amount: r.total ? String(r.total) : '',
        spentOn: r.date ?? '',
        category: r.category,
        description: r.description,
        lines: JSON.stringify(r.lines),
        bags: r.bags ? String(r.bags) : '',
      },
    };
  } catch (error) {
    return fail(await messageOf(error));
  }
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

export async function setFloorBackgroundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('locations.manage');
  const on = text(formData, 'on') === '1';
  return run(formData, () => setFloorBackground(staff, on), ['/app', '/app/plano', '/app/sedes'], on ? 'Listo. El plano de mesas ya lleva tu fondo.' : 'Listo. El plano de mesas vuelve al piso de madera.');
}

// ───────── fotos de los productos ─────────

export async function saveProductPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('menu.edit');
  const file = formData.get('foto');
  if (!(file instanceof File) || !file.size) return { error: await trServer('Escoge una foto.') };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return run(formData, () => saveProductPhoto(staff, text(formData, 'productId'), bytes), ['/app/carta', '/app/mesa'], 'Listo. Ya se ve la foto en la carta.');
}

/** Carta → «Subir fotos de los platos»: la IA dice qué producto es cada foto (la persona lo revisa antes de guardar). */
export async function matchPhotosAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('menu.edit');
  try {
    const photos = await Promise.all(
      formData
        .getAll('photos')
        .filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && f.size > 0)
        .map(async (f) => ({ type: f.type, size: f.size, data: Buffer.from(await f.arrayBuffer()) })),
    );
    const menu = await getMenu(staff.businessId);
    const products = menu.products.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }));
    const matches = await matchPhotosWithAi(staff, photos, products);
    return { ok: Date.now(), values: { matches: JSON.stringify(matches) } };
  } catch (error) {
    return fail(await messageOf(error));
  }
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
        host: text(formData, 'connection') === 'usb' ? `usb:${text(formData, 'usbName')}` : text(formData, 'host'),
        port: text(formData, 'connection') === 'usb' ? 9100 : int(formData, 'port'),
        width: int(formData, 'width'),
        printsKitchen: checked(formData, 'kitchen'),
        printsBar: checked(formData, 'bar'),
        printsCashier: checked(formData, 'cashier'),
        printsOrders: checked(formData, 'orders'),
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

/** «Imprimir cierre» en la pantalla del cuadre: vuelve a mandar el cierre completo a la impresora de caja. */
export async function printClosingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff('cash.operate');
  return run(
    formData,
    async () => {
      if (!(await enqueueClosing(staff, text(formData, 'shiftId')))) throw new AppError('CONFLICT', 'Esta sede no tiene impresora de caja. Agrégala en Impresoras.');
    },
    [],
    'Cierre y ventas por categoría enviados a la impresora de caja.',
  );
}

export async function printBillAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  return run(formData, () => printBill(staff, text(formData, 'sessionId')), [], 'Precuenta enviada a la impresora de caja.');
}
