// Módulo 02: la carta (categorías y productos) y los pedidos de cada mesa.
// Un "Enviar" crea una ronda y la parte en una comanda por estación (cocina y barra) para no mezclar la operación.
import { query, transaction, type Db } from './db';
import { consumeForRound, returnForVoid } from './inventory';
import { AppError, audit, isUuid, requirePermission, type Actor } from './store';
import { enqueueRound, enqueueVoid } from './printing';

import { STATIONS, isStation, type Station } from './stations';

export { STATIONS, STATION_LABEL, isStation, type Station } from './stations';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

function requireText(value: string, label: string, min: number, max: number) {
  const text = clean(value);
  if (text.length < min || text.length > max) throw new AppError('INVALID', `${label}: entre ${min} y ${max} caracteres.`);
  return text;
}

/** Precio en pesos enteros (acepta "12.500" o "12500"). */
export function parsePrice(value: string | number) {
  const digits = typeof value === 'number' ? value : Number(String(value).replace(/[.\s$]/g, ''));
  if (!Number.isInteger(digits) || digits < 0 || digits > 100_000_000) throw new AppError('INVALID', 'Escribe el precio en pesos, sin centavos.');
  return digits;
}

const duplicate = (error: unknown) => (error as { code?: string }).code === '23505';

// ───────── carta ─────────

export type MenuCategory = { id: string; name: string; station: Station; sort: number; isActive: boolean };
export type MenuProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  station: Station;
  isAvailable: boolean;
  isActive: boolean;
  sort: number;
  /** Versión de la foto del producto (para armar su dirección), o null si no tiene. */
  photo: number | null;
};

/** La carta completa. Para tomar pedidos, `activeOnly` deja solo lo que está en la carta. */
export async function getMenu(businessId: string, { activeOnly = false } = {}) {
  const [categories, products] = await Promise.all([
    query<MenuCategory>(
      `SELECT id, name, station, sort, is_active AS "isActive" FROM menu_categories
        WHERE business_id = $1 ${activeOnly ? 'AND is_active' : ''} ORDER BY sort, name`,
      [businessId],
    ),
    query<MenuProduct & { price: string }>(
      `SELECT p.id, p.category_id AS "categoryId", p.name, p.description, p.price, p.station, p.is_available AS "isAvailable",
              p.is_active AS "isActive", p.sort, (extract(epoch FROM f.updated_at) * 1000)::bigint::float8 AS photo
         FROM menu_products p JOIN menu_categories c ON c.id = p.category_id
         LEFT JOIN product_photos f ON f.product_id = p.id
        WHERE p.business_id = $1 ${activeOnly ? 'AND p.is_active AND c.is_active' : ''} ORDER BY p.sort, p.name`,
      [businessId],
    ),
  ]);
  return { categories, products: products.map((p) => ({ ...p, price: Number(p.price) })) };
}

export async function saveCategory(actor: Actor, input: { id?: string | null; name: string; station: string; sort?: number; isActive?: boolean }) {
  requirePermission(actor, 'menu.edit');
  const name = requireText(input.name, 'Nombre de la categoría', 2, 60);
  if (!isStation(input.station)) throw new AppError('INVALID', 'Elige si va a cocina o a barra.');
  const sort = Number.isInteger(input.sort) ? input.sort! : 0;
  return transaction(async (db) => {
    try {
      if (input.id) {
        if (!isUuid(input.id)) throw new AppError('NOT_FOUND', 'No encontramos esa categoría.');
        const res = await db.query(
          `UPDATE menu_categories SET name = $3, station = $4, sort = $5, is_active = $6 WHERE id = $1 AND business_id = $2`,
          [input.id, actor.businessId, name, input.station, sort, input.isActive ?? true],
        );
        if (!res.rowCount) throw new AppError('NOT_FOUND', 'No encontramos esa categoría.');
        await audit(db, actor, { action: 'menu.category', entity: 'menu_category', entityId: input.id, summary: `Cambió la categoría ${name}` });
        return input.id;
      }
      const res = await db.query<{ id: string }>(
        `INSERT INTO menu_categories (business_id, name, station, sort)
         VALUES ($1, $2, $3, COALESCE(NULLIF($4, 0), (SELECT COALESCE(max(sort), 0) + 10 FROM menu_categories WHERE business_id = $1)))
         RETURNING id`,
        [actor.businessId, name, input.station, sort],
      );
      await audit(db, actor, { action: 'menu.category', entity: 'menu_category', entityId: res.rows[0].id, summary: `Creó la categoría ${name}` });
      return res.rows[0].id;
    } catch (error) {
      if (duplicate(error)) throw new AppError('CONFLICT', `Ya hay una categoría ${name}.`);
      throw error;
    }
  });
}

