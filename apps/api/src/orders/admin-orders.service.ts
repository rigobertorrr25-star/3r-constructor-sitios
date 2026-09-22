import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SitesService } from '../sites/sites.service.js';
import type { UpdateOrderDto } from './dto/order.dto.js';
import { ORDER_STATUSES, PAYMENT_LABELS, STATUS_LABELS, orderCode, type OrderStatus, type PaymentStatus } from './orders.constants.js';

const listSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  priceCents: true,
  monthlyPriceCents: true,
  currency: true,
  amountPaidCents: true,
  siteId: true,
  createdAt: true,
  updatedAt: true,
  brief: true,
  user: { select: { email: true, firstName: true } },
  package: { select: { name: true, slug: true } },
} as const;

const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;
const businessNameOf = (brief: unknown, fallback: string) =>
  String((brief as { businessName?: string } | null)?.businessName ?? fallback);

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sites: SitesService,
    private readonly email: EmailService,
  ) {}

  async list(filters: { status?: string; q?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (filters.status && (ORDER_STATUSES as readonly string[]).includes(filters.status)) where.status = filters.status;

    const q = filters.q?.trim().slice(0, 100);
    if (q) {
      const number = Number(q.replace(/^3r-?/i, ''));
      where.OR = [
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { brief: { path: ['businessName'], string_contains: q, mode: 'insensitive' } },
        ...(Number.isInteger(number) && number > 0 ? [{ orderNumber: number }] : []),
      ];
    }
    return this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, select: listSelect });
  }

  async stats() {
    const [byStatus, revenue] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({ _sum: { amountPaidCents: true } }),
    ]);
    const counts: Record<string, number> = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const row of byStatus) counts[row.status] = row._count._all;
    return { counts, collectedCents: revenue._sum.amountPaidCents ?? 0 };
  }

  async get(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ...listSelect,
        userId: true,
        deliveryUrl: true,
        deliveredAt: true,
        site: { select: { id: true, name: true } },
        events: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, kind: true, body: true, metadata: true, visibleToClient: true, actorId: true, createdAt: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const { events, userId: clientId, ...rest } = order;
    return { ...rest, events: events.map(({ actorId, ...event }) => ({ ...event, fromTeam: actorId !== clientId })) };
  }

  async update(adminId: string, orderId: string, dto: UpdateOrderDto, ip?: string) {
    const current = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!current) throw new NotFoundException('Pedido no encontrado');

    const data: Prisma.OrderUpdateInput = {};
    const events: Prisma.OrderEventCreateWithoutOrderInput[] = [];
    const actor = { connect: { id: adminId } };
    let becameDelivered = false;

    if (dto.deliveryUrl !== undefined) {
      data.deliveryUrl = dto.deliveryUrl === '' ? null : dto.deliveryUrl;
      if (dto.deliveryUrl && dto.deliveryUrl !== current.deliveryUrl) {
        events.push({ actor, kind: 'delivery', body: 'Tu página ya tiene enlace', metadata: { url: dto.deliveryUrl } });
      }
    }
    const deliveryUrl = dto.deliveryUrl === undefined ? current.deliveryUrl : dto.deliveryUrl || null;

    if (dto.status && dto.status !== current.status) {
      if (dto.status === 'delivered' && !deliveryUrl) {
        throw new BadRequestException('Para marcar como entregado, primero agrega el enlace de la página');
      }
      data.status = dto.status;
      if (dto.status === 'delivered') {
        data.deliveredAt = new Date();
        becameDelivered = true;
      }
      events.push({
        actor,
        kind: 'status',
        body: STATUS_LABELS[dto.status as OrderStatus],
        metadata: { from: current.status, to: dto.status },
      });
    }

    // Si solo se indica cuánto pagó, el estado de pago se deduce del monto.
    let paymentStatus = dto.paymentStatus;
    if (dto.amountPaidCents !== undefined) {
      data.amountPaidCents = dto.amountPaidCents;
      if (!paymentStatus && current.paymentStatus !== 'refunded') {
        paymentStatus = dto.amountPaidCents <= 0 ? 'unpaid' : dto.amountPaidCents >= current.priceCents ? 'paid' : 'partial';
      }
    }
    const amountChanged = dto.amountPaidCents !== undefined && dto.amountPaidCents !== current.amountPaidCents;
    if ((paymentStatus && paymentStatus !== current.paymentStatus) || amountChanged) {
      if (paymentStatus) data.paymentStatus = paymentStatus;
      const shownStatus = (paymentStatus ?? current.paymentStatus) as PaymentStatus;
      const paid = dto.amountPaidCents ?? current.amountPaidCents;
      events.push({
        actor,
        kind: 'payment',
        body: `${PAYMENT_LABELS[shownStatus]}${paid > 0 ? ` — recibido ${money(paid, current.currency)}` : ''}`,
        metadata: { paymentStatus: shownStatus, amountPaidCents: paid },
      });
    }

    if (Object.keys(data).length === 0 && events.length === 0) return this.get(orderId);

    await this.prisma.order.update({ where: { id: orderId }, data: { ...data, events: { create: events } } });
    await this.audit.log({
      action: 'ORDER_UPDATED',
      userId: adminId,
      entityType: 'order',
      entityId: orderId,
      metadata: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
      ipAddress: ip,
    });

    if (events.length > 0) {
      const client = await this.prisma.user.findUnique({ where: { id: current.userId }, select: { email: true, firstName: true } });
      if (client) {
        const code = orderCode(current.orderNumber);
        if (becameDelivered && deliveryUrl) {
          await this.email.sendOrderDelivered(client.email, { firstName: client.firstName, orderId, orderCode: code, deliveryUrl });
        } else {
          await this.email.sendOrderUpdate(client.email, {
            firstName: client.firstName,
            orderId,
            orderCode: code,
            lines: events.map((e) => String(e.body ?? '')).filter(Boolean),
          });
        }
      }
    }

    return this.get(orderId);
  }

  async addEvent(adminId: string, orderId: string, body: string, internal: boolean) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, brief: true, user: { select: { email: true, firstName: true } } },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const trimmed = body.trim();
    const event = await this.prisma.orderEvent.create({
      data: { orderId, actorId: adminId, kind: internal ? 'note' : 'message', body: trimmed, visibleToClient: !internal },
      select: { id: true, kind: true, body: true, visibleToClient: true, createdAt: true },
    });

    if (!internal) {
      await this.email.sendClientMessage(order.user.email, {
        firstName: order.user.firstName,
        orderId,
        orderCode: orderCode(order.orderNumber),
        body: trimmed,
      });
    }
    return event;
  }

  /** Crea, en la cuenta del equipo, el sitio que se construye para este pedido y lo enlaza. */
  async createSite(adminId: string, orderId: string, templateSlug: string | undefined, ip?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, siteId: true, brief: true, orderNumber: true } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.siteId) throw new ConflictException('Este pedido ya tiene un sitio');

    const businessName = businessNameOf(order.brief, `Pedido ${order.orderNumber}`);
    const site = await this.sites.create(adminId, { name: businessName, templateSlug }, ip);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        siteId: site.id,
        events: { create: { actorId: adminId, kind: 'note', body: `Sitio creado: ${site.name}`, visibleToClient: false } },
      },
    });
    await this.audit.log({ action: 'ORDER_SITE_CREATED', userId: adminId, entityType: 'order', entityId: orderId, metadata: { siteId: site.id }, ipAddress: ip });
    return site;
  }
}
