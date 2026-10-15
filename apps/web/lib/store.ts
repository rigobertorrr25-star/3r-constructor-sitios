// Tienda online: tipos y textos visibles.

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'on_way' | 'delivered' | 'cancelled';
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Nuevo',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  on_way: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
/** Lo que le dice al cliente cada estado. */
export const STATUS_TEXT: Record<OrderStatus, string> = {
  new: 'Recibimos tu pedido. En un momento lo confirmamos.',
  confirmed: 'Tu pedido está confirmado.',
  preparing: 'Estamos preparando tu pedido.',
  ready: 'Tu pedido está listo.',
  on_way: 'Tu pedido va en camino.',
  delivered: 'Tu pedido fue entregado. ¡Gracias por tu compra!',
  cancelled: 'Este pedido fue cancelado.',
};
/** Colores de la etiqueta de estado en el panel. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  new: 'bg-primary text-primary-foreground',
  confirmed: 'bg-primary/15 text-foreground',
  preparing: 'bg-[#ffd27a]/15 text-[#ffd27a]',
  ready: 'bg-[#5ee0a0]/15 text-[#9df0c6]',
  on_way: 'bg-[#5ee0a0]/15 text-[#9df0c6]',
  delivered: 'border border-white/[0.1] text-muted-foreground',
  cancelled: 'border border-white/[0.1] text-muted-foreground line-through',
};
export const OPEN_STATUSES: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'on_way'];

export type StoreSettings = {
  slug: string;
  name: string;
  tagline: string | null;
  whatsapp: string | null;
  open: boolean;
  pickupEnabled: boolean;
  pickupNote: string | null;
  deliveryEnabled: boolean;
  deliveryFee: number;
  freeFrom: number | null;
  deliveryNote: string | null;
  paymentNote: string | null;
  updatedAt: string;
};
export type SettingsResponse = { canEdit: boolean; settings: StoreSettings | null; suggestedSlug: string };

export type Variant = { id: string; name: string; price: number | null; stock: number | null; active: boolean };
export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAt: number | null;
  imageUrl: string | null;
  category: string | null;
  trackStock: boolean;
  stock: number | null;
  active: boolean;
  featured: boolean;
  updatedAt: string;
  variants: Variant[];
};

export type Coupon = {
  id: string;
  code: string;
  percent: number | null;
  amount: number | null;
  minOrder: number | null;
  maxUses: number | null;
  used: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

export type OrderLine = {
  productId: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  qty: number;
  unit: number;
  line: number;
};
export type Order = {
  id: string;
  number: number;
  publicToken: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  delivery: 'pickup' | 'delivery';
  address: string | null;
  notes: string | null;
  items: OrderLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  status: OrderStatus;
  paid: boolean;
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
  slug?: string | null;
};
export type OrderList = { orders: Order[]; counts: Partial<Record<OrderStatus, number>> };
export type StoreSummary = { newOrders: number; inProgress: number };

// ───── lo público ─────
export type PublicStore = {
  slug: string;
  name: string;
  tagline: string | null;
  whatsapp: string | null;
  open: boolean;
  pickupEnabled: boolean;
  pickupNote: string | null;
  deliveryEnabled: boolean;
  deliveryFee: number;
  freeFrom: number | null;
  deliveryNote: string | null;
  paymentNote: string | null;
};
export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAt: number | null;
  imageUrl: string | null;
  category: string | null;
  featured: boolean;
  available: boolean;
  variants: { id: string; name: string; price: number; available: boolean }[];
};
export type Catalog = { store: PublicStore; products: PublicProduct[] };
export type CartItem = { productId: string; variantId: string | null; qty: number };
export type Quote = { lines: OrderLine[]; subtotal: number; discount: number; shipping: number; total: number; coupon: string | null };
export type PublicOrder = Omit<Order, 'id' | 'staffNote' | 'slug'> & { store: PublicStore };

/** 45000 → "$ 45.000". */
export const cop = (pesos: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(pesos);

/** Celular colombiano para wa.me: 3001234567 → 573001234567. */
export const waNumber = (raw: string | null | undefined) => {
  const d = (raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d;
};
export const waLink = (number: string | null, text: string) => (number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null);

/** El mensaje de WhatsApp con el resumen del pedido. */
export function orderMessage(o: Pick<Order, 'number' | 'items' | 'total' | 'delivery' | 'address' | 'customerName'>, storeName: string, url: string) {
  const lines = o.items.map((l) => `• ${l.qty} × ${l.name}${l.variant ? ` (${l.variant})` : ''}: ${cop(l.line)}`);
  return [
    `Hola, soy ${o.customerName}. Acabo de hacer el pedido #${o.number} en ${storeName}:`,
    ...lines,
    `Total: ${cop(o.total)}`,
    o.delivery === 'delivery' ? `Domicilio a: ${o.address}` : 'Lo recojo en el local',
    `Ver el pedido: ${url}`,
  ].join('\n');
}