export async function saveProduct(
  actor: Actor,
  input: { id?: string | null; categoryId: string; name: string; description?: string; price: string | number; station?: string; isActive?: boolean },
) {
  requirePermission(actor, 'menu.edit');
  const name = requireText(input.name, 'Nombre del producto', 2, 80);
  const description = input.description?.trim() ? requireText(input.description, 'Descripción', 2, 200) : null;
  const price = parsePrice(input.price);
  if (!isUuid(input.categoryId)) throw new AppError('INVALID', 'Elige una categoría.');
  return transaction(async (db) => {
    const category = (
      await db.query<{ station: Station; name: string }>(`SELECT station, name FROM menu_categories WHERE id = $1 AND business_id = $2`, [
        input.categoryId,
        actor.businessId,
      ])
    ).rows[0];
    if (!category) throw new AppError('INVALID', 'Elige una categoría.');
    // Sin estación propia, el producto va a la de su categoría.
    const station = input.station && isStation(input.station) ? input.station : category.station;
    if (input.id) {
      if (!isUuid(input.id)) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
      const before = (
        await db.query<{ name: string; price: string; isActive: boolean }>(
          `SELECT name, price, is_active AS "isActive" FROM menu_products WHERE id = $1 AND business_id = $2 FOR UPDATE`,
          [input.id, actor.businessId],
        )
      ).rows[0];
      if (!before) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
      await db.query(
        `UPDATE menu_products SET category_id = $3, name = $4, description = $5, price = $6, station = $7, is_active = $8 WHERE id = $1 AND business_id = $2`,
        [input.id, actor.businessId, input.categoryId, name, description, price, station, input.isActive ?? true],
      );
      const oldPrice = Number(before.price);
      // Los cambios de precio quedan siempre en la auditoría.
      await audit(db, actor, {
        action: oldPrice !== price ? 'menu.price' : 'menu.product',
        entity: 'menu_product',
        entityId: input.id,
        summary:
          oldPrice !== price
            ? `Cambió el precio de ${name}: de $${oldPrice.toLocaleString('es-CO')} a $${price.toLocaleString('es-CO')}`
            : `Cambió el producto ${name}${before.isActive !== (input.isActive ?? true) ? ((input.isActive ?? true) ? ' (lo volvió a la carta)' : ' (lo quitó de la carta)') : ''}`,
        data: { before: { name: before.name, price: oldPrice, isActive: before.isActive }, after: { name, price, isActive: input.isActive ?? true } },
      });
      return input.id;
    }
    const res = await db.query<{ id: string }>(
      `INSERT INTO menu_products (business_id, category_id, name, description, price, station, sort)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(max(sort), 0) + 10 FROM menu_products WHERE category_id = $2)) RETURNING id`,
      [actor.businessId, input.categoryId, name, description, price, station],
    );
    await audit(db, actor, {
      action: 'menu.product',
      entity: 'menu_product',
      entityId: res.rows[0].id,
      summary: `Agregó ${name} a ${category.name} por $${price.toLocaleString('es-CO')}`,
    });
    return res.rows[0].id;
  });
}

