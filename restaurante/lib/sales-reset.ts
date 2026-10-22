import { transaction } from './db';
import { AppError, isUuid } from './store';

/** Lo que se registra al vender: se borra junto con las ventas de prueba. */
const SALES_ACTIONS = [
  'table.open',
  'table.close',
  'table.move',
  'table.guests',
  'order.send',
  'order.void',
  'ticket.undo',
  'payment.create',
  'payment.reverse',
  'discount.apply',
  'discount.void',
  'cash.open',
  'cash.close',
  'waiter.close',
  'waiter.verify',
  'invoice.customer',
  'invoice.credit_note',
  'print.reprint',
];

export type SalesReset = { sessions: number; payments: number; collected: number; shifts: number };

/**
 * Borra las ventas de prueba de un negocio para que empiece a vender de cero (solo el equipo de 3R, desde /admin).
 * Se van: mesas abiertas y cerradas con sus pedidos, comandas, descuentos, pagos, facturas, turnos de caja y cierres
 * de meseros, y lo que esas ventas descontaron del inventario (la existencia vuelve a lo cargado).
 * Se quedan: equipo y PIN, sedes, plano, carta, inventario con sus compras y conteos, gastos, clientes y reservas.
 */
export async function clearSales(businessId: string, confirmName: string): Promise<SalesReset> {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
  return transaction(async (db) => {
    const business = (await db.query<{ name: string }>(`SELECT name FROM businesses WHERE id = $1 FOR UPDATE`, [businessId])).rows[0];
    if (!business) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
    if (confirmName.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
      throw new AppError('INVALID', `Para confirmar, escribe el nombre del negocio tal cual: ${business.name}`);
    }
    // Lo protegido contra borrado (movimientos de inventario y auditoría) solo se deja borrar con esta marca.
    await db.query(`SET LOCAL app.purge = 'on'`);

    const totals = (
      await db.query<{ sessions: number; payments: number; collected: string; shifts: number }>(
        `SELECT (SELECT count(*)::int FROM table_sessions WHERE business_id = $1) AS sessions,
                (SELECT count(*)::int FROM payments WHERE business_id = $1 AND reversed_at IS NULL) AS payments,
                (SELECT COALESCE(sum(amount), 0) FROM payments WHERE business_id = $1 AND reversed_at IS NULL) AS collected,
                (SELECT count(*)::int FROM cash_shifts WHERE business_id = $1) AS shifts`,
        [businessId],
      )
    ).rows[0];

    await db.query(`DELETE FROM inventory_movements WHERE business_id = $1 AND kind IN ('sale', 'void')`, [businessId]);
    await db.query(`DELETE FROM print_jobs WHERE business_id = $1`, [businessId]);
    await db.query(`DELETE FROM invoices WHERE business_id = $1 AND session_id IS NOT NULL`, [businessId]);
    // Mesas: arrastran rondas, comandas, lo pedido, descuentos y pagos.
    await db.query(`DELETE FROM table_sessions WHERE business_id = $1`, [businessId]);
    // Un gasto pagado con la plata de la caja se queda; solo pierde el enlace a la salida de caja que se borra.
    await db.query(
      `UPDATE expenses SET cash_movement_id = NULL
        WHERE business_id = $1 AND cash_movement_id IN (SELECT id FROM cash_movements WHERE business_id = $1)`,
      [businessId],
    );
    await db.query(`DELETE FROM cash_shifts WHERE business_id = $1`, [businessId]);
    // Los resúmenes del día hablaban de esas ventas.
    await db.query(`DELETE FROM daily_briefs WHERE business_id = $1`, [businessId]);
    await db.query(`DELETE FROM audit_events WHERE business_id = $1 AND action = ANY($2::text[])`, [businessId, SALES_ACTIONS]);

    const result = { sessions: totals.sessions, payments: totals.payments, collected: Number(totals.collected), shifts: totals.shifts };
    await db.query(
      `INSERT INTO audit_events (business_id, actor_name, action, entity, entity_id, summary, data)
       VALUES ($1, '3R (administración)', 'business.clear_sales', 'business', $1, $2, $3)`,
      [
        businessId,
        `3R borró las ventas de prueba: ${result.sessions} mesas, ${result.payments} pagos y ${result.shifts} turnos de caja`,
        JSON.stringify(result),
      ],
    );
    return result;
  });
}

export type MenuReset = { categories: number; products: number };

/**
 * Borra toda la carta de un negocio (categorías, productos, recetas y fotos) para volver a cargarla (solo 3R, desde /admin).
 * Si hay pedidos que nombran esos productos no se borra nada: primero hay que borrar las ventas de prueba.
 * Se quedan: inventario (sus insumos y existencias), equipo, plano, gastos y reservas.
 */
export async function clearMenu(businessId: string, confirmName: string): Promise<MenuReset> {
  if (!isUuid(businessId)) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
  return transaction(async (db) => {
    const business = (await db.query<{ name: string }>(`SELECT name FROM businesses WHERE id = $1 FOR UPDATE`, [businessId])).rows[0];
    if (!business) throw new AppError('NOT_FOUND', 'No encontramos ese negocio.');
    if (confirmName.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
      throw new AppError('INVALID', `Para confirmar, escribe el nombre del negocio tal cual: ${business.name}`);
    }
    const sold = await db.query(`SELECT 1 FROM order_items WHERE business_id = $1 LIMIT 1`, [businessId]);
    if (sold.rowCount) throw new AppError('CONFLICT', 'Este negocio tiene pedidos con productos de la carta. Primero toca «Borrar ventas de prueba».');
    const totals = (
      await db.query<{ categories: number; products: number }>(
        `SELECT (SELECT count(*)::int FROM menu_categories WHERE business_id = $1) AS categories,
                (SELECT count(*)::int FROM menu_products WHERE business_id = $1) AS products`,
        [businessId],
      )
    ).rows[0];
    // Las categorías arrastran sus productos, y los productos sus recetas y fotos.
    await db.query(`DELETE FROM menu_categories WHERE business_id = $1`, [businessId]);
    await db.query(
      `INSERT INTO audit_events (business_id, actor_name, action, entity, entity_id, summary, data)
       VALUES ($1, '3R (administración)', 'business.clear_menu', 'business', $1, $2, $3)`,
      [businessId, `3R borró la carta: ${totals.categories} categorías y ${totals.products} productos`, JSON.stringify(totals)],
    );
    return totals;
  });
}
