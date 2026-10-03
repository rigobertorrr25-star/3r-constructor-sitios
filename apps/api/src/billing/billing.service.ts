import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { MODULES } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { WompiConfig } from '../payments/wompi.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DUE_DAYS, MODULE_NAME, invoiceCode } from './billing.constants.js';
import type { SaveSubscriptionDto } from './dto/billing.dto.js';

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: number) => `$${new Intl.NumberFormat('es-CO').format(n)}`;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const longDate = (d: Date) => `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const todayUtc = (now = new Date()) => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now)}T00:00:00Z`);

type InvoiceItem = { key: string; name: string; price: number };

/** Periodo que empieza en el último día de cobro (incluido hoy) y termina el día antes del siguiente. */
export function currentPeriod(billingDay: number, today: Date) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const start = today.getUTCDate() >= billingDay ? new Date(Date.UTC(y, m, billingDay)) : new Date(Date.UTC(y, m - 1, billingDay));
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, billingDay));
  return { start, end: new Date(+next - DAY) };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly email: EmailService,
    private readonly alerts: AlertsService,
    private readonly payments: PaymentsService,
    private readonly wompi: WompiConfig,
  ) {}

  // ───────── precios (equipo de 3R) ─────────

  async prices() {
    const rows = await this.prisma.modulePrice.findMany();
    const price = new Map(rows.map((r) => [r.key, r.monthlyPrice]));
    return MODULES.map((m) => ({ key: m.key, area: m.area, ready: m.ready, name: MODULE_NAME[m.key] ?? m.key, monthlyPrice: price.get(m.key) ?? null }));
  }

  async setPrices(prices: Record<string, number | null>) {
    const keys = new Set(MODULES.map((m) => m.key));
    for (const [key, value] of Object.entries(prices)) {
      if (!keys.has(key)) throw new BadRequestException(`No existe el módulo ${key}`);
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100_000_000)) throw new BadRequestException(`Precio no válido para ${MODULE_NAME[key] ?? key}`);
    }
    await this.prisma.$transaction(
      Object.entries(prices).map(([key, value]) =>
        value === null
          ? this.prisma.modulePrice.deleteMany({ where: { key } })
          : this.prisma.modulePrice.upsert({ where: { key }, create: { key, monthlyPrice: value }, update: { monthlyPrice: value } }),
      ),
    );
    return this.prices();
  }

  // ───────── plan y facturas de una empresa ─────────

  /** Lo que se cobra cada mes: los módulos activos con su precio. Los que no tienen precio no se cobran. */
  private async plan(companyId: string) {
    const [enabled, prices] = await Promise.all([
      this.prisma.companyModule.findMany({ where: { companyId }, select: { key: true } }),
      this.prisma.modulePrice.findMany(),
    ]);
    const price = new Map(prices.map((p) => [p.key, p.monthlyPrice]));
    const items: InvoiceItem[] = [];
    const unpriced: string[] = [];
    for (const { key } of enabled) {
      const p = price.get(key);
      if (p === undefined) unpriced.push(MODULE_NAME[key] ?? key);
      else if (p > 0) items.push({ key, name: MODULE_NAME[key] ?? key, price: p });
    }
    return { items, unpriced, total: items.reduce((n, i) => n + i.price, 0) };
  }

  private shapeInvoice(i: { id: string; number: number; periodStart: Date; periodEnd: Date; items: unknown; total: number; dueDate: Date; status: string; paidAt: Date | null; method: string | null; paymentNote: string | null; createdAt: Date }) {
    const today = day(todayUtc());
    return {
      id: i.id,
      code: invoiceCode(i.number),
      periodStart: day(i.periodStart),
      periodEnd: day(i.periodEnd),
      items: i.items as InvoiceItem[],
      total: i.total,
      dueDate: day(i.dueDate),
      status: i.status,
      overdue: i.status === 'pending' && day(i.dueDate) < today,
      paidAt: i.paidAt,
      method: i.method,
      paymentNote: i.paymentNote,
      createdAt: i.createdAt,
    };
  }

  private async overview(companyId: string) {
    const [subscription, plan, invoices] = await Promise.all([
      this.prisma.companySubscription.findUnique({ where: { companyId } }),
      this.plan(companyId),
      this.prisma.companyInvoice.findMany({ where: { companyId }, orderBy: { periodStart: 'desc' }, take: 36 }),
    ]);
    return {
      subscription: subscription
        ? { status: subscription.status, trialEndsAt: subscription.trialEndsAt ? day(subscription.trialEndsAt) : null, billingDay: subscription.billingDay, notes: subscription.notes }
        : null,
      plan,
      invoices: invoices.map((i) => this.shapeInvoice(i)),
      onlinePayment: this.wompi.enabled,
    };
  }

  /** Para el dueño y los administradores de la empresa. */
  async mine(userId: string, companyId: string) {
    await this.companies.requireMember(userId, companyId, 'admin');
    const o = await this.overview(companyId);
    // Las notas internas del equipo de 3R no se muestran a la empresa.
    return { ...o, subscription: o.subscription ? { ...o.subscription, notes: undefined } : null };
  }

  async adminOverview(companyId: string) {
    const exists = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Empresa no encontrada');
    return this.overview(companyId);
  }

  async saveSubscription(companyId: string, dto: SaveSubscriptionDto) {
    await this.adminOverview(companyId);
    const data = {
      status: dto.status,
      trialEndsAt: dto.trialEndsAt ? new Date(`${dto.trialEndsAt}T00:00:00Z`) : null,
      billingDay: dto.billingDay,
      notes: dto.notes || null,
    };
    await this.prisma.companySubscription.upsert({ where: { companyId }, create: { companyId, ...data }, update: data });
    return this.overview(companyId);
  }

  /** Factura del periodo actual con los módulos activos. No duplica: una por periodo. */
  async generateInvoice(companyId: string, now = new Date()) {
    const sub = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!sub) throw new BadRequestException('Primero configura el plan de la empresa (estado y día de cobro)');
    if (sub.status === 'cancelled') throw new BadRequestException('La suscripción está cancelada');
    const plan = await this.plan(companyId);
    if (plan.total <= 0) throw new BadRequestException('No hay nada que cobrar: ponle precio a los módulos activos en /admin');
    const today = todayUtc(now);
    const { start, end } = currentPeriod(sub.billingDay, today);
    const existing = await this.prisma.companyInvoice.findUnique({ where: { companyId_periodStart: { companyId, periodStart: start } }, select: { id: true } });
    if (existing) throw new BadRequestException('Ya hay una factura para este periodo');
    const invoice = await this.prisma.companyInvoice.create({
      data: { companyId, periodStart: start, periodEnd: end, items: plan.items, total: plan.total, dueDate: new Date(+today + DUE_DAYS * DAY) },
    });
    await this.notifyIssued(companyId, invoice);
    return this.shapeInvoice(invoice);
  }

  private async notifyIssued(companyId: string, invoice: { id: string; number: number; periodStart: Date; periodEnd: Date; total: number; dueDate: Date; items: unknown }) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } });
    const admins = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active', role: { in: ['owner', 'admin'] } },
      select: { id: true, user: { select: { email: true } } },
    });
    const code = invoiceCode(invoice.number);
    await this.alerts.notify(
      companyId,
      admins.map((a) => a.id),
      { kind: 'invoice', title: `Factura ${code} de 3R: ${money(invoice.total)}`, body: `Vence el ${longDate(invoice.dueDate)}`, href: 'facturacion', dedupeKey: `invoice:${invoice.id}` },
    );
    for (const a of admins) {
      void this.email.sendInvoiceIssued(a.user.email, {
        companyId,
        companyName: company.name,
        code,
        period: `${longDate(invoice.periodStart)} al ${longDate(invoice.periodEnd)}`,
        total: money(invoice.total),
        dueDate: longDate(invoice.dueDate),
        items: (invoice.items as InvoiceItem[]).map((i) => ({ name: i.name, price: money(i.price) })),
      });
    }
  }

  async markPaid(invoiceId: string, method: string, note?: string) {
    const { count } = await this.prisma.companyInvoice.updateMany({
      where: { id: invoiceId, status: 'pending' },
      data: { status: 'paid', paidAt: new Date(), method, paymentNote: note || null },
    });
    if (!count) throw new BadRequestException('Esa factura no está pendiente');
    const inv = await this.prisma.companyInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const stillOverdue = await this.prisma.companyInvoice.count({ where: { companyId: inv.companyId, status: 'pending', dueDate: { lt: todayUtc() } } });
    if (!stillOverdue) await this.prisma.companySubscription.updateMany({ where: { companyId: inv.companyId, status: 'past_due' }, data: { status: 'active' } });
    return this.shapeInvoice(inv);
  }

  async voidInvoice(invoiceId: string) {
    const { count } = await this.prisma.companyInvoice.updateMany({ where: { id: invoiceId, status: 'pending' }, data: { status: 'void' } });
    if (!count) throw new BadRequestException('Solo se anula una factura pendiente');
    return this.shapeInvoice(await this.prisma.companyInvoice.findUniqueOrThrow({ where: { id: invoiceId } }));
  }

  // ───────── pago en línea (la empresa) ─────────

  async checkout(userId: string, companyId: string, invoiceId: string) {
    await this.companies.requireMember(userId, companyId, 'admin');
    const invoice = await this.prisma.companyInvoice.findFirst({ where: { id: invoiceId, companyId, status: 'pending' } });
    if (!invoice) throw new NotFoundException('Esa factura no está pendiente');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    return this.payments.createInvoiceCheckout(invoice, user.email);
  }

  async confirm(userId: string, companyId: string, invoiceId: string, transactionId: string) {
    await this.companies.requireMember(userId, companyId, 'admin');
    const invoice = await this.prisma.companyInvoice.findFirst({ where: { id: invoiceId, companyId }, select: { id: true } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return this.payments.confirmInvoice(invoiceId, transactionId);
  }

  // ───────── revisión diaria ─────────

  /** Fin de pruebas, factura del día de cobro y facturas vencidas. Lo llama el cron diario. */
  async run(now = new Date()) {
    const today = todayUtc(now);
    let generated = 0;
    let pastDue = 0;
    // Prueba terminada: pasa a activa (se cobra desde su siguiente día de cobro).
    await this.prisma.companySubscription.updateMany({ where: { status: 'trial', trialEndsAt: { lte: today } }, data: { status: 'active' } });
    const due = await this.prisma.companySubscription.findMany({
      where: { status: { in: ['active', 'past_due'] }, billingDay: today.getUTCDate(), company: { status: 'active' } },
      select: { companyId: true },
    });
    for (const s of due) {
      try {
        await this.generateInvoice(s.companyId, now);
        generated++;
      } catch (error) {
        this.logger.warn(`No se generó la factura de ${s.companyId}: ${(error as Error).message}`);
      }
    }
    const overdue = await this.prisma.companyInvoice.findMany({
      where: { status: 'pending', dueDate: { lt: today } },
      select: { id: true, number: true, total: true, companyId: true },
    });
    for (const inv of overdue) {
      const { count } = await this.prisma.companySubscription.updateMany({ where: { companyId: inv.companyId, status: 'active' }, data: { status: 'past_due' } });
      pastDue += count;
      const admins = await this.prisma.companyMember.findMany({ where: { companyId: inv.companyId, status: 'active', role: { in: ['owner', 'admin'] } }, select: { id: true } });
      await this.alerts.notify(
        inv.companyId,
        admins.map((a) => a.id),
        { kind: 'invoice', title: `La factura ${invoiceCode(inv.number)} está vencida`, body: `${money(inv.total)}. Págala para seguir sin interrupciones.`, href: 'facturacion', dedupeKey: `invoice-overdue:${inv.id}` },
      );
    }
    return { generated, overdue: overdue.length, pastDue };
  }
}