/** Agotado / disponible. Lo pueden marcar también meseros y cajeros: son los primeros en enterarse. */
export async function setProductAvailable(actor: Actor, productId: string, available: boolean) {
  requirePermission(actor, 'orders.take');
  if (!isUuid(productId)) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
  await transaction(async (db) => {
    const res = await db.query<{ name: string }>(
      `UPDATE menu_products SET is_available = $3 WHERE id = $1 AND business_id = $2 RETURNING name`,
      [productId, actor.businessId, available],
    );
    if (!res.rows[0]) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
    await audit(db, actor, {
      action: 'menu.available',
      entity: 'menu_product',
      entityId: productId,
      summary: available ? `Volvió a haber ${res.rows[0].name}` : `Marcó ${res.rows[0].name} como agotado`,
    });
  });
}

// ───────── pedidos ─────────

export type CartLine = { productId: string; quantity: number; notes?: string };

export type SessionInfo = { id: string; tableId: string; tableNumber: string; zone: string; status: string; guests: number; openedAt: Date; openedBy: string };

async function lockOpenSession(db: Db, actor: Actor, sessionId: string) {
  if (!isUuid(sessionId)) throw new AppError('NOT_FOUND', 'Esa mesa ya no está abierta.');
  const session = (
    await db.query<{ id: string; status: string; number: string }>(
      `SELECT ts.id, ts.status, t.number FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id
        WHERE ts.id = $1 AND ts.location_id = $2 AND ts.business_id = $3 FOR UPDATE OF ts`,
      [sessionId, actor.locationId, actor.businessId],
    )
  ).rows[0];
  if (!session || session.status === 'closed') throw new AppError('NOT_FOUND', 'Esa mesa ya no está abierta.');
  return session;
}

/**
 * Envía el carrito: crea la ronda, una comanda por estación y los ítems con nombre y precio copiados de la carta.
 * Si llega otra vez el mismo `clientKey` (doble toque, reintento), devuelve la ronda que ya existe sin duplicar nada.
 */
