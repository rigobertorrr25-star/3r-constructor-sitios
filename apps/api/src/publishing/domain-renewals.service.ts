import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { DOMAIN_ADDON_CENTS, orderCode } from '../orders/orders.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;
/** Con cuánta anticipación se avisa que un dominio propio se vence. */
export const RENEWAL_NOTICE_DAYS = 30;

const longDate = (date: Date) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(date);

const cop = (cents: number, currency: string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);

/** Un año después de `from`, el mismo día y hora. */
export const plusOneYear = (from: Date) => {
  const next = new Date(from);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

@Injectable()
export class DomainRenewalsService {
  private readonly logger = new Logger(DomainRenewalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Avisa (al cliente y al equipo) de cada dominio propio que se vence en los próximos 30 días o que ya
   * venció sin aviso. Cada vencimiento se avisa una sola vez: se puede llamar todos los días sin repetir.
   */
  async sendDueNotices(now = new Date()) {
    const due = await this.prisma.domain.findMany({
      where: { type: 'custom', renewalNoticeSentAt: null, expiresAt: { not: null, lte: new Date(now.getTime() + RENEWAL_NOTICE_DAYS * DAY) } },
      select: {
        id: true,
        domain: true,
        expiresAt: true,
        site: {
          select: {
            name: true,
            order: { select: { id: true, orderNumber: true, currency: true, brief: true, user: { select: { email: true, firstName: true } } } },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    let sent = 0;
    for (const item of due) {
      // Se marca primero: si dos revisiones corren a la vez, solo una avisa.
      const claimed = await this.prisma.domain.updateMany({ where: { id: item.id, renewalNoticeSentAt: null }, data: { renewalNoticeSentAt: now } });
      if (claimed.count === 0 || !item.expiresAt) continue;

      const order = item.site.order;
      const expiresOn = longDate(item.expiresAt);
      const expired = item.expiresAt <= now;
      const price = cop(DOMAIN_ADDON_CENTS, order?.currency ?? 'COP');
      const businessName = String((order?.brief as { businessName?: unknown } | null)?.businessName ?? item.site.name);

      if (order) {
        await this.prisma.orderEvent.create({
          data: {
            orderId: order.id,
            kind: 'message',
            body: `Tu dominio ${item.domain} ${expired ? 'venció' : 'vence'} el ${expiresOn}. Renovarlo cuesta ${price} por un año más. Escríbenos por aquí y te decimos cómo pagar.`,
            metadata: { domainRenewal: true, domain: item.domain, expiresAt: item.expiresAt.toISOString() },
          },
        });
        await this.email.sendDomainRenewal(order.user.email, { firstName: order.user.firstName, orderId: order.id, domain: item.domain, expiresOn, expired, price });
      }
      await this.email.sendAdminDomainRenewal({
        orderId: order?.id ?? null,
        domain: item.domain,
        expiresOn,
        expired,
        businessName: order ? `${businessName} · ${orderCode(order.orderNumber)}` : businessName,
        clientEmail: order?.user.email ?? null,
      });
      sent++;
    }
    if (sent > 0) this.logger.log(`Avisos de renovación de dominio enviados: ${sent}`);
    return { checked: due.length, sent };
  }
}
