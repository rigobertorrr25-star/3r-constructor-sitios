import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto } from './dto/order.dto.js';
import { CLIENT_CANCELLABLE, MAX_OPEN_ORDERS_PER_USER, STATUS_LABELS, orderCode, type OrderStatus } from './orders.constants.js';

const orderSummary = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  priceCents: true,
  monthlyPriceCents: true,
  currency: true,
  amountPaidCents: true,
  deliveryUrl: true,
  createdAt: true,
  updatedAt: true,
  package: { select: { name: true, slug: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async create(userId: string, dto: CreateOrderDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, emailVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('Cuenta no encontrada');
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verifica tu correo antes de pedir tu página. Revisa tu bandeja de entrada o pide que te reenviemos el enlace.',
      });
    }

    const pkg = await this.prisma.package.findFirst({ where: { slug: dto.packageSlug, isActive: true } });
    if (!pkg) throw new BadRequestException('Ese paquete no está disponible');

    const open = await this.prisma.order.count({
      where: { userId, status: { in: ['new', 'awaiting_payment', 'in_progress', 'in_review'] } },
    });
    if (open >= MAX_OPEN_ORDERS_PER_USER) {
      throw new ConflictException(`Ya tienes ${MAX_OPEN_ORDERS_PER_USER} pedidos en curso. Espera a que avancen para pedir otro.`);
    }

    const maintenance = !!dto.maintenance && pkg.monthlyPriceCents !== null;
    const order = await this.prisma.order.create({
      data: {
        userId,
        packageId: pkg.id,
        status: 'new',
        priceCents: pkg.priceCents,
        monthlyPriceCents: maintenance ? pkg.monthlyPriceCents : null,
        currency: pkg.currency,
        brief: JSON.parse(JSON.stringify(dto.brief)) as Prisma.InputJsonValue,
        events: {
          create: {
            actorId: userId,
            kind: 'status',
            body: STATUS_LABELS.new,
            metadata: { to: 'new' },
          },
        },
      },
      select: orderSummary,
    });

    await this.audit.log({
      action: 'ORDER_CREATED',
      userId,
      entityType: 'order',
      entityId: order.id,
      metadata: { package: pkg.slug, maintenance },
      ipAddress: ip,
    });
    await this.email.sendAdminNewOrder({
      orderId: order.id,
      orderCode: orderCode(order.orderNumber),
      businessName: dto.brief.businessName,
      packageName: pkg.name,
      clientEmail: user.email,
      priceCents: order.priceCents,
      currency: order.currency,
    });
    return order;
  }

  listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: orderSummary,
    });
  }

  async getMine(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        ...orderSummary,
        brief: true,
        deliveredAt: true,
        events: {
          where: { visibleToClient: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, kind: true, body: true, metadata: true, actorId: true, createdAt: true },
        },
        // El sitio es del administrador (quien lo construye), no del cliente — por eso no se
        // filtra por site.userId aquí: el dueño ya quedó verificado por el "where" de arriba.
        site: {
          select: {
            formSubmissions: {
              orderBy: { createdAt: 'desc' },
              select: { id: true, name: true, email: true, phone: true, message: true, createdAt: true },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    // No se expone quién escribió, solo si fue el cliente o el equipo.
    const { events, site, ...rest } = order;
    return {
      ...rest,
      events: events.map(({ actorId, ...event }) => ({ ...event, fromTeam: actorId !== userId })),
      formSubmissions: site?.formSubmissions ?? [],
    };
  }

  async addMessage(userId: string, orderId: string, body: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, orderNumber: true, brief: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === 'cancelled') throw new ConflictException('Este pedido está cancelado');

    const trimmed = body.trim();
    const event = await this.prisma.orderEvent.create({
      data: { orderId, actorId: userId, kind: 'message', body: trimmed, visibleToClient: true },
      select: { id: true, kind: true, body: true, createdAt: true },
    });
    const businessName = String((order.brief as { businessName?: string } | null)?.businessName ?? orderCode(order.orderNumber));
    await this.email.sendAdminNewMessage({ orderId, orderCode: orderCode(order.orderNumber), businessName, body: trimmed });
    return event;
  }

  async cancel(userId: string, orderId: string, ip?: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true, paymentStatus: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!CLIENT_CANCELLABLE.includes(order.status as OrderStatus) || order.paymentStatus !== 'unpaid') {
      throw new ConflictException('Este pedido ya está en marcha. Escríbenos por mensaje para cancelarlo.');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        events: {
          create: { actorId: userId, kind: 'status', body: STATUS_LABELS.cancelled, metadata: { from: order.status, to: 'cancelled' } },
        },
      },
      select: orderSummary,
    });
    await this.audit.log({ action: 'ORDER_CANCELLED', userId, entityType: 'order', entityId: orderId, ipAddress: ip });
    return updated;
  }
}