export async function sendOrder(actor: Actor, sessionId: string, lines: CartLine[], clientKey: string) {
  requirePermission(actor, 'orders.take');
  if (!isUuid(clientKey)) throw new AppError('INVALID', 'Pedido sin identificador. Recarga la página.');
  if (!Array.isArray(lines) || lines.length === 0) throw new AppError('INVALID', 'El pedido está vacío.');
  if (lines.length > 80) throw new AppError('INVALID', 'Demasiados productos en un solo envío.');
  const clean = lines.map((l) => {
    if (!isUuid(l.productId)) throw new AppError('INVALID', 'Hay un producto que no existe.');
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99) throw new AppError('INVALID', 'Cantidad: de 1 a 99.');
    const notes = l.notes?.replace(/\s+/g, ' ').trim().slice(0, 140) || null;
    return { productId: l.productId, quantity: l.quantity, notes };
  });

  const existing = await query<{ id: string; number: number }>(`SELECT id, number FROM order_rounds WHERE business_id = $1 AND client_key = $2`, [
    actor.businessId,
    clientKey,
  ]);
  if (existing[0]) return { roundId: existing[0].id, number: existing[0].number, duplicate: true };

  try {
    return await transaction(async (db) => {
      const session = await lockOpenSession(db, actor, sessionId);
      const ids = [...new Set(clean.map((l) => l.productId))];
      const products = (
        await db.query<{ id: string; name: string; price: string; station: Station; isAvailable: boolean }>(
          `SELECT p.id, p.name, p.price, p.station, p.is_available AS "isAvailable"
             FROM menu_products p JOIN menu_categories c ON c.id = p.category_id
            WHERE p.id = ANY($1::uuid[]) AND p.business_id = $2 AND p.is_active AND c.is_active`,
          [ids, actor.businessId],
        )
      ).rows;
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const id of ids) {
        const product = byId.get(id);
        if (!product) throw new AppError('CONFLICT', 'Un producto del pedido ya no está en la carta. Recarga la página.');
        if (!product.isAvailable) throw new AppError('CONFLICT', `${product.name} está agotado. Quítalo del pedido.`);
      }
      const number =
        (await db.query<{ n: number }>(`SELECT COALESCE(max(number), 0) + 1 AS n FROM order_rounds WHERE session_id = $1`, [sessionId])).rows[0].n;
      const round = (
        await db.query<{ id: string }>(
          `INSERT INTO order_rounds (business_id, location_id, session_id, number, client_key, sent_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [actor.businessId, actor.locationId, sessionId, number, clientKey, actor.id],
        )
      ).rows[0];
      const tickets = new Map<Station, string>();
      for (const station of STATIONS) {
        if (!clean.some((l) => byId.get(l.productId)!.station === station)) continue;
        const ticket = (
          await db.query<{ id: string }>(
            `INSERT INTO station_tickets (business_id, location_id, round_id, station) VALUES ($1, $2, $3, $4) RETURNING id`,
            [actor.businessId, actor.locationId, round.id, station],
          )
        ).rows[0];
        tickets.set(station, ticket.id);
      }
      let total = 0;
      for (const line of clean) {
        const product = byId.get(line.productId)!;
        const price = Number(product.price);
        total += price * line.quantity;
        await db.query(
          `INSERT INTO order_items (business_id, session_id, round_id, ticket_id, product_id, name, unit_price, quantity, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [actor.businessId, sessionId, round.id, tickets.get(product.station), product.id, product.name, price, line.quantity, line.notes],
        );
      }
      // Cada venta descuenta del inventario lo que diga la receta de cada producto.
      await consumeForRound(db, actor, round.id);
      // Comanda impresa para cada estación que tenga impresora (si la sede no tiene, se ve solo en pantalla).
      await enqueueRound(db, actor, round.id);
      // Pedir más con la cuenta pedida la vuelve a dejar abierta.
      if (session.status === 'bill') await db.query(`UPDATE table_sessions SET status = 'open', bill_at = NULL WHERE id = $1`, [sessionId]);
      const count = clean.reduce((n, l) => n + l.quantity, 0);
      await audit(db, actor, {
        action: 'order.send',
        entity: 'order_round',
        entityId: round.id,
        summary: `Envió la ronda ${number} de la mesa ${session.number}: ${count} ${count === 1 ? 'producto' : 'productos'} por $${total.toLocaleString('es-CO')}`,
        data: { sessionId, stations: [...tickets.keys()] },
      });
      return { roundId: round.id, number, duplicate: false };
    });
  } catch (error) {
    // Dos envíos del mismo carrito al mismo tiempo: el segundo choca con client_key y devuelve el primero.
    if (duplicate(error)) {
      const again = await query<{ id: string; number: number }>(`SELECT id, number FROM order_rounds WHERE business_id = $1 AND client_key = $2`, [
        actor.businessId,
        clientKey,
      ]);
      if (again[0]) return { roundId: again[0].id, number: again[0].number, duplicate: true };
    }
    throw error;
  }
}

/** Anula un producto ya enviado (no lo borra). Solo dueño o administrador, siempre con motivo. */
export async function voidItem(actor: Actor, itemId: string, reason: string) {
  requirePermission(actor, 'orders.void');
  const why = requireText(reason, 'Motivo', 3, 300);
  if (!isUuid(itemId)) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
  await transaction(async (db) => {
    const item = (
      await db.query<{ id: string; sessionId: string; name: string; quantity: number; unitPrice: string; voidedAt: Date | null; ticketStatus: string }>(
        `SELECT i.id, i.session_id AS "sessionId", i.name, i.quantity, i.unit_price AS "unitPrice", i.voided_at AS "voidedAt", st.status AS "ticketStatus"
           FROM order_items i JOIN station_tickets st ON st.id = i.ticket_id
          WHERE i.id = $1 AND i.business_id = $2 AND st.location_id = $3 FOR UPDATE OF i`,
        [itemId, actor.businessId, actor.locationId],
      )
    ).rows[0];
    if (!item) throw new AppError('NOT_FOUND', 'No encontramos ese producto.');
    if (item.voidedAt) throw new AppError('CONFLICT', 'Ese producto ya estaba anulado.');
    const session = await lockOpenSession(db, actor, item.sessionId);
    await db.query(`UPDATE order_items SET voided_at = now(), voided_by = $2, void_reason = $3 WHERE id = $1`, [itemId, actor.id, why]);
    // Si la cocina no lo había empezado, los insumos vuelven al inventario; si ya lo preparó, se quedan gastados.
    if (item.ticketStatus === 'sent') await returnForVoid(db, actor, itemId);
    // La estación recibe un papel de «ANULADO» para no prepararlo (o dejarlo de lado).
    await enqueueVoid(db, actor, itemId, why);
    const amount = Number(item.unitPrice) * item.quantity;
    await audit(db, actor, {
      action: 'order.void',
      entity: 'order_item',
      entityId: itemId,
      summary: `Anuló ${item.quantity} × ${item.name} ($${amount.toLocaleString('es-CO')}) de la mesa ${session.number}${item.ticketStatus === 'sent' ? '' : ' (ya estaba en preparación o lista)'}`,
      reason: why,
      data: { sessionId: item.sessionId, amount, ticketStatus: item.ticketStatus },
    });
  });
}

