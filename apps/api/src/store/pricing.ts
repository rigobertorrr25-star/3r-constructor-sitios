import { BadRequestException } from '@nestjs/common';
import { MAX_LINES, MAX_QTY } from './store.constants.js';

export type PricedProduct = {
  id: string;
  name: string;
  priceCents: bigint;
  trackStock: boolean;
  stock: number | null;
  variants: { id: string; name: string; priceCents: bigint | null; stock: number | null }[];
};
export type CartLine = { productId: string; variantId?: string | null; qty: number };
export type Coupon = {
  code: string;
  percent: number | null;
  amountCents: bigint | null;
  minOrderCents: bigint | null;
  maxUses: number | null;
  used: number;
  expiresAt: Date | null;
  active: boolean;
};
export type Shipping = { pickupEnabled: boolean; deliveryEnabled: boolean; deliveryFeeCents: bigint; freeFromCents: bigint | null };

export type PricedLine = {
  productId: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  unitCents: bigint;
  qty: number;
  lineCents: bigint;
  /** De dónde se descuenta: 'product' | 'variant' | null (sin existencias). */
  stockFrom: 'product' | 'variant' | null;
};

const today = (now: Date) => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now)}T00:00:00Z`);
const pesos = (c: bigint) => `$${new Intl.NumberFormat('es-CO').format(Number(c / 100n))}`;

/** Revisa el carrito contra el catálogo y calcula los precios (nunca se confía en los del navegador). */
export function priceLines(products: Map<string, PricedProduct>, cart: CartLine[]): PricedLine[] {
  if (!cart.length) throw new BadRequestException('El carrito está vacío');
  if (cart.length > MAX_LINES) throw new BadRequestException(`Máximo ${MAX_LINES} productos distintos por pedido`);
  const merged = new Map<string, CartLine>();
  for (const l of cart) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) throw new BadRequestException(`La cantidad va de 1 a ${MAX_QTY}`);
    const key = `${l.productId}:${l.variantId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { ...l, qty: (prev?.qty ?? 0) + l.qty });
  }
  return [...merged.values()].map((l) => {
    const p = products.get(l.productId);
    if (!p) throw new BadRequestException('Uno de los productos ya no está disponible. Revisa tu carrito.');
    if (l.qty > MAX_QTY) throw new BadRequestException(`La cantidad va de 1 a ${MAX_QTY}`);
    let variant: PricedProduct['variants'][number] | null = null;
    if (p.variants.length) {
      variant = p.variants.find((v) => v.id === l.variantId) ?? null;
      if (!variant) throw new BadRequestException(`Elige una opción de «${p.name}»`);
    } else if (l.variantId) throw new BadRequestException(`«${p.name}» no tiene opciones`);
    const available = p.trackStock ? (variant ? (variant.stock ?? 0) : (p.stock ?? 0)) : Infinity;
    const label = variant ? `${p.name} (${variant.name})` : p.name;
    if (available <= 0) throw new BadRequestException(`Se agotó ${label}`);
    if (l.qty > available) throw new BadRequestException(`De ${label} solo quedan ${available}`);
    const unitCents = variant?.priceCents ?? p.priceCents;
    return {
      productId: p.id,
      variantId: variant?.id ?? null,
      name: p.name,
      variant: variant?.name ?? null,
      unitCents,
      qty: l.qty,
      lineCents: unitCents * BigInt(l.qty),
      stockFrom: p.trackStock ? (variant ? 'variant' : 'product') : null,
    };
  });
}

/** Lo que descuenta un cupón sobre el subtotal (redondeado al peso). Lanza el motivo si no aplica. */
export function couponDiscount(c: Coupon | null, subtotalCents: bigint, now = new Date()): bigint {
  if (!c || !c.active) throw new BadRequestException('Ese cupón no existe o ya no está activo');
  if (c.expiresAt && c.expiresAt < today(now)) throw new BadRequestException('Ese cupón ya venció');
  if (c.maxUses != null && c.used >= c.maxUses) throw new BadRequestException('Ese cupón ya se agotó');
  if (c.minOrderCents != null && subtotalCents < c.minOrderCents)
    throw new BadRequestException(`Ese cupón aplica en compras desde ${pesos(c.minOrderCents)}`);
  const raw = c.percent != null ? (subtotalCents * BigInt(c.percent)) / 100n : (c.amountCents ?? 0n);
  const rounded = (raw / 100n) * 100n;
  return rounded > subtotalCents ? subtotalCents : rounded;
}

export function shippingCents(s: Shipping, delivery: string, afterDiscountCents: bigint): bigint {
  if (delivery === 'pickup') {
    if (!s.pickupEnabled) throw new BadRequestException('Esta tienda no tiene recogida en el local');
    return 0n;
  }
  if (!s.deliveryEnabled) throw new BadRequestException('Esta tienda no hace domicilios');
  if (s.freeFromCents != null && afterDiscountCents >= s.freeFromCents) return 0n;
  return s.deliveryFeeCents;
}

export function totals(lines: PricedLine[], coupon: Coupon | null | undefined, shipping: Shipping, delivery: string, now = new Date()) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0n);
  const discountCents = coupon === undefined ? 0n : couponDiscount(coupon, subtotalCents, now);
  const ship = shippingCents(shipping, delivery, subtotalCents - discountCents);
  return { subtotalCents, discountCents, shippingCents: ship, totalCents: subtotalCents - discountCents + ship };
}
