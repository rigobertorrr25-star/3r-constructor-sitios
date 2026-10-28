// Pérdidas del día que no son del inventario (formulario diario de Rigoberto, 28 oct 2026): se rompió un vaso, se dañó
// un plato, se botó algo que no estaba en el inventario. Se anotan con su valor estimado y salen en el informe del cierre
// junto con las mermas del inventario. Nada se borra: se anulan.
import { formatCop } from './format';
import { query, transaction } from './db';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';

export type Loss = { id: string; description: string; amount: number; createdBy: string; createdAt: Date; voided: boolean };

export async function addLoss(actor: Actor, input: { description: string; amount: number }) {
  requirePermission(actor, 'expenses.add');
  const description = String(input.description ?? '').replace(/\s+/g, ' ').trim();
  if (description.length < 3 || description.length > 200) throw new AppError('INVALID', '¿Qué se perdió?: entre 3 y 200 caracteres.');
  if (!Number.isInteger(input.amount) || input.amount < 0 || input.amount > 1_000_000_000) throw new AppError('INVALID', 'Valor estimado: escribe el valor en pesos.');
  return transaction(async (db) => {
    const id = (
      await db.query<{ id: string }>(`INSERT INTO losses (business_id, location_id, description, amount, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
        actor.businessId,
        actor.locationId,
        description,
        input.amount,
        actor.id,
      ])
    ).rows[0].id;
    await audit(db, actor, { action: 'loss.add', entity: 'loss', entityId: id, summary: `Anotó una pérdida de ${formatCop(input.amount)}: ${description}` });
    return id;
  });
}

export async function voidLoss(actor: Actor, lossId: string) {
  requirePermission(actor, 'expenses.add');
  if (!isUuid(lossId)) throw new AppError('NOT_FOUND', 'No encontramos esa pérdida.');
  await transaction(async (db) => {
    const l = (
      await db.query<{ description: string; amount: string }>(
        `UPDATE losses SET voided_at = now(), voided_by = $3 WHERE id = $1 AND business_id = $2 AND location_id = $4 AND voided_at IS NULL RETURNING description, amount`,
        [lossId, actor.businessId, actor.id, actor.locationId],
      )
    ).rows[0];
    if (!l) throw new AppError('NOT_FOUND', 'No encontramos esa pérdida.');
    await audit(db, actor, { action: 'loss.void', entity: 'loss', entityId: lossId, summary: `Anuló una pérdida de ${formatCop(Number(l.amount))}: ${l.description}` });
  });
}

/** Las pérdidas anotadas en la sede desde `from` (la apertura de la caja) hasta `to` (el cierre, o ahora). */
export async function listLosses(actor: Pick<Actor, 'businessId' | 'locationId'>, from: Date, to: Date | null): Promise<Loss[]> {
  const rows = await query<Omit<Loss, 'amount'> & { amount: string }>(
    `SELECT l.id, l.description, l.amount, s.name AS "createdBy", l.created_at AS "createdAt", (l.voided_at IS NOT NULL) AS voided
       FROM losses l JOIN staff s ON s.id = l.created_by
      WHERE l.business_id = $1 AND l.location_id = $2 AND l.created_at >= $3 AND l.created_at <= $4 ORDER BY l.created_at`,
    [actor.businessId, actor.locationId, from, to ?? new Date()],
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}
