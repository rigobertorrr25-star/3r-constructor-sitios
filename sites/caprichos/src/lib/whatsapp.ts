import { Product } from '@/data/products';
import { formatCOP } from '@/lib/format';

export const WHATSAPP_NUMBER = '573015499953';

export interface OrderLine {
  product: Product;
  quantity: number;
}

export function buildOrderMessage(items: OrderLine[]): string {
  const lines = items.map(
    (i) => `• ${i.quantity}x ${i.product.name} — ${formatCOP(i.product.price * i.quantity)}`
  );
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return [
    '¡Hola Caprichos! 💕 Quiero hacer este pedido:',
    '',
    ...lines,
    '',
    `Total: ${formatCOP(total)}`,
    '',
    'Mi nombre es: ',
    'Mi dirección/lugar de entrega es: ',
  ].join('\n');
}

export function whatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function orderWhatsAppUrl(items: OrderLine[]): string {
  return whatsAppUrl(buildOrderMessage(items));
}

export function greetingWhatsAppUrl(text = 'Hola Caprichos, quiero conocer más sobre sus productos 💕'): string {
  return whatsAppUrl(text);
}