export type OrderItemView = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes: string | null;
  station: Station;
  ticketStatus: string;
  voidedAt: Date | null;
  voidReason: string | null;
};
export type RoundView = { id: string; number: number; sentAt: Date; sentBy: string; items: OrderItemView[] };

/** La cuenta de una mesa abierta: sus rondas, lo que se pidió y el total (sin lo anulado). */
export async function getSessionOrder(actor: Actor, sessionId: string) {
  requirePermission(actor, 'orders.take');
  if (!isUuid(sessionId)) return null;
  const session = (
    await query<SessionInfo>(
      `SELECT ts.id, ts.table_id AS "tableId", t.number AS "tableNumber", t.zone, ts.status, ts.guests, ts.opened_at AS "openedAt", s.name AS "openedBy"
         FROM table_sessions ts JOIN dining_tables t ON t.id = ts.table_id JOIN staff s ON s.id = ts.opened_by
        WHERE ts.id = $1 AND ts.location_id = $2 AND ts.business_id = $3`,
      [sessionId, actor.locationId, actor.businessId],
    )
  )[0];
  if (!session) return null;
  const rows = await query<OrderItemView & { roundId: string; number: number; sentAt: Date; sentBy: string; unitPrice: string }>(
    `SELECT i.id, i.name, i.unit_price AS "unitPrice", i.quantity, i.notes, st.station, st.status AS "ticketStatus",
            i.voided_at AS "voidedAt", i.void_reason AS "voidReason",
            r.id AS "roundId", r.number, r.sent_at AS "sentAt", s.name AS "sentBy"
       FROM order_items i
       JOIN order_rounds r ON r.id = i.round_id
       JOIN station_tickets st ON st.id = i.ticket_id
       JOIN staff s ON s.id = r.sent_by
      WHERE i.session_id = $1 AND i.business_id = $2
      ORDER BY r.number, st.station, i.name`,
    [sessionId, actor.businessId],
  );
  const rounds: RoundView[] = [];
  for (const row of rows) {
    let round = rounds.find((r) => r.id === row.roundId);
    if (!round) rounds.push((round = { id: row.roundId, number: row.number, sentAt: row.sentAt, sentBy: row.sentBy, items: [] }));
    const { roundId: _r, number: _n, sentAt: _s, sentBy: _b, ...item } = row;
    round.items.push({ ...item, unitPrice: Number(item.unitPrice) });
  }
  const total = rows.filter((r) => !r.voidedAt).reduce((sum, r) => sum + Number(r.unitPrice) * r.quantity, 0);
  return { session, rounds, total };
}

/** Total consumido (sin anulados) de varias cuentas a la vez, para el plano de mesas. */
export async function sessionTotals(businessId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, number>();
  const rows = await query<{ sessionId: string; total: string }>(
    `SELECT session_id AS "sessionId", COALESCE(sum(unit_price * quantity), 0) AS total
       FROM order_items WHERE business_id = $1 AND session_id = ANY($2::uuid[]) AND voided_at IS NULL GROUP BY session_id`,
    [businessId, sessionIds],
  );
  return new Map(rows.map((r) => [r.sessionId, Number(r.total)]));
}
