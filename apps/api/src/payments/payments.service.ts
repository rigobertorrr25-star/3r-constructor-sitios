import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { orderCode } from '../orders/orders.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WompiConfig } from './wompi.config.js';

/** Lo que Wompi dice de una transacción (en el aviso de pago y en su API). */
export interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
}

// Estados de Wompi → estados del pago en 3R.
const STATUS: Record<string, string> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  VOIDED: 'voided',
  ERROR: 'error',
  PENDING: 'pending',
};

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const cop = (cents: number, currency: string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);

/** Busca "transaction.amount_in_cents" dentro del objeto `data` del aviso de Wompi. */
const pick = (data: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), data);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly wompi: WompiConfig,
  ) {}

  /** Firma de integridad del botón de pago: sin ella, Wompi no acepta el cobro y nadie puede cambiar el monto. */
  integritySignature(reference: string, amountInCents: number, currency: string) {
    return sha256(`${reference}${amountInCents}${currency}${this.wompi.integritySecret}`);
  }

  /** Crea un intento de pago por lo que falta del pedido y devuelve la dirección del pago de Wompi. */
  async createCheckout(userId: string, orderId: string) {
    if (!this.wompi.enabled) throw new ServiceUnavailableException('El pago en línea todavía no está disponible');
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, orderNumber: true, status: true, paymentStatus: true, priceCents: true, amountPaidCents: true, currency: true, user: { select: { email: true } } },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === 'cancelled' || order.paymentStatus === 'refunded') throw new BadRequestException('Este pedido no tiene pagos pendientes');
    const amount = order.priceCents - order.amountPaidCents;
    if (amount <= 0) throw new BadRequestException('Este pedido ya está pagado');

    const reference = `${orderCode(order.orderNumber)}-${randomBytes(4).toString('hex')}`;
    await this.prisma.payment.create({ data: { orderId, reference, amountCents: amount, currency: order.currency } });

    const params = new URLSearchParams({
      'public-key': this.wompi.publicKey,
      currency: order.currency,
      'amount-in-cents': String(amount),
      reference,
      'signature:integrity': this.integritySignature(reference, amount, order.currency),
      'redirect-url': `${this.wompi.webOrigin}/dashboard/pedidos/${orderId}?pago=wompi`,
      'customer-data:email': order.user.email,
    });
    return { url: `${this.wompi.checkoutUrl}?${params.toString()}`, reference, amountCents: amount, currency: order.currency };
  }

  /** Aviso de Wompi (webhook). Se verifica la firma antes de creerle nada. */
  async handleEvent(body: Record<string, unknown>, headerChecksum?: string) {
    if (!this.wompi.eventsSecret) throw new ServiceUnavailableException('Avisos de Wompi sin configurar');
    const signature = body.signature as { properties?: unknown; checksum?: unknown } | undefined;
    const properties = Array.isArray(signature?.properties) ? signature.properties.filter((p): p is string => typeof p === 'string') : [];
    const checksum = String(signature?.checksum ?? headerChecksum ?? '').toLowerCase();
    if (properties.length === 0 || !checksum) throw new UnauthorizedException('Aviso sin firma');

    const values = properties.map((path) => String(pick(body.data, path) ?? '')).join('');
    const expected = sha256(`${values}${String(body.timestamp ?? '')}${this.wompi.eventsSecret}`);
    const a = Buffer.from(expected);
    const b = Buffer.from(checksum);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Firma inválida');

    if (body.event !== 'transaction.updated') return { ok: true };
    const transaction = pick(body.data, 'transaction') as WompiTransaction | undefined;
    if (!transaction?.reference) return { ok: true };
    await this.applyTransaction(transaction);
    return { ok: true };
  }

  /** Al volver de Wompi: se consulta la transacción directamente (por si el aviso tarda). */
  async confirm(userId: string, orderId: string, transactionId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!/^[A-Za-z0-9-]{1,100}$/.test(transactionId)) throw new BadRequestException('Transacción inválida');

    let transaction: WompiTransaction;
    try {
      const res = await fetch(`${this.wompi.apiUrl}/transactions/${encodeURIComponent(transactionId)}`);
      if (res.status === 404) throw new NotFoundException('Wompi no encontró esa transacción');
      if (!res.ok) throw new Error(`Wompi respondió ${res.status}`);
      transaction = ((await res.json()) as { data: WompiTransaction }).data;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.warn(`No se pudo consultar la transacción ${transactionId}: ${(err as Error).message}`);
      throw new BadGatewayException('No pudimos consultar el pago con Wompi. Si ya pagaste, se verá reflejado en unos minutos.');
    }

    const payment = await this.prisma.payment.findUnique({ where: { reference: transaction.reference }, select: { orderId: true } });
    if (!payment || payment.orderId !== orderId) throw new NotFoundException('Ese pago no es de este pedido');
    const status = await this.applyTransaction(transaction);
    return { status };
  }

  /**
   * Aplica lo que dice Wompi a un intento de pago. Idempotente: si llegan el aviso y la confirmación
   * (o el mismo aviso dos veces), el dinero se suma al pedido una sola vez.
   */
  async applyTransaction(transaction: WompiTransaction): Promise<string | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { reference: transaction.reference },
      select: { id: true, orderId: true, amountCents: true, currency: true, status: true },
    });
    if (!payment) {
      this.logger.warn(`Aviso de Wompi con referencia desconocida: ${transaction.reference}`);
      return null;
    }
    let status = STATUS[transaction.status] ?? 'error';
    // Un pago aprobado por otro monto u otra moneda no se da por bueno: lo revisa una persona.
    if (status === 'approved' && (transaction.amount_in_cents !== payment.amountCents || transaction.currency !== payment.currency)) {
      this.logger.error(`Pago ${transaction.reference}: Wompi aprobó ${transaction.amount_in_cents} ${transaction.currency}, se esperaba ${payment.amountCents} ${payment.currency}`);
      status = 'error';
    }
    if (payment.status === 'approved') return 'approved';

    const credited = await this.prisma.$transaction(async (tx) => {
      // Solo quien pase de "no aprobado" a "aprobado" suma el dinero: dos avisos a la vez no lo duplican.
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'approved' } },
        data: { status, providerTransactionId: transaction.id },
      });
      if (status !== 'approved' || changed.count === 0) return null;

      const order = await tx.order.update({
        where: { id: payment.orderId },
        data: { amountPaidCents: { increment: payment.amountCents } },
        select: { id: true, priceCents: true, amountPaidCents: true, orderNumber: true, userId: true, brief: true, currency: true },
      });
      const paymentStatus = order.amountPaidCents >= order.priceCents ? 'paid' : 'partial';
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus,
          events: {
            create: {
              kind: 'payment',
              body: `Pago recibido en línea: ${cop(payment.amountCents, payment.currency)}`,
              metadata: { provider: 'wompi', reference: transaction.reference, transactionId: transaction.id, paymentStatus, amountPaidCents: order.amountPaidCents },
            },
          },
        },
      });
      return order;
    });

    if (credited) {
      const client = await this.prisma.user.findUnique({ where: { id: credited.userId }, select: { email: true, firstName: true } });
      const code = orderCode(credited.orderNumber);
      const amount = cop(payment.amountCents, payment.currency);
      if (client) {
        await this.email.sendOrderUpdate(client.email, { firstName: client.firstName, orderId: credited.id, orderCode: code, lines: [`Recibimos tu pago de ${amount}. ¡Gracias!`] });
      }
      const businessName = String((credited.brief as { businessName?: unknown } | null)?.businessName ?? '');
      await this.email.sendAdminNewMessage({ orderId: credited.id, orderCode: code, businessName, body: `Pago en línea aprobado por Wompi: ${amount} (referencia ${transaction.reference}).` });
    }
    return status;
  }
}
