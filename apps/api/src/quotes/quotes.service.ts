import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RespondQuoteDto, SaveQuoteDto } from './dto/quotes.dto.js';
import { renderQuote } from './quote-pdf.js';
import { QUOTES_MODULE, QUOTE_STATUSES, STATUS_LABEL, quoteCode } from './quotes.constants.js';
import { AutomationsService } from '../automations/automations.service.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const money = (n: number) => `$${new Intl.NumberFormat('es-CO').format(n)}`;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const longDate = (d: Date) => `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
/** Se puede editar mientras el cliente no la tenga en firme. */
const EDITABLE = ['draft', 'changes_requested'];

const quoteSelect = {
  id: true,
  number: true,
  contactId: true,
  clientName: true,
  clientCompany: true,
  clientEmail: true,
  clientPhone: true,
  title: true,
  notes: true,
  discount: true,
  taxRate: true,
  subtotal: true,
  tax: true,
  total: true,
  validUntil: true,
  status: true,
  sentAt: true,
  viewedAt: true,
  respondedAt: true,
  responseName: true,
  responseMessage: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  items: { orderBy: { position: 'asc' }, select: { description: true, quantity: true, unitPrice: true } },
} as const satisfies Prisma.QuoteSelect;

type QuoteRow = Prisma.QuoteGetPayload<{ select: typeof quoteSelect }>;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly email: EmailService,
    private readonly alerts: AlertsService,
    private readonly automations: AutomationsService,
  ) {}

  /** Cualquier miembro activo hace cotizaciones (son de ventas); borrar exige administrador. */
  private async access(userId: string, companyId: string, min: 'employee' | 'admin' = 'employee') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, QUOTES_MODULE);
    return me;
  }

  private shape(q: QuoteRow) {
    const expired = !!q.validUntil && q.validUntil.toISOString().slice(0, 10) < todayIso() && q.status === 'sent';
    return {
      ...q,
      code: quoteCode(q.number),
      discount: Number(q.discount),
      subtotal: Number(q.subtotal),
      tax: Number(q.tax),
      total: Number(q.total),
      validUntil: q.validUntil?.toISOString().slice(0, 10) ?? null,
      expired,
      items: q.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: i.quantity * Number(i.unitPrice) })),
    };
  }

  /** Totales en pesos: subtotal − descuento, más IVA sobre esa base. */
  private totals(dto: SaveQuoteDto) {
    const subtotal = dto.items.reduce((n, i) => n + BigInt(i.quantity) * BigInt(i.unitPrice), 0n);
    const discount = BigInt(dto.discount ?? 0);
    if (discount > subtotal) throw new BadRequestException('El descuento no puede ser mayor que el subtotal');
    const rate = BigInt(dto.taxRate ?? 0);
    // Redondeo al peso más cercano.
    const tax = ((subtotal - discount) * rate * 2n + 100n) / 200n;
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }

  private async checkContact(companyId: string, contactId: string | null | undefined) {
    if (!contactId) return null;
    const c = await this.prisma.crmContact.findFirst({ where: { id: contactId, companyId }, select: { id: true } });
    if (!c) throw new BadRequestException('Ese cliente no está en el CRM de la empresa');
    return c.id;
  }

  async list(userId: string, companyId: string, filters: { status?: string; contactId?: string }) {
    await this.access(userId, companyId);
    const rows = await this.prisma.quote.findMany({
      where: {
        companyId,
        ...(filters.status && (QUOTE_STATUSES as readonly string[]).includes(filters.status) ? { status: filters.status } : {}),
        ...(filters.contactId ? { contactId: filters.contactId } : {}),
      },
      orderBy: { number: 'desc' },
      take: 300,
      select: quoteSelect,
    });
    return rows.map((q) => this.shape(q));
  }

  async summary(userId: string, companyId: string) {
    await this.access(userId, companyId);
    const groups = await this.prisma.quote.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true }, _sum: { total: true } });
    const by = (s: string) => groups.find((g) => g.status === s);
    return {
      open: (by('sent')?._count._all ?? 0) + (by('changes_requested')?._count._all ?? 0),
      openValue: Number((by('sent')?._sum.total ?? 0n) + (by('changes_requested')?._sum.total ?? 0n)),
      accepted: by('accepted')?._count._all ?? 0,
      acceptedValue: Number(by('accepted')?._sum.total ?? 0n),
      drafts: by('draft')?._count._all ?? 0,
    };
  }

  async create(userId: string, companyId: string, dto: SaveQuoteDto) {
    await this.access(userId, companyId);
    const contactId = await this.checkContact(companyId, dto.contactId);
    const t = this.totals(dto);
    const q = await this.prisma.$transaction(async (tx) => {
      const { quoteSeq } = await tx.company.update({ where: { id: companyId }, data: { quoteSeq: { increment: 1 } }, select: { quoteSeq: true } });
      return tx.quote.create({
        data: {
          companyId,
          number: quoteSeq,
          contactId,
          ...this.fields(dto),
          ...t,
          createdById: userId,
          items: { create: dto.items.map((i, position) => ({ position, description: i.description, quantity: i.quantity, unitPrice: BigInt(i.unitPrice) })) },
        },
        select: quoteSelect,
      });
    });
    return this.shape(q);
  }

  private fields(dto: SaveQuoteDto) {
    return {
      clientName: dto.clientName,
      clientCompany: dto.clientCompany || null,
      clientEmail: dto.clientEmail ? dto.clientEmail.toLowerCase() : null,
      clientPhone: dto.clientPhone || null,
      title: dto.title,
      notes: dto.notes || null,
      taxRate: dto.taxRate ?? 0,
      validUntil: dto.validUntil ? new Date(`${dto.validUntil}T00:00:00Z`) : null,
    };
  }

  private async find(companyId: string, quoteId: string) {
    const q = await this.prisma.quote.findFirst({ where: { id: quoteId, companyId }, select: quoteSelect });
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return q;
  }

  async get(userId: string, companyId: string, quoteId: string) {
    const me = await this.access(userId, companyId);
    const q = await this.find(companyId, quoteId);
    const author = q.createdById ? await this.prisma.user.findUnique({ where: { id: q.createdById }, select: { firstName: true, lastName: true, email: true } }) : null;
    return { ...this.shape(q), author: author ? name(author) : null, can: { edit: EDITABLE.includes(q.status), delete: atLeast(me.role, 'admin') } };
  }

  async update(userId: string, companyId: string, quoteId: string, dto: SaveQuoteDto) {
    await this.access(userId, companyId);
    const current = await this.find(companyId, quoteId);
    if (!EDITABLE.includes(current.status)) throw new BadRequestException('Esta cotización ya se envió. Pásala a borrador para cambiarla.');
    const contactId = await this.checkContact(companyId, dto.contactId);
    const t = this.totals(dto);
    const [, q] = await this.prisma.$transaction([
      this.prisma.quoteItem.deleteMany({ where: { quoteId } }),
      this.prisma.quote.update({
        where: { id: quoteId },
        data: {
          contactId,
          ...this.fields(dto),
          ...t,
          items: { create: dto.items.map((i, position) => ({ position, description: i.description, quantity: i.quantity, unitPrice: BigInt(i.unitPrice) })) },
        },
        select: quoteSelect,
      }),
    ]);
    return this.shape(q);
  }

  /** Volver a borrador para editar una cotización ya enviada (el enlace sigue sirviendo, pero muestra que cambió). */
  async reopen(userId: string, companyId: string, quoteId: string) {
    await this.access(userId, companyId);
    const q = await this.find(companyId, quoteId);
    if (q.status !== 'sent') throw new BadRequestException('Solo una cotización enviada vuelve a borrador');
    return this.shape(await this.prisma.quote.update({ where: { id: q.id }, data: { status: 'draft' }, select: quoteSelect }));
  }

  /** Genera el enlace (nuevo cada vez) y, si hay correo del cliente, se lo manda. */
  async send(userId: string, companyId: string, quoteId: string, sendEmail: boolean) {
    const me = await this.access(userId, companyId);
    const q = await this.find(companyId, quoteId);
    if (!EDITABLE.includes(q.status) && q.status !== 'sent') throw new BadRequestException('Esta cotización ya tiene respuesta del cliente');
    if (sendEmail && !q.clientEmail) throw new BadRequestException('La cotización no tiene correo del cliente. Agrégalo o comparte el enlace.');
    const token = randomBytes(24).toString('base64url');
    const updated = await this.prisma.quote.update({
      where: { id: q.id },
      data: { status: 'sent', tokenHash: sha256(token), sentAt: new Date(), viewedAt: null, respondedAt: null, responseName: null, responseMessage: null },
      select: quoteSelect,
    });
    const url = this.email.publicQuoteUrl(token);
    const sender = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (sendEmail && q.clientEmail) {
      void this.email.sendQuote(q.clientEmail, sender?.email, {
        companyName: me.company.name,
        clientName: q.clientName,
        code: quoteCode(q.number),
        title: q.title,
        total: money(Number(q.total)),
        validUntil: q.validUntil ? longDate(q.validUntil) : null,
        quoteUrl: url,
        senderName: sender ? name(sender) : me.company.name,
      });
    }
    await this.crmActivity(companyId, q.contactId, userId, `Cotización ${quoteCode(q.number)} enviada por ${money(Number(q.total))}`, 'quote');
    return { ...this.shape(updated), url };
  }

  /** Deja constancia en el CRM y, si corresponde, mueve la etapa del cliente. */
  private async crmActivity(companyId: string, contactId: string | null, userId: string | null, body: string, stage?: 'quote' | 'won') {
    if (!contactId) return;
    const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, companyId }, select: { id: true, stage: true } });
    if (!contact) return;
    const ops: Prisma.PrismaPromise<unknown>[] = [this.prisma.crmActivity.create({ data: { companyId, contactId, userId, kind: 'note', body } })];
    const advance = stage === 'won' ? contact.stage !== 'won' : stage === 'quote' && ['lead', 'contacted'].includes(contact.stage);
    if (stage && advance) ops.push(this.prisma.crmContact.update({ where: { id: contactId }, data: { stage } }));
    await this.prisma.$transaction(ops);
  }

  async remove(userId: string, companyId: string, quoteId: string) {
    await this.access(userId, companyId, 'admin');
    const { count } = await this.prisma.quote.deleteMany({ where: { id: quoteId, companyId } });
    if (count === 0) throw new NotFoundException('Cotización no encontrada');
  }

  async pdf(userId: string, companyId: string, quoteId: string) {
    await this.access(userId, companyId);
    return this.renderPdf(await this.find(companyId, quoteId), companyId);
  }

  private async renderPdf(q: QuoteRow, companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true, taxId: true, city: true, phone: true } });
    const s = this.shape(q);
    const bytes = await renderQuote({
      companyName: company.name,
      companyLine: [company.taxId ? `NIT ${company.taxId}` : null, company.city, company.phone].filter(Boolean).join(' · '),
      code: s.code,
      title: s.title,
      date: longDate(new Date(`${(q.sentAt ?? q.createdAt).toISOString().slice(0, 10)}T00:00:00Z`)),
      validUntil: q.validUntil ? longDate(q.validUntil) : null,
      client: [s.clientName, s.clientCompany, s.clientEmail, s.clientPhone].filter((x): x is string => !!x),
      items: s.items,
      subtotal: s.subtotal,
      discount: s.discount,
      taxRate: s.taxRate,
      tax: s.tax,
      total: s.total,
      notes: s.notes,
    });
    return { pdf: Buffer.from(bytes), fileName: `${s.code}.pdf` };
  }

  // ───────── enlace público (lo que ve el cliente) ─────────

  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException('Cotización no encontrada');
    const q = await this.prisma.quote.findUnique({
      where: { tokenHash: sha256(token) },
      select: { ...quoteSelect, companyId: true, company: { select: { name: true, city: true, phone: true, status: true } } },
    });
    if (!q || q.company.status !== 'active') throw new NotFoundException('Cotización no encontrada');
    return q;
  }

  async publicView(token: string) {
    const q = await this.byToken(token);
    if (!q.viewedAt) await this.prisma.quote.update({ where: { id: q.id }, data: { viewedAt: new Date() } });
    const s = this.shape(q);
    return {
      code: s.code,
      title: s.title,
      company: { name: q.company.name, city: q.company.city, phone: q.company.phone },
      clientName: s.clientName,
      clientCompany: s.clientCompany,
      items: s.items,
      subtotal: s.subtotal,
      discount: s.discount,
      taxRate: s.taxRate,
      tax: s.tax,
      total: s.total,
      notes: s.notes,
      validUntil: s.validUntil,
      sentAt: s.sentAt,
      // `draft`: la empresa la está cambiando.
      status: s.status,
      expired: s.expired,
      respondedAt: s.respondedAt,
      responseName: s.responseName,
      responseMessage: s.responseMessage,
    };
  }

  async publicPdf(token: string) {
    const q = await this.byToken(token);
    return this.renderPdf(q, q.companyId);
  }

  async respond(token: string, dto: RespondQuoteDto) {
    const q = await this.byToken(token);
    if (q.status !== 'sent') throw new BadRequestException(q.status === 'draft' ? 'La empresa está actualizando esta cotización. Espera la nueva versión.' : 'Esta cotización ya tiene respuesta.');
    if (q.validUntil && q.validUntil.toISOString().slice(0, 10) < todayIso() && dto.action === 'accept') {
      throw new BadRequestException('Esta cotización ya venció. Pide una nueva o pide cambios.');
    }
    if (dto.action !== 'accept' && !dto.message) throw new BadRequestException(dto.action === 'changes' ? 'Cuéntanos qué cambios necesitas' : 'Cuéntanos por qué, nos ayuda a mejorar');
    const status = dto.action === 'accept' ? 'accepted' : dto.action === 'reject' ? 'rejected' : 'changes_requested';
    const { count } = await this.prisma.quote.updateMany({
      where: { id: q.id, status: 'sent' },
      data: { status, respondedAt: new Date(), responseName: dto.name, responseMessage: dto.message || null },
    });
    if (!count) throw new BadRequestException('Esta cotización ya tiene respuesta.');

    const verdict = status === 'accepted' ? 'aceptó' : status === 'rejected' ? 'rechazó' : 'pidió cambios en';
    const code = quoteCode(q.number);
    await this.crmActivity(
      q.companyId,
      q.contactId,
      null,
      `${q.clientName} ${verdict} la cotización ${code}${dto.message ? `: «${dto.message}»` : ''}`,
      status === 'accepted' ? 'won' : undefined,
    );
    // Aviso a quien la hizo (campanita y correo).
    if (q.createdById) {
      const author = await this.prisma.companyMember.findFirst({
        where: { companyId: q.companyId, userId: q.createdById, status: 'active' },
        select: { id: true, user: { select: { email: true } } },
      });
      if (author) {
        await this.alerts.notify(q.companyId, [author.id], {
          kind: 'quote',
          title: `${q.clientName} ${verdict} la cotización ${code}`,
          body: dto.message ?? null,
          href: `cotizaciones/${q.id}`,
        });
        void this.email.sendQuoteResponded(author.user.email, {
          code,
          clientName: q.clientName,
          verdict,
          responseName: dto.name,
          message: dto.message || null,
          quoteUrl: this.email.quoteUrl(q.companyId, q.id),
        });
      }
    }
    if (status === 'accepted' || status === 'rejected') {
      void this.automations.emit(q.companyId, status === 'accepted' ? 'quote_accepted' : 'quote_rejected', {
        vars: { numero: code, cliente: q.clientName, correo: q.clientEmail, celular: q.clientPhone, total: `$${new Intl.NumberFormat('es-CO').format(Number(q.total))}`, titulo: q.title, mensaje: dto.message ?? '' },
        amountPesos: Number(q.total),
        summary: `${q.clientName} ${verdict} la cotización ${code} (${q.title})`,
        href: `cotizaciones/${q.id}`,
        contact: { name: q.clientName, email: q.clientEmail, phone: q.clientPhone },
      });
    }
    return { status, label: STATUS_LABEL[status] };
  }
}
