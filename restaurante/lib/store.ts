// Reglas del módulo 01: negocios, sedes, equipo, ingreso con PIN, plano de mesas, sesiones de mesa y auditoría.
// Todo se revisa aquí (en el servidor): que la mesa sea de la sede de quien la toca, que tenga permiso, etc.
import { query, transaction, type Db } from './db';
import { hashPassword, verifyPassword } from './passwords';
import { assignableRoles, can, isRole, type Permission, type Role } from './permissions';

/** Error que se muestra tal cual a quien usa la app. */
export class AppError extends Error {
  constructor(
    public code: 'INVALID' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'LOCKED',
    message: string,
  ) {
    super(message);
  }
}

/** Quien hace la acción (sale de su sesión). */
export type Actor = { id: string; name: string; role: Role; businessId: string; locationId: string };

export function requirePermission(actor: Actor, permission: Permission) {
  if (!can(actor.role, permission)) throw new AppError('FORBIDDEN', 'Tu rol no tiene permiso para esto.');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

function requireText(value: string, label: string, min: number, max: number) {
  const text = clean(value);
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

export function slugify(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'negocio'
  );
}

/** PIN de 4 a 6 números, sin los que se adivinan al primer intento (1111, 1234, 4321…). */
export function validatePin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new AppError('INVALID', 'El PIN debe tener de 4 a 6 números.');
  const digits = [...pin].map(Number);
  const same = digits.every((d) => d === digits[0]);
  const up = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const down = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (same || up || down) throw new AppError('INVALID', 'Ese PIN es muy fácil de adivinar. Usa otro.');
}

// ───────── auditoría ─────────

type AuditInput = {
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  reason?: string | null;
  data?: unknown;
  ip?: string | null;
};

