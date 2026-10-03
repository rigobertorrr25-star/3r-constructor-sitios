import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCommentDto, CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto.js';
import { ACTIVE_STATUSES, PRIORITY_LABEL, STATUS_LABEL, TICKETS_MODULE, TICKET_CATEGORIES } from './tickets.constants.js';
import { AutomationsService } from '../automations/automations.service.js';

const ticketSelect = {
  id: true,
  number: true,
  title: true,
  category: true,
  priority: true,
  status: true,
  requesterMemberId: true,
  assigneeMemberId: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;
type TicketRow = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  requesterMemberId: string | null;
  assigneeMemberId: string | null;
};

/** Supervisor en adelante ve y atiende todos los tickets; los demás, solo los que pidieron o tienen asignados. */
const attends = (m: Member) => atLeast(m.role, 'supervisor');
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly email: EmailService,
    private readonly alerts: AlertsService,
    private readonly automations: AutomationsService,
  ) {}

  private async access(userId: string, companyId: string, min: 'employee' | 'admin' = 'employee') {
    const member = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, TICKETS_MODULE);
    return member;
  }

  /** Lo que un miembro puede ver: todo si atiende, si no lo suyo. */
  private scope(member: Member, companyId: string): Prisma.TicketWhereInput {
    return attends(member) ? { companyId } : { companyId, OR: [{ requesterMemberId: member.id }, { assigneeMemberId: member.id }] };
  }

  private async findVisible(member: Member, companyId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, ...this.scope(member, companyId) }, select: ticketSelect });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  async list(userId: string, companyId: string, filters: { view?: string; category?: string; q?: string }) {
    const me = await this.access(userId, companyId);
    const q = filters.q?.trim().replace(/^#/, '');
    const view: Prisma.TicketWhereInput =
      filters.view === 'mine'
        ? { assigneeMemberId: me.id, status: { in: ACTIVE_STATUSES } }
        : filters.view === 'requested'
          ? { requesterMemberId: me.id }
          : filters.view === 'done'
            ? { status: { in: ['resolved', 'closed'] } }
            : filters.view === 'all'
              ? {}
              : { status: { in: ACTIVE_STATUSES } };
    const rows = await this.prisma.ticket.findMany({
      where: {
        AND: [
          this.scope(me, companyId),
          view,
          filters.category && (TICKET_CATEGORIES as readonly string[]).includes(filters.category) ? { category: filters.category } : {},
          q ? (/^\d+$/.test(q) ? { number: Number(q) } : { title: { contains: q, mode: 'insensitive' } }) : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: ticketSelect,
    });
    // Lo urgente arriba; a igual prioridad, el más reciente.
    return rows.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || +b.createdAt - +a.createdAt);
  }

  /** Cifras para el tablero de tickets y el inicio de la empresa (dentro de lo que el miembro puede ver). */
  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const where = this.scope(me, companyId);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [groups, urgent, unassigned, mine, resolved] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.ticket.count({ where: { AND: [where, { status: { in: ACTIVE_STATUSES }, priority: 'urgent' }] } }),
      this.prisma.ticket.count({ where: { AND: [where, { status: 'open', assigneeMemberId: null }] } }),
      this.prisma.ticket.count({ where: { AND: [where, { status: { in: ACTIVE_STATUSES }, assigneeMemberId: me.id }] } }),
      this.prisma.ticket.findMany({
        where: { AND: [where, { resolvedAt: { gte: since } }] },
        select: { createdAt: true, resolvedAt: true },
        take: 1000,
      }),
    ]);
    const byStatus = Object.fromEntries(Object.keys(STATUS_LABEL).map((s) => [s, groups.find((g) => g.status === s)?._count._all ?? 0]));
    const hours = resolved.map((t) => (+t.resolvedAt! - +t.createdAt) / 3_600_000);
    return {
      byStatus,
      active: ACTIVE_STATUSES.reduce((n, s) => n + byStatus[s], 0),
      urgent,
      unassigned,
      mine,
      resolved30d: resolved.length,
      avgResolutionHours: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
    };
  }

  async create(userId: string, companyId: string, dto: CreateTicketDto) {
    const me = await this.access(userId, companyId);
    const created = await this.prisma.$transaction(async (tx) => {
      // Número consecutivo por empresa, sin choques aunque dos personas creen a la vez.
      const { ticketSeq } = await tx.company.update({ where: { id: companyId }, data: { ticketSeq: { increment: 1 } }, select: { ticketSeq: true } });
      return tx.ticket.create({
        data: {
          companyId,
          number: ticketSeq,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          priority: dto.priority ?? 'medium',
          requesterMemberId: me.id,
        },
        select: ticketSelect,
      });
    });
    if (created.priority === 'urgent' || created.priority === 'high') {
      await this.alerts.notify(companyId, await this.alerts.membersAbove(companyId, 'supervisor', undefined, me.id), {
        kind: 'ticket',
        title: `Nuevo ticket ${created.priority === 'urgent' ? 'urgente' : 'de prioridad alta'}: #${created.number}`,
        body: created.title,
        href: `tickets/${created.id}`,
      });
    }
    const who = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    const quien = who ? [who.firstName, who.lastName].filter(Boolean).join(' ') || who.email : '';
    void this.automations.emit(companyId, 'ticket_created', {
      vars: { numero: created.number, titulo: created.title, prioridad: ({ low: 'baja', medium: 'media', high: 'alta', urgent: 'urgente' } as Record<string, string>)[created.priority] ?? created.priority, quien },
      summary: `Ticket #${created.number}: ${created.title}`,
      href: `tickets/${created.id}`,
    });
    return created;
  }

  async get(userId: string, companyId: string, ticketId: string) {
    const me = await this.access(userId, companyId);
    await this.findVisible(me, companyId, ticketId);
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: {
        ...ticketSelect,
        description: true,
        events: { orderBy: { createdAt: 'asc' }, take: 500, select: { id: true, kind: true, body: true, createdAt: true, userId: true } },
      },
    });
    const ids = [...new Set(ticket.events.map((e) => e.userId).filter((x): x is string => !!x))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, email: true } })
      : [];
    const who = new Map(users.map((u) => [u.id, u.firstName || u.email]));
    return {
      ...ticket,
      events: ticket.events.map((e) => ({
        id: e.id,
        kind: e.kind,
        body: e.body,
        createdAt: e.createdAt,
        author: e.userId ? (who.get(e.userId) ?? null) : null,
      })),
      // Lo que la web puede mostrar como botones para este miembro.
      can: this.permissions(me, ticket),
    };
  }

  private permissions(me: Member, t: TicketRow) {
    const staff = attends(me);
    const assignee = t.assigneeMemberId === me.id;
    const requester = t.requesterMemberId === me.id;
    const active = ACTIVE_STATUSES.includes(t.status);
    const statuses = new Set<string>();
    // Quien atiende mueve a cualquier estado; uno ya resuelto o cerrado solo se cierra o se reabre.
    if (staff) (active ? Object.keys(STATUS_LABEL) : ['open', 'closed']).forEach((s) => statuses.add(s));
    if (assignee && active) ['in_progress', 'resolved'].forEach((s) => statuses.add(s));
    if (requester) (active || t.status === 'resolved' ? ['closed'] : []).concat(active ? [] : ['open']).forEach((s) => statuses.add(s));
    statuses.delete(t.status);
    // `assigned` no se elige suelto: se pone solo al asignar a alguien.
    statuses.delete('assigned');
    return { manage: staff, statuses: [...statuses], comment: staff || assignee || requester, delete: atLeast(me.role, 'admin') };
  }

  async update(userId: string, companyId: string, ticketId: string, dto: UpdateTicketDto) {
    const me = await this.access(userId, companyId);
    const t = await this.findVisible(me, companyId, ticketId);
    const can = this.permissions(me, t);
    const touchesManaged = dto.priority !== undefined || dto.category !== undefined || dto.assigneeMemberId !== undefined;
    if (touchesManaged && !can.manage) throw new ForbiddenException('Solo quien atiende tickets cambia el responsable, la prioridad o el área');

    const data: Prisma.TicketUpdateInput = {};
    const events: { kind: string; body: string }[] = [];
    let status = t.status;
    let assignee = t.assigneeMemberId;
    let assigneeChangedTo: string | null = null;

    if (dto.assigneeMemberId !== undefined) {
      const next = dto.assigneeMemberId || null;
      if (next !== t.assigneeMemberId) {
        let name = 'nadie';
        if (next) {
          const m = await this.prisma.companyMember.findFirst({
            where: { id: next, companyId, status: 'active' },
            select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
          });
          if (!m) throw new BadRequestException('El responsable tiene que ser alguien activo de la empresa');
          name = [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email;
          assigneeChangedTo = next;
        }
        data.assigneeMemberId = next;
        assignee = next;
        events.push({ kind: 'assign', body: next ? `Asignado a ${name}` : 'Quedó sin responsable' });
        // Asignar uno abierto lo pasa a «Asignado»; quitarle el responsable lo devuelve a «Abierto».
        if (next && status === 'open') status = 'assigned';
        if (!next && status === 'assigned') status = 'open';
      }
    }

    if (dto.status !== undefined && dto.status !== t.status) {
      if (!can.manage && !can.statuses.includes(dto.status)) throw new ForbiddenException('No puedes pasar este ticket a ese estado');
      if (dto.status === 'assigned' && !assignee) throw new BadRequestException('Para marcarlo como asignado, elige un responsable');
      status = dto.status;
      // Reabrir uno que tiene responsable lo deja «Asignado».
      if (status === 'open' && assignee) status = 'assigned';
    }

    if (status !== t.status) {
      data.status = status;
      if (status === 'resolved') data.resolvedAt = new Date();
      if (status === 'closed') data.closedAt = new Date();
      if (ACTIVE_STATUSES.includes(status)) Object.assign(data, { resolvedAt: null, closedAt: null });
      events.push({ kind: 'status', body: `${STATUS_LABEL[t.status]} → ${STATUS_LABEL[status]}` });
    }
    if (dto.priority !== undefined && dto.priority !== t.priority) {
      data.priority = dto.priority;
      events.push({ kind: 'priority', body: `Prioridad: ${PRIORITY_LABEL[t.priority]} → ${PRIORITY_LABEL[dto.priority]}` });
    }
    if (dto.category !== undefined) data.category = dto.category;

    const [ticket] = await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id: t.id }, data, select: ticketSelect }),
      ...events.map((e) => this.prisma.ticketEvent.create({ data: { companyId, ticketId: t.id, userId, ...e } })),
    ]);

    // Avisos por correo, sin avisarle a quien hizo el cambio.
    const url = this.email.ticketUrl(companyId, t.id);
    if (assigneeChangedTo && assigneeChangedTo !== me.id) {
      await this.alerts.notify(companyId, [assigneeChangedTo], { kind: 'ticket', title: `Te asignaron el ticket #${t.number}`, body: t.title, href: `tickets/${t.id}` });
      const to = await this.memberEmail(assigneeChangedTo);
      if (to)
        void this.email.sendTicketAssigned(to, {
          companyName: me.company.name,
          number: t.number,
          title: t.title,
          priorityLabel: PRIORITY_LABEL[ticket.priority],
          ticketUrl: url,
        });
    }
    if (status === 'resolved' && t.status !== 'resolved' && t.requesterMemberId && t.requesterMemberId !== me.id) {
      await this.alerts.notify(companyId, [t.requesterMemberId], { kind: 'ticket', title: `Tu ticket #${t.number} quedó resuelto`, body: 'Ciérralo si todo está bien, o ábrelo de nuevo.', href: `tickets/${t.id}` });
      const to = await this.memberEmail(t.requesterMemberId);
      if (to) void this.email.sendTicketResolved(to, { companyName: me.company.name, number: t.number, title: t.title, ticketUrl: url });
    }
    return ticket;
  }

  private async memberEmail(memberId: string) {
    const m = await this.prisma.companyMember.findFirst({ where: { id: memberId, status: 'active' }, select: { user: { select: { email: true } } } });
    return m?.user.email ?? null;
  }

  async comment(userId: string, companyId: string, ticketId: string, dto: CreateCommentDto) {
    const me = await this.access(userId, companyId);
    const t = await this.findVisible(me, companyId, ticketId);
    if (!this.permissions(me, t).comment) throw new ForbiddenException('No puedes comentar este ticket');
    const [event] = await this.prisma.$transaction([
      this.prisma.ticketEvent.create({
        data: { companyId, ticketId: t.id, userId, kind: 'comment', body: dto.body },
        select: { id: true, kind: true, body: true, createdAt: true },
      }),
      this.prisma.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } }),
    ]);
    // A la otra parte (quien pidió o quien atiende), no a quien comenta.
    await this.alerts.notify(
      companyId,
      [t.requesterMemberId, t.assigneeMemberId].filter((x) => x !== me.id),
      { kind: 'ticket', title: `Nuevo comentario en el ticket #${t.number}`, body: dto.body.slice(0, 140), href: `tickets/${t.id}` },
    );
    return event;
  }

  async remove(userId: string, companyId: string, ticketId: string) {
    await this.access(userId, companyId, 'admin');
    const { count } = await this.prisma.ticket.deleteMany({ where: { id: ticketId, companyId } });
    if (count === 0) throw new NotFoundException('Ticket no encontrado');
  }
}
