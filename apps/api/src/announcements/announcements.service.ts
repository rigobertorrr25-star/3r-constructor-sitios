import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ANNOUNCEMENTS_MODULE, KIND_LABEL, MAX_EMAILS } from './announcements.constants.js';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcements.dto.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;

const baseSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  eventAt: true,
  eventPlace: true,
  pinned: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const excerpt = (body: string, max = 240) => (body.length > max ? `${body.slice(0, max).trimEnd()}…` : body);

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly email: EmailService,
    private readonly alerts: AlertsService,
  ) {}

  /** Todos leen; publicar, editar y borrar es de RR. HH. en adelante. */
  private async access(userId: string, companyId: string, min: 'employee' | 'hr' = 'employee') {
    const member = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, ANNOUNCEMENTS_MODULE);
    return member;
  }

  private async authors(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const users = unique.length ? await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [];
    return new Map(users.map((u) => [u.id, name(u)]));
  }

  async list(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const rows = await this.prisma.announcement.findMany({
      where: { companyId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      select: { ...baseSelect, reads: { where: { memberId: me.id }, select: { readAt: true } }, _count: { select: { reads: true } } },
    });
    const who = await this.authors(rows.map((r) => r.authorId));
    return rows.map(({ reads, _count, authorId, body, ...r }) => ({
      ...r,
      excerpt: excerpt(body),
      author: authorId ? (who.get(authorId) ?? null) : null,
      read: reads.length > 0,
      readCount: _count.reads,
    }));
  }

  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const [unread, latest, upcoming] = await Promise.all([
      this.prisma.announcement.count({ where: { companyId, reads: { none: { memberId: me.id } } } }),
      this.prisma.announcement.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, kind: true, createdAt: true } }),
      this.prisma.announcement.findMany({
        where: { companyId, kind: 'event', eventAt: { gte: new Date() } },
        orderBy: { eventAt: 'asc' },
        take: 3,
        select: { id: true, title: true, eventAt: true, eventPlace: true },
      }),
    ]);
    return { unread, latest, upcoming };
  }

  async create(userId: string, companyId: string, dto: CreateAnnouncementDto) {
    const me = await this.access(userId, companyId, 'hr');
    const created = await this.prisma.announcement.create({
      data: {
        companyId,
        kind: dto.kind ?? 'news',
        title: dto.title,
        body: dto.body,
        eventAt: dto.eventAt ? new Date(dto.eventAt) : null,
        eventPlace: dto.eventPlace || null,
        pinned: dto.pinned ?? false,
        authorId: userId,
        // Quien lo publica ya lo leyó.
        reads: { create: { memberId: me.id } },
      },
      select: baseSelect,
    });
    const team = await this.prisma.companyMember.findMany({ where: { companyId, status: 'active', id: { not: me.id } }, select: { id: true } });
    await this.alerts.notify(
      companyId,
      team.map((m) => m.id),
      { kind: 'announcement', title: `${KIND_LABEL[created.kind] ?? 'Comunicado'}: ${created.title}`, body: excerpt(created.body, 140), href: `comunicados/${created.id}` },
    );
    if (dto.notify) await this.notifyTeam(me, created);
    return created;
  }

  private async notifyTeam(me: Member, a: { id: string; kind: string; title: string; body: string }) {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId: me.company.id, status: 'active', id: { not: me.id } },
      orderBy: { createdAt: 'asc' },
      take: MAX_EMAILS,
      select: { user: { select: { email: true } } },
    });
    const url = this.email.announcementUrl(me.company.id, a.id);
    for (const m of members) {
      void this.email.sendCompanyAnnouncement(m.user.email, {
        companyName: me.company.name,
        kindLabel: KIND_LABEL[a.kind] ?? 'Comunicado',
        title: a.title,
        excerpt: excerpt(a.body, 400),
        url,
      });
    }
  }

  async get(userId: string, companyId: string, announcementId: string) {
    const me = await this.access(userId, companyId);
    const a = await this.prisma.announcement.findFirst({ where: { id: announcementId, companyId }, select: baseSelect });
    if (!a) throw new NotFoundException('Comunicado no encontrado');
    await this.prisma.announcementRead.upsert({
      where: { announcementId_memberId: { announcementId: a.id, memberId: me.id } },
      create: { announcementId: a.id, memberId: me.id },
      update: {},
    });
    const who = await this.authors([a.authorId]);
    const manage = atLeast(me.role, 'hr');
    // Quién lo leyó y quién no: solo para quien publica.
    let readers: { name: string; readAt: Date }[] | undefined;
    let pending: string[] | undefined;
    if (manage) {
      const [reads, members] = await Promise.all([
        this.prisma.announcementRead.findMany({
          where: { announcementId: a.id, member: { status: 'active' } },
          orderBy: { readAt: 'asc' },
          select: { memberId: true, readAt: true, member: { select: { user: { select: { firstName: true, lastName: true, email: true } } } } },
        }),
        this.prisma.companyMember.findMany({
          where: { companyId, status: 'active' },
          select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
        }),
      ]);
      const readIds = new Set(reads.map((r) => r.memberId));
      readers = reads.map((r) => ({ name: name(r.member.user), readAt: r.readAt }));
      pending = members.filter((m) => !readIds.has(m.id)).map((m) => name(m.user));
    }
    const { authorId, ...rest } = a;
    return { ...rest, author: authorId ? (who.get(authorId) ?? null) : null, can: { manage }, readers, pending };
  }

  async update(userId: string, companyId: string, announcementId: string, dto: UpdateAnnouncementDto) {
    await this.access(userId, companyId, 'hr');
    const { count } = await this.prisma.announcement.updateMany({
      where: { id: announcementId, companyId },
      data: {
        kind: dto.kind,
        title: dto.title,
        body: dto.body,
        eventAt: dto.eventAt === undefined ? undefined : dto.eventAt ? new Date(dto.eventAt) : null,
        eventPlace: dto.eventPlace === undefined ? undefined : dto.eventPlace || null,
        pinned: dto.pinned,
      },
    });
    if (count === 0) throw new NotFoundException('Comunicado no encontrado');
    return this.prisma.announcement.findUniqueOrThrow({ where: { id: announcementId }, select: baseSelect });
  }

  async remove(userId: string, companyId: string, announcementId: string) {
    await this.access(userId, companyId, 'hr');
    const { count } = await this.prisma.announcement.deleteMany({ where: { id: announcementId, companyId } });
    if (count === 0) throw new NotFoundException('Comunicado no encontrado');
  }
}
