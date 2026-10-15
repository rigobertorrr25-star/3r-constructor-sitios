export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'ready', 'on_way', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const DELIVERY = ['pickup', 'delivery'] as const;
export const MAX_LINES = 50;
export const MAX_QTY = 99;
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;
/** Clave del módulo en el catálogo de la plataforma. */
export const STORE_MODULE = 'store';
