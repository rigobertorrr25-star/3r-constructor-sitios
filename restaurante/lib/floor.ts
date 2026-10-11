// Barras del plano: el dueño las pone donde están en el local para que el plano se parezca al sitio real.
// Solo se dibujan (con sus sillas altas); no se abren ni se cobran como las mesas.
import { query, transaction } from './db';
import { AppError, CANVAS, audit, freeSpot, isUuid, requirePermission, type Actor } from './store';

export const SEAT_SIDES = ['bottom', 'top', 'left', 'right'] as const;
export type SeatSide = (typeof SEAT_SIDES)[number];

export type Fixture = { id: string; zone: string; label: string; seats: number; seatSide: SeatSide; x: number; y: number; w: number; h: number };

const fit = (n: unknown, min: number, max: number) => Math.round(Math.min(Math.max(Number(n) || 0, min), max));

function readFixtureInput(input: { zone?: string; label: string; seats: number; seatSide: string }) {
  const label = (input.label ?? '').trim() || 'Barra';
  if (label.length > 30) throw new AppError('INVALID', 'Nombre de la barra: hasta 30 letras.');
  const zone = (input.zone ?? '').trim() || 'Salón';
  if (zone.length < 2 || zone.length > 40) throw new AppError('INVALID', 'Zona: entre 2 y 40 letras.');
  if (!Number.isInteger(input.seats) || input.seats < 0 || input.seats > 30) throw new AppError('INVALID', 'Sillas de la barra: de 0 a 30.');
  if (!(SEAT_SIDES as readonly string[]).includes(input.seatSide)) throw new AppError('INVALID', 'Elige de qué lado van las sillas.');
  return { label, zone, seats: input.seats, seatSide: input.seatSide as SeatSide };
}

export async function listFixtures(actor: Actor): Promise<Fixture[]> {
  requirePermission(actor, 'tables.view');
  return query<Fixture>(
    `SELECT id, zone, label, seats, seat_side AS "seatSide", x, y, w, h FROM floor_fixtures
      WHERE location_id = $1 AND business_id = $2 ORDER BY created_at`,
    [actor.locationId, actor.businessId],
  );
}

/** Agrega una barra en el primer hueco libre de la zona. */
export async function createFixture(actor: Actor, input: { zone: string; label: string; seats: number; seatSide: string }) {
  requirePermission(actor, 'floor.edit');
  const data = readFixtureInput(input);
  return transaction(async (db) => {
    const taken = (
      await db.query<{ x: number; y: number; w: number; h: number }>(
        `SELECT x, y, w, h FROM dining_tables WHERE location_id = $1 AND zone = $2 AND is_active
         UNION ALL SELECT x, y, w, h FROM floor_fixtures WHERE location_id = $1 AND zone = $2`,
        [actor.locationId, data.zone],
      )
    ).rows;
    const size = data.seatSide === 'left' || data.seatSide === 'right' ? { w: 80, h: 320 } : { w: 420, h: 80 };
    const spot = freeSpot(taken, size);
    const id = (
      await db.query<{ id: string }>(
        `INSERT INTO floor_fixtures (business_id, location_id, zone, label, seats, seat_side, x, y, w, h)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [actor.businessId, actor.locationId, data.zone, data.label, data.seats, data.seatSide, spot.x, spot.y, size.w, size.h],
      )
    ).rows[0].id;
    await audit(db, actor, { action: 'floor.fixture', entity: 'fixture', entityId: id, summary: `Puso «${data.label}» en el plano (${data.seats} sillas)` });
    return id;
  });
}

export async function updateFixture(actor: Actor, id: string, input: { label: string; seats: number; seatSide: string }) {
  requirePermission(actor, 'floor.edit');
  if (!isUuid(id)) throw new AppError('NOT_FOUND', 'No encontramos esa barra.');
  const data = readFixtureInput(input);
  await transaction(async (db) => {
    const res = await db.query(`UPDATE floor_fixtures SET label = $4, seats = $5, seat_side = $6 WHERE id = $1 AND location_id = $2 AND business_id = $3`, [
      id,
      actor.locationId,
      actor.businessId,
      data.label,
      data.seats,
      data.seatSide,
    ]);
    if (!res.rowCount) throw new AppError('NOT_FOUND', 'No encontramos esa barra en tu sede.');
    await audit(db, actor, { action: 'floor.fixture', entity: 'fixture', entityId: id, summary: `Cambió «${data.label}» del plano (${data.seats} sillas)` });
  });
}

/** Quita una barra del plano (es solo dibujo: no tiene historial que guardar). */
export async function removeFixture(actor: Actor, id: string) {
  requirePermission(actor, 'floor.edit');
  if (!isUuid(id)) throw new AppError('NOT_FOUND', 'No encontramos esa barra.');
  await transaction(async (db) => {
    const row = (
      await db.query<{ label: string }>(`DELETE FROM floor_fixtures WHERE id = $1 AND location_id = $2 AND business_id = $3 RETURNING label`, [
        id,
        actor.locationId,
        actor.businessId,
      ])
    ).rows[0];
    if (!row) throw new AppError('NOT_FOUND', 'No encontramos esa barra en tu sede.');
    await audit(db, actor, { action: 'floor.fixture', entity: 'fixture', entityId: id, summary: `Quitó «${row.label}» del plano` });
  });
}

/** Guarda dónde quedaron las barras al arrastrarlas. Pueden ser largas: hasta todo el ancho del lienzo. */
export async function saveFixtureLayout(actor: Actor, positions: { id: string; x: number; y: number; w: number; h: number }[]) {
  requirePermission(actor, 'floor.edit');
  if (!Array.isArray(positions) || positions.length > 50) throw new AppError('INVALID', 'No hay cambios para guardar.');
  await transaction(async (db) => {
    for (const p of positions) {
      if (!isUuid(p.id)) continue;
      const w = fit(p.w, 40, CANVAS.width);
      const h = fit(p.h, 40, CANVAS.height);
      await db.query(`UPDATE floor_fixtures SET x = $4, y = $5, w = $6, h = $7 WHERE id = $1 AND location_id = $2 AND business_id = $3`, [
        p.id,
        actor.locationId,
        actor.businessId,
        fit(p.x, 0, CANVAS.width - w),
        fit(p.y, 0, CANVAS.height - h),
        w,
        h,
      ]);
    }
  });
}