export async function audit(db: Db, actor: Pick<Actor, 'businessId' | 'locationId'> & Partial<Pick<Actor, 'id' | 'name'>>, input: AuditInput) {
  await db.query(
    `INSERT INTO audit_events (business_id, location_id, actor_id, actor_name, action, entity, entity_id, summary, reason, data, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      actor.businessId,
      actor.locationId || null,
      actor.id ?? null,
      actor.name ?? null,
      input.action,
      input.entity,
      input.entityId ?? null,
      input.summary.slice(0, 300),
      input.reason?.slice(0, 300) ?? null,
      input.data === undefined ? null : JSON.stringify(input.data),
      input.ip ?? null,
    ],
  );
}

export type AuditEvent = {
  id: string;
  action: string;
  summary: string;
  reason: string | null;
  actorName: string | null;
  locationName: string | null;
  createdAt: Date;
};

export async function listAudit(actor: Actor, options: { limit?: number; action?: string } = {}): Promise<AuditEvent[]> {
  requirePermission(actor, 'audit.view');
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  // El dueño ve todas las sedes; el administrador, la suya.
  const params: unknown[] = [actor.businessId, limit];
  let where = 'a.business_id = $1';
  if (actor.role !== 'owner') {
    params.push(actor.locationId);
    where += ` AND a.location_id = $${params.length}`;
  }
  if (options.action) {
    params.push(options.action);
    where += ` AND a.action = $${params.length}`;
  }
  return query<AuditEvent>(
    `SELECT a.id, a.action, a.summary, a.reason, a.actor_name AS "actorName", l.name AS "locationName", a.created_at AS "createdAt"
       FROM audit_events a LEFT JOIN locations l ON l.id = a.location_id
      WHERE ${where} ORDER BY a.created_at DESC LIMIT $2`,
    params,
  );
}

// ───────── negocios (los crea 3R) ─────────

export type BusinessRow = { id: string; name: string; slug: string; timezone: string; isActive: boolean; createdAt: Date };

export type BusinessSummary = BusinessRow & { locationCount: number; staffCount: number; openTables: number };

export async function createBusiness(input: { name: string; locationName: string; ownerName: string; ownerPin: string }) {
  const name = requireText(input.name, 'Nombre del negocio', 2, 120);
  const locationName = requireText(input.locationName || 'Principal', 'Nombre de la sede', 2, 80);
  const ownerName = requireText(input.ownerName, 'Nombre del dueño', 2, 120);
  validatePin(input.ownerPin);
  const pinHash = await hashPassword(input.ownerPin);
  return transaction(async (db) => {
    const base = slugify(name);
    const taken = await db.query<{ slug: string }>(`SELECT slug FROM businesses WHERE slug = $1 OR slug LIKE $1 || '-%'`, [base]);
    const used = new Set(taken.rows.map((r) => r.slug));
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    const business = (await db.query<{ id: string }>(`INSERT INTO businesses (name, slug) VALUES ($1, $2) RETURNING id`, [name, slug])).rows[0];
    const location = (
      await db.query<{ id: string }>(`INSERT INTO locations (business_id, name) VALUES ($1, $2) RETURNING id`, [business.id, locationName])
    ).rows[0];
    const owner = (
      await db.query<{ id: string }>(
        `INSERT INTO staff (business_id, code, name, role, pin_hash) VALUES ($1, '0001', $2, 'owner', $3) RETURNING id`,
        [business.id, ownerName, pinHash],
      )
    ).rows[0];
    await audit(db, { businessId: business.id, locationId: location.id, name: '3R' }, {
      action: 'business.create',
      entity: 'business',
      entityId: business.id,
      summary: `3R creó el negocio ${name} con la sede ${locationName} y el dueño ${ownerName} (código 0001)`,
    });
    return { businessId: business.id, locationId: location.id, ownerId: owner.id, slug, ownerCode: '0001' };
  });
}

export async function listBusinesses(): Promise<BusinessSummary[]> {
  return query<BusinessSummary>(
    `SELECT b.id, b.name, b.slug, b.timezone, b.is_active AS "isActive", b.created_at AS "createdAt",
            (SELECT count(*)::int FROM locations l WHERE l.business_id = b.id AND l.is_active) AS "locationCount",
            (SELECT count(*)::int FROM staff s WHERE s.business_id = b.id AND s.is_active) AS "staffCount",
            (SELECT count(*)::int FROM table_sessions t WHERE t.business_id = b.id AND t.status <> 'closed') AS "openTables"
       FROM businesses b ORDER BY b.created_at DESC`,
  );
}

export async function getBusinessBySlug(slug: string): Promise<BusinessRow | null> {
  const rows = await query<BusinessRow>(
    `SELECT id, name, slug, timezone, is_active AS "isActive", created_at AS "createdAt" FROM businesses WHERE slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function setBusinessActive(businessId: string, active: boolean) {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
  await transaction(async (db) => {
    const res = await db.query(`UPDATE businesses SET is_active = $2 WHERE id = $1`, [businessId, active]);
    if (!res.rowCount) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
    await audit(db, { businessId, locationId: '', name: '3R' }, {
      action: active ? 'business.activate' : 'business.suspend',
      entity: 'business',
      entityId: businessId,
      summary: active ? '3R reactivó el negocio' : '3R suspendió el negocio: nadie del equipo puede entrar',
    });
  });
}

/** Borra un negocio con todo su historial. Solo para pruebas o una baja pedida por el cliente. */
export async function purgeBusiness(businessId: string) {
  await transaction(async (db) => {
    await db.query(`SET LOCAL app.purge = 'on'`);
    await db.query(`DELETE FROM businesses WHERE id = $1`, [businessId]);
  });
}

// ───────── sedes ─────────

export type Location = { id: string; name: string; address: string | null; isActive: boolean };

export async function listLocations(businessId: string, { activeOnly = false } = {}): Promise<Location[]> {
  return query<Location>(
    `SELECT id, name, address, is_active AS "isActive" FROM locations
      WHERE business_id = $1 ${activeOnly ? 'AND is_active' : ''} ORDER BY created_at`,
    [businessId],
  );
}

export async function createLocation(actor: Actor, input: { name: string; address?: string }) {
  requirePermission(actor, 'locations.manage');
  const name = requireText(input.name, 'Nombre de la sede', 2, 80);
  const address = input.address ? requireText(input.address, 'Dirección', 3, 160) : null;
  return transaction(async (db) => {
    const res = await db.query<{ id: string }>(
      `INSERT INTO locations (business_id, name, address) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
      [actor.businessId, name, address],
    );
    if (!res.rows[0]) throw new AppError('CONFLICT', 'Ya hay una sede con ese nombre.');
    await audit(db, actor, { action: 'location.create', entity: 'location', entityId: res.rows[0].id, summary: `Creó la sede ${name}` });
    return res.rows[0].id;
  });
}

export async function updateLocation(actor: Actor, locationId: string, input: { name: string; address?: string; isActive: boolean }) {
  requirePermission(actor, 'locations.manage');
  if (!isUuid(locationId)) throw new AppError('NOT_FOUND', 'No encontramos esa sede.');
  const name = requireText(input.name, 'Nombre de la sede', 2, 80);
  const address = input.address ? requireText(input.address, 'Dirección', 3, 160) : null;
  if (!input.isActive && locationId === actor.locationId) throw new AppError('INVALID', 'No puedes desactivar la sede en la que estás trabajando.');
  await transaction(async (db) => {
    const before = (
      await db.query<Location>(`SELECT id, name, address, is_active AS "isActive" FROM locations WHERE id = $1 AND business_id = $2 FOR UPDATE`, [
        locationId,
        actor.businessId,
      ])
    ).rows[0];
    if (!before) throw new AppError('NOT_FOUND', 'No encontramos esa sede.');
    if (!input.isActive && before.isActive) {
      const open = await db.query(`SELECT 1 FROM table_sessions WHERE location_id = $1 AND status <> 'closed' LIMIT 1`, [locationId]);
      if (open.rowCount) throw new AppError('CONFLICT', 'Esa sede tiene mesas abiertas. Ciérralas antes de desactivarla.');
    }
    try {
      await db.query(`UPDATE locations SET name = $3, address = $4, is_active = $5 WHERE id = $1 AND business_id = $2`, [
        locationId,
        actor.businessId,
        name,
        address,
        input.isActive,
      ]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new AppError('CONFLICT', 'Ya hay una sede con ese nombre.');
      throw error;
    }
    await audit(db, actor, {
      action: 'location.update',
      entity: 'location',
      entityId: locationId,
      summary: `Cambió la sede ${before.name}${before.isActive !== input.isActive ? (input.isActive ? ' (la activó)' : ' (la desactivó)') : ''}`,
      data: { before, after: { name, address, isActive: input.isActive } },
    });
  });
}

// ───────── equipo ─────────

export type StaffMember = {
  id: string;
  code: string;
  name: string;
  role: Role;
  locationId: string | null;
  locationName: string | null;
  isActive: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
};

const STAFF_SELECT = `SELECT s.id, s.code, s.name, s.role, s.location_id AS "locationId", l.name AS "locationName",
       s.is_active AS "isActive", s.locked_until AS "lockedUntil", s.created_at AS "createdAt"
  FROM staff s LEFT JOIN locations l ON l.id = s.location_id`;

export async function listStaff(actor: Actor): Promise<StaffMember[]> {
  requirePermission(actor, 'staff.manage');
  return query<StaffMember>(`${STAFF_SELECT} WHERE s.business_id = $1 ORDER BY s.is_active DESC, s.code`, [actor.businessId]);
}

async function checkLocation(db: Db, businessId: string, locationId: string | null) {
  if (locationId === null) return;
  if (!isUuid(locationId)) throw new AppError('INVALID', 'Elige una sede válida.');
  const res = await db.query(`SELECT 1 FROM locations WHERE id = $1 AND business_id = $2 AND is_active`, [locationId, businessId]);
  if (!res.rowCount) throw new AppError('INVALID', 'Elige una sede válida.');
}

function checkAssignable(actor: Actor, role: string): Role {
  if (!isRole(role)) throw new AppError('INVALID', 'Elige un rol.');
  if (!assignableRoles(actor.role).includes(role)) throw new AppError('FORBIDDEN', 'Tu rol no puede dar ese rol.');
  return role;
}

export async function createStaff(actor: Actor, input: { name: string; role: string; locationId: string | null; pin: string }) {
  requirePermission(actor, 'staff.manage');
  const name = requireText(input.name, 'Nombre', 2, 120);
  const role = checkAssignable(actor, input.role);
  validatePin(input.pin);
  const pinHash = await hashPassword(input.pin);
  return transaction(async (db) => {
    await checkLocation(db, actor.businessId, input.locationId);
    // Candado por negocio: dos altas al mismo tiempo no se llevan el mismo código.
    await db.query(`SELECT 1 FROM businesses WHERE id = $1 FOR UPDATE`, [actor.businessId]);
    const max = (
      await db.query<{ max: number | null }>(`SELECT max(code::int) AS max FROM staff WHERE business_id = $1 AND code ~ '^[0-9]+$'`, [actor.businessId])
    ).rows[0].max;
    const code = String((max ?? 0) + 1).padStart(4, '0');
    const res = await db.query<{ id: string }>(
      `INSERT INTO staff (business_id, location_id, code, name, role, pin_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [actor.businessId, input.locationId, code, name, role, pinHash],
    );
    await audit(db, actor, {
      action: 'staff.create',
      entity: 'staff',
      entityId: res.rows[0].id,
      summary: `Agregó a ${name} (${code}) como ${role}`,
      data: { role, locationId: input.locationId },
    });
    return { id: res.rows[0].id, code };
  });
}

async function lockTarget(db: Db, actor: Actor, staffId: string) {
  if (!isUuid(staffId)) throw new AppError('NOT_FOUND', 'No encontramos a esa persona.');
  const target = (
    await db.query<{ id: string; name: string; code: string; role: Role; locationId: string | null; isActive: boolean }>(
      `SELECT id, name, code, role, location_id AS "locationId", is_active AS "isActive" FROM staff WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [staffId, actor.businessId],
    )
  ).rows[0];
  if (!target) throw new AppError('NOT_FOUND', 'No encontramos a esa persona.');
  if (!assignableRoles(actor.role).includes(target.role)) throw new AppError('FORBIDDEN', 'Tu rol no puede cambiar a esa persona.');
  return target;
}

/** Tiene que quedar al menos un dueño activo, o nadie podría manejar las sedes. */
async function ensureAnotherOwner(db: Db, businessId: string, exceptId: string) {
  const res = await db.query(`SELECT 1 FROM staff WHERE business_id = $1 AND role = 'owner' AND is_active AND id <> $2 LIMIT 1`, [businessId, exceptId]);
  if (!res.rowCount) throw new AppError('CONFLICT', 'Tiene que quedar al menos un dueño activo.');
}

export async function updateStaff(actor: Actor, staffId: string, input: { name: string; role: string; locationId: string | null; isActive: boolean }) {
  requirePermission(actor, 'staff.manage');
  const name = requireText(input.name, 'Nombre', 2, 120);
  const role = checkAssignable(actor, input.role);
  if (staffId === actor.id && (role !== actor.role || !input.isActive)) throw new AppError('INVALID', 'No puedes cambiar tu propio rol ni desactivarte.');
  await transaction(async (db) => {
    const target = await lockTarget(db, actor, staffId);
    await checkLocation(db, actor.businessId, input.locationId);
    if (target.role === 'owner' && target.isActive && (role !== 'owner' || !input.isActive)) await ensureAnotherOwner(db, actor.businessId, staffId);
    // Cambiar rol, sede o desactivar cierra sus sesiones abiertas (session_epoch).
    const sensitive = role !== target.role || input.locationId !== target.locationId || input.isActive !== target.isActive;
    await db.query(
      `UPDATE staff SET name = $2, role = $3, location_id = $4, is_active = $5,
              session_epoch = session_epoch + $6, failed_pins = CASE WHEN $5 THEN failed_pins ELSE 0 END
        WHERE id = $1`,
      [staffId, name, role, input.locationId, input.isActive, sensitive ? 1 : 0],
    );
    const changes = [
      name !== target.name ? `nombre a ${name}` : null,
      role !== target.role ? `rol de ${target.role} a ${role}` : null,
      input.locationId !== target.locationId ? 'sede' : null,
      input.isActive !== target.isActive ? (input.isActive ? 'lo activó' : 'lo desactivó') : null,
    ].filter(Boolean);
    await audit(db, actor, {
      action: 'staff.update',
      entity: 'staff',
      entityId: staffId,
      summary: `Cambió a ${target.name} (${target.code}): ${changes.join(', ') || 'sin cambios'}`,
      data: { before: target, after: { name, role, locationId: input.locationId, isActive: input.isActive } },
    });
  });
}

export async function resetPin(actor: Actor, staffId: string, pin: string) {
  requirePermission(actor, 'staff.manage');
  validatePin(pin);
  const pinHash = await hashPassword(pin);
  await transaction(async (db) => {
    const target = await lockTarget(db, actor, staffId);
    await db.query(`UPDATE staff SET pin_hash = $2, failed_pins = 0, locked_until = NULL, session_epoch = session_epoch + 1 WHERE id = $1`, [
      staffId,
      pinHash,
    ]);
    await audit(db, actor, { action: 'staff.pin_reset', entity: 'staff', entityId: staffId, summary: `Cambió el PIN de ${target.name} (${target.code})` });
  });
}

// ───────── ingreso del equipo ─────────

const MAX_FAILED_PINS = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { kind: 'ok'; staffId: string; locationId: string; epoch: number; role: Role }
  | { kind: 'choose-location'; locations: { id: string; name: string }[] };

/** Revisa código + PIN. Con 5 PIN equivocados seguidos, la persona queda bloqueada 15 minutos. */
export async function loginStaff(input: { slug: string; code: string; pin: string; locationId?: string | null; ip?: string }): Promise<LoginResult> {
  const wrong = new AppError('INVALID', 'Código o PIN incorrectos.');
  const business = await getBusinessBySlug(input.slug);
  if (!business) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
  if (!business.isActive) throw new AppError('FORBIDDEN', 'Este negocio está suspendido. Escríbele a 3R.');
  const code = input.code.trim();
  if (!/^\d{1,12}$/.test(code) || !/^\d{4,6}$/.test(input.pin)) throw wrong;

  const member = (
    await query<{ id: string; name: string; role: Role; pinHash: string; locationId: string | null; isActive: boolean; lockedUntil: Date | null; epoch: number }>(
      `SELECT id, name, role, pin_hash AS "pinHash", location_id AS "locationId", is_active AS "isActive",
              locked_until AS "lockedUntil", session_epoch AS epoch
         FROM staff WHERE business_id = $1 AND code = $2`,
      [business.id, code],
    )
  )[0];
  if (!member || !member.isActive) throw wrong;
  if (member.lockedUntil && member.lockedUntil > new Date()) {
    const minutes = Math.ceil((member.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError('LOCKED', `Demasiados intentos. Prueba otra vez en ${minutes} min o pide a tu administrador que cambie tu PIN.`);
  }

  if (!(await verifyPassword(input.pin, member.pinHash))) {
    await transaction(async (db) => {
      const res = await db.query<{ failed: number }>(
        `UPDATE staff SET failed_pins = failed_pins + 1,
                locked_until = CASE WHEN failed_pins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
          WHERE id = $1 RETURNING failed_pins AS failed`,
        [member.id, MAX_FAILED_PINS, LOCK_MINUTES],
      );
      const locked = res.rows[0].failed >= MAX_FAILED_PINS;
      await audit(db, { businessId: business.id, locationId: member.locationId ?? '', id: member.id, name: member.name }, {
        action: locked ? 'auth.locked' : 'auth.failed',
        entity: 'staff',
        entityId: member.id,
        summary: locked ? `${member.name} quedó bloqueado ${LOCK_MINUTES} min por PIN equivocados` : `PIN equivocado de ${member.name}`,
        ip: input.ip,
      });
    });
    throw wrong;
  }

  const locations = await listLocations(business.id, { activeOnly: true });
  let locationId: string;
  if (member.locationId) {
    if (!locations.some((l) => l.id === member.locationId)) throw new AppError('FORBIDDEN', 'Tu sede está desactivada. Habla con el dueño.');
    locationId = member.locationId;
  } else if (input.locationId && locations.some((l) => l.id === input.locationId)) {
    locationId = input.locationId;
  } else if (locations.length === 1) {
    locationId = locations[0].id;
  } else if (locations.length === 0) {
    throw new AppError('FORBIDDEN', 'El negocio no tiene sedes activas.');
  } else {
    return { kind: 'choose-location', locations: locations.map(({ id, name }) => ({ id, name })) };
  }

  await transaction(async (db) => {
    await db.query(`UPDATE staff SET failed_pins = 0, locked_until = NULL WHERE id = $1`, [member.id]);
    await audit(db, { businessId: business.id, locationId, id: member.id, name: member.name }, {
      action: 'auth.login',
      entity: 'staff',
      entityId: member.id,
      summary: `${member.name} entró`,
      ip: input.ip,
    });
  });
  return { kind: 'ok', staffId: member.id, locationId, epoch: member.epoch, role: member.role };
}

export type StaffSession = Actor & {
  code: string;
  businessName: string;
  businessSlug: string;
  timezone: string;
  locationName: string;
  locationCount: number;
};

/** La sesión vigente de alguien del equipo, o null si lo desactivaron, le cambiaron el PIN o el rol, o la sede ya no está. */
export async function getStaffSession(staffId: string, locationId: string, epoch: number): Promise<StaffSession | null> {
  if (!isUuid(staffId) || !isUuid(locationId)) return null;
  const row = (
    await query<StaffSession & { epoch: number; homeLocation: string | null }>(
      `SELECT s.id, s.name, s.code, s.role, s.business_id AS "businessId", l.id AS "locationId", s.session_epoch AS epoch,
              s.location_id AS "homeLocation", b.name AS "businessName", b.slug AS "businessSlug", b.timezone, l.name AS "locationName",
              (SELECT count(*)::int FROM locations x WHERE x.business_id = b.id AND x.is_active) AS "locationCount"
         FROM staff s
         JOIN businesses b ON b.id = s.business_id AND b.is_active
         JOIN locations l ON l.id = $2 AND l.business_id = s.business_id AND l.is_active
        WHERE s.id = $1 AND s.is_active`,
      [staffId, locationId],
    )
  )[0];
  if (!row || row.epoch !== epoch) return null;
  if (row.homeLocation && row.homeLocation !== locationId) return null;
  const { epoch: _epoch, homeLocation: _home, ...session } = row;
  return session;
}

export async function logStaffLogout(actor: Actor) {
  await transaction((db) => audit(db, actor, { action: 'auth.logout', entity: 'staff', entityId: actor.id, summary: `${actor.name} salió` }));
}

// ───────── plano de mesas ─────────

export const CANVAS = { width: 1000, height: 640 } as const;
export const SHAPES = ['square', 'round', 'long'] as const;
export type Shape = (typeof SHAPES)[number];

export type TableStatus = 'free' | 'open' | 'bill' | 'blocked' | 'reserved';

export type FloorTable = {
  id: string;
  zone: string;
  number: string;
  capacity: number;
  shape: Shape;
  x: number;
  y: number;
  w: number;
  h: number;
  isBlocked: boolean;
  status: TableStatus;
  session: { id: string; guests: number; notes: string | null; openedAt: Date; billAt: Date | null; openedBy: string } | null;
};

export async function listTables(actor: Actor): Promise<FloorTable[]> {
  requirePermission(actor, 'tables.view');
  const rows = await query<Omit<FloorTable, 'status' | 'session'> & {
    sessionId: string | null;
    guests: number | null;
    notes: string | null;
    openedAt: Date | null;
    billAt: Date | null;
    openedBy: string | null;
    sessionStatus: string | null;
  }>(
    `SELECT t.id, t.zone, t.number, t.capacity, t.shape, t.x, t.y, t.w, t.h, t.is_blocked AS "isBlocked",
            ts.id AS "sessionId", ts.guests, ts.notes, ts.opened_at AS "openedAt", ts.bill_at AS "billAt",
            ts.status AS "sessionStatus", s.name AS "openedBy"
       FROM dining_tables t
       LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.status <> 'closed'
       LEFT JOIN staff s ON s.id = ts.opened_by
      WHERE t.location_id = $1 AND t.business_id = $2 AND t.is_active
      ORDER BY t.zone, length(t.number), t.number`,
    [actor.locationId, actor.businessId],
  );
  return rows.map(({ sessionId, guests, notes, openedAt, billAt, openedBy, sessionStatus, ...table }) => ({
    ...table,
    status: sessionId ? (sessionStatus === 'bill' ? 'bill' : 'open') : table.isBlocked ? 'blocked' : 'free',
    session: sessionId ? { id: sessionId, guests: guests!, notes, openedAt: openedAt!, billAt, openedBy: openedBy ?? '' } : null,
  }));
}

const SIZE: Record<Shape, { w: number; h: number }> = { square: { w: 110, h: 110 }, round: { w: 110, h: 110 }, long: { w: 200, h: 100 } };

function readTableInput(input: { zone: string; number: string; capacity: number; shape: string }) {
  const zone = requireText(input.zone || 'Salón', 'Zona', 2, 40);
  const number = requireText(input.number, 'Número de mesa', 1, 12);
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 40) throw new AppError('INVALID', 'Puestos: de 1 a 40.');
  if (!(SHAPES as readonly string[]).includes(input.shape)) throw new AppError('INVALID', 'Elige una forma.');
  return { zone, number, capacity: input.capacity, shape: input.shape as Shape };
}

/** Primer hueco libre del lienzo (de izquierda a derecha y de arriba abajo) donde cabe una mesa nueva. */
export function freeSpot(taken: { x: number; y: number; w: number; h: number }[], size: { w: number; h: number }) {
  const gap = 20;
  for (let y = gap; y + size.h <= CANVAS.height; y += 20) {
    for (let x = gap; x + size.w <= CANVAS.width; x += 20) {
      const hits = taken.some((t) => x < t.x + t.w + gap && x + size.w + gap > t.x && y < t.y + t.h + gap && y + size.h + gap > t.y);
      if (!hits) return { x, y };
    }
  }
  return { x: gap, y: gap };
}

async function lockTable(db: Db, actor: Actor, tableId: string) {
  if (!isUuid(tableId)) throw new AppError('NOT_FOUND', 'No encontramos esa mesa.');
  const table = (
    await db.query<{ id: string; number: string; zone: string; capacity: number; shape: Shape; isBlocked: boolean; isActive: boolean }>(
      `SELECT id, number, zone, capacity, shape, is_blocked AS "isBlocked", is_active AS "isActive"
         FROM dining_tables WHERE id = $1 AND location_id = $2 AND business_id = $3 FOR UPDATE`,
      [tableId, actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!table || !table.isActive) throw new AppError('NOT_FOUND', 'No encontramos esa mesa en tu sede.');
  return table;
}

const duplicateNumber = (error: unknown) => (error as { code?: string }).code === '23505';

export async function createTable(actor: Actor, input: { zone: string; number: string; capacity: number; shape: string }) {
  requirePermission(actor, 'floor.edit');
  const data = readTableInput(input);
  return transaction(async (db) => {
    const zoneTables = (
      await db.query<{ x: number; y: number; w: number; h: number }>(
        `SELECT x, y, w, h FROM dining_tables WHERE location_id = $1 AND zone = $2 AND is_active`,
        [actor.locationId, data.zone],
      )
    ).rows;
    const size = SIZE[data.shape];
    const spot = freeSpot(zoneTables, size);
    // Una mesa desactivada con el mismo número se reactiva (no se puede borrar: su historial la usa).
    const res = await db.query<{ id: string }>(
      `INSERT INTO dining_tables (business_id, location_id, zone, number, capacity, shape, x, y, w, h)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (location_id, number) DO UPDATE
         SET zone = EXCLUDED.zone, capacity = EXCLUDED.capacity, shape = EXCLUDED.shape, x = EXCLUDED.x, y = EXCLUDED.y,
             w = EXCLUDED.w, h = EXCLUDED.h, is_active = TRUE, is_blocked = FALSE
         WHERE dining_tables.is_active = FALSE
       RETURNING id`,
      [actor.businessId, actor.locationId, data.zone, data.number, data.capacity, data.shape, spot.x, spot.y, size.w, size.h],
    );
    if (!res.rows[0]) throw new AppError('CONFLICT', `Ya hay una mesa ${data.number} en esta sede.`);
    await audit(db, actor, {
      action: 'table.create',
      entity: 'table',
      entityId: res.rows[0].id,
      summary: `Agregó la mesa ${data.number} (${data.capacity} puestos) en ${data.zone}`,
    });
    return res.rows[0].id;
  });
}

export async function updateTable(actor: Actor, tableId: string, input: { zone: string; number: string; capacity: number; shape: string; isBlocked: boolean }) {
  requirePermission(actor, 'floor.edit');
  const data = readTableInput(input);
  await transaction(async (db) => {
    const before = await lockTable(db, actor, tableId);
    const size = data.shape !== before.shape ? SIZE[data.shape] : null;
    try {
      await db.query(
        `UPDATE dining_tables SET zone = $2, number = $3, capacity = $4, shape = $5, is_blocked = $6,
                w = COALESCE($7, w), h = COALESCE($8, h) WHERE id = $1`,
        [tableId, data.zone, data.number, data.capacity, data.shape, input.isBlocked, size?.w ?? null, size?.h ?? null],
      );
    } catch (error) {
      if (duplicateNumber(error)) throw new AppError('CONFLICT', `Ya hay una mesa ${data.number} en esta sede.`);
      throw error;
    }
    const blockedChange = before.isBlocked !== input.isBlocked ? (input.isBlocked ? ' (la bloqueó)' : ' (la desbloqueó)') : '';
    await audit(db, actor, {
      action: 'table.update',
      entity: 'table',
      entityId: tableId,
      summary: `Cambió la mesa ${before.number}${before.number !== data.number ? ` → ${data.number}` : ''}${blockedChange}`,
      data: { before, after: { ...data, isBlocked: input.isBlocked } },
    });
  });
}

/** Guarda las posiciones del plano. Solo mesas de la sede de quien guarda; las medidas se ajustan al lienzo. */
export async function saveLayout(actor: Actor, positions: { id: string; x: number; y: number; w: number; h: number }[]) {
  requirePermission(actor, 'floor.edit');
  if (!Array.isArray(positions) || positions.length === 0 || positions.length > 300) throw new AppError('INVALID', 'No hay cambios para guardar.');
  const fit = (n: unknown, min: number, max: number) => Math.round(Math.min(Math.max(Number(n) || 0, min), max));
  await transaction(async (db) => {
    let moved = 0;
    for (const p of positions) {
      if (!isUuid(p.id)) continue;
      const w = fit(p.w, 60, 400);
      const h = fit(p.h, 60, 400);
      const res = await db.query(
        `UPDATE dining_tables SET x = $4, y = $5, w = $6, h = $7 WHERE id = $1 AND location_id = $2 AND business_id = $3 AND is_active`,
        [p.id, actor.locationId, actor.businessId, fit(p.x, 0, CANVAS.width - w), fit(p.y, 0, CANVAS.height - h), w, h],
      );
      moved += res.rowCount ?? 0;
    }
    if (moved === 0) throw new AppError('NOT_FOUND', 'Esas mesas no son de tu sede.');
    await audit(db, actor, { action: 'floor.layout', entity: 'location', entityId: actor.locationId, summary: `Reacomodó el plano (${moved} mesas)` });
  });
}

/** Quita una mesa del plano. No se borra: su historial queda. */
export async function removeTable(actor: Actor, tableId: string) {
  requirePermission(actor, 'floor.edit');
  await transaction(async (db) => {
    const table = await lockTable(db, actor, tableId);
    const open = await db.query(`SELECT 1 FROM table_sessions WHERE table_id = $1 AND status <> 'closed'`, [tableId]);
    if (open.rowCount) throw new AppError('CONFLICT', `La mesa ${table.number} está abierta. Ciérrala primero.`);
    await db.query(`UPDATE dining_tables SET is_active = FALSE WHERE id = $1`, [tableId]);
    await audit(db, actor, { action: 'table.remove', entity: 'table', entityId: tableId, summary: `Quitó la mesa ${table.number} del plano` });
  });
}

// ───────── abrir, mover y cerrar mesas ─────────

export async function openTable(actor: Actor, tableId: string, input: { guests: number; notes?: string }) {
  requirePermission(actor, 'tables.open');
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 60) throw new AppError('INVALID', 'Personas: de 1 a 60.');
  const notes = input.notes ? requireText(input.notes, 'Nota', 1, 300) : null;
  try {
    return await transaction(async (db) => {
      const table = await lockTable(db, actor, tableId);
      if (table.isBlocked) throw new AppError('CONFLICT', `La mesa ${table.number} está bloqueada.`);
      const res = await db.query<{ id: string }>(
        `INSERT INTO table_sessions (business_id, location_id, table_id, guests, notes, opened_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [actor.businessId, actor.locationId, tableId, input.guests, notes, actor.id],
      );
      await audit(db, actor, {
        action: 'table.open',
        entity: 'table_session',
        entityId: res.rows[0].id,
        summary: `Abrió la mesa ${table.number} para ${input.guests} ${input.guests === 1 ? 'persona' : 'personas'}`,
        data: { tableId, guests: input.guests },
      });
      return res.rows[0].id;
    });
  } catch (error) {
    if (duplicateNumber(error)) throw new AppError('CONFLICT', 'Alguien acaba de abrir esa mesa.');
    throw error;
  }
}

async function lockSession(db: Db, actor: Actor, sessionId: string) {
  if (!isUuid(sessionId)) throw new AppError('NOT_FOUND', 'Esa mesa ya no está abierta.');
  const session = (
    await db.query<{ id: string; tableId: string; status: string; number: string; guests: number; openedAt: Date }>(
      `SELECT ts.id, ts.table_id AS "tableId", ts.status, t.number, ts.guests, ts.opened_at AS "openedAt"
         FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
        WHERE ts.id = $1 AND ts.location_id = $2 AND ts.business_id = $3 FOR UPDATE OF ts`,
      [sessionId, actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!session || session.status === 'closed') throw new AppError('NOT_FOUND', 'Esa mesa ya no está abierta.');
  return session;
}

export async function updateSession(actor: Actor, sessionId: string, input: { guests: number; notes?: string }) {
  requirePermission(actor, 'tables.open');
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > 60) throw new AppError('INVALID', 'Personas: de 1 a 60.');
  const notes = input.notes ? requireText(input.notes, 'Nota', 1, 300) : null;
  await transaction(async (db) => {
    const session = await lockSession(db, actor, sessionId);
    await db.query(`UPDATE table_sessions SET guests = $2, notes = $3 WHERE id = $1`, [sessionId, input.guests, notes]);
    if (session.guests !== input.guests) {
      await audit(db, actor, {
        action: 'table.guests',
        entity: 'table_session',
        entityId: sessionId,
        summary: `Mesa ${session.number}: de ${session.guests} a ${input.guests} personas`,
      });
    }
  });
}

/** Pedir la cuenta (la mesa queda "por cobrar") o volver a dejarla abierta. */
export async function setBill(actor: Actor, sessionId: string, wantsBill: boolean) {
  requirePermission(actor, 'tables.bill');
  await transaction(async (db) => {
    const session = await lockSession(db, actor, sessionId);
    if ((session.status === 'bill') === wantsBill) return;
    await db.query(`UPDATE table_sessions SET status = $2::varchar, bill_at = CASE WHEN $2::varchar = 'bill' THEN now() ELSE NULL END WHERE id = $1`, [
      sessionId,
      wantsBill ? 'bill' : 'open',
    ]);
    await audit(db, actor, {
      action: wantsBill ? 'table.bill' : 'table.reopen',
      entity: 'table_session',
      entityId: sessionId,
      summary: wantsBill ? `Pidió la cuenta de la mesa ${session.number}` : `Volvió a abrir la mesa ${session.number}`,
    });
  });
}

/** Pasa la cuenta abierta a otra mesa libre de la misma sede (el cronómetro sigue). */
export async function moveSession(actor: Actor, sessionId: string, toTableId: string) {
  requirePermission(actor, 'tables.open');
  try {
    await transaction(async (db) => {
      const session = await lockSession(db, actor, sessionId);
      const target = await lockTable(db, actor, toTableId);
      if (target.id === session.tableId) return;
      if (target.isBlocked) throw new AppError('CONFLICT', `La mesa ${target.number} está bloqueada.`);
      await db.query(`UPDATE table_sessions SET table_id = $2 WHERE id = $1`, [sessionId, target.id]);
      await audit(db, actor, {
        action: 'table.move',
        entity: 'table_session',
        entityId: sessionId,
        summary: `Pasó la mesa ${session.number} a la mesa ${target.number}`,
        data: { from: session.tableId, to: target.id },
      });
    });
  } catch (error) {
    if (duplicateNumber(error)) throw new AppError('CONFLICT', 'Esa mesa ya está ocupada.');
    throw error;
  }
}

/** Cierra la mesa. Cerrarla antes de pedir la cuenta exige un motivo (queda en la auditoría). */
export async function closeTable(actor: Actor, sessionId: string, reason?: string) {
  requirePermission(actor, 'tables.close');
  const why = reason?.trim() ? requireText(reason, 'Motivo', 3, 300) : null;
  await transaction(async (db) => {
    const session = await lockSession(db, actor, sessionId);
    // Con saldo por pagar solo se cierra cobrando. Con saldo cero (cortesía del 100 %) sí se puede cerrar aquí.
    const balance = (
      await db.query<{ balance: string }>(
        `SELECT (SELECT COALESCE(sum(unit_price * quantity), 0) FROM order_items WHERE session_id = $1 AND voided_at IS NULL)
              - (SELECT COALESCE(sum(amount), 0) FROM session_discounts WHERE session_id = $1 AND voided_at IS NULL)
              - (SELECT COALESCE(sum(amount), 0) FROM payments WHERE session_id = $1 AND reversed_at IS NULL) AS balance`,
        [sessionId],
      )
    ).rows[0];
    if (Number(balance.balance) > 0) throw new AppError('CONFLICT', `La mesa ${session.number} tiene saldo por pagar: se cierra cobrando en Caja.`);
    if (session.status !== 'bill' && !why) throw new AppError('INVALID', 'La mesa no ha pedido la cuenta: escribe el motivo para cerrarla.');
    await db.query(`UPDATE table_sessions SET status = 'closed', closed_at = now(), closed_by = $2 WHERE id = $1`, [sessionId, actor.id]);
    const minutes = Math.round((Date.now() - new Date(session.openedAt).getTime()) / 60_000);
    await audit(db, actor, {
      action: 'table.close',
      entity: 'table_session',
      entityId: sessionId,
      summary: `Cerró la mesa ${session.number} después de ${minutes} min`,
      reason: why,
    });
  });
}
