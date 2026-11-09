// Cuenta de lo que deja cada pago en la caja (aparte para que la usen caja, finanzas y tablero sin importarse entre sí).
/**
 * Lo que deja cada pago en la caja de pesos. Con `flag` (contar con la propina adentro, 9 nov 2026) la propina en efectivo
 * sigue en la caja al contar y la de datáfono/transferencia todavía no ha salido; sin él (cajas de antes) toda la propina
 * ya se entregó. Los pagos con dólares dejan dólares: su valor en pesos se resta.
 */
/** La venta de un pago, sin propina: si la propina venía incluida en lo cobrado (9 nov 2026), se resta. */
export const netAmountSql = (a = '') => `(${a}amount - CASE WHEN ${a}tip_included THEN ${a}tip ELSE 0 END)`;

export const payInDrawerSql = (flag: string) =>
  `CASE WHEN method = 'cash' THEN ${netAmountSql()} - COALESCE(usd_received::bigint * usd_rate, 0) + CASE WHEN ${flag} THEN tip ELSE 0 END ELSE CASE WHEN ${flag} THEN 0 ELSE -tip END END`;
