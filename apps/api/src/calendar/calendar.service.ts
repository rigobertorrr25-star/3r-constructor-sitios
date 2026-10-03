import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { COMPANY_ROLES, atLeast, roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CALENDAR_MODULE, MAX_RANGE_DAYS } from './calendar.constants.js';
import type { CreateEventDto, UpdateEventDto } from './dto/calendar.dto.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;

/** Lo que muestra el calendario, venga de donde venga. Fechas sin hora (`allDay`) en AAAA-MM-DD. */
export type CalendarItem = {
  id: string;
  source: 'event' | 'leave' | 'birthday' | 'announcement' | 'document' | 'contract';
  kind: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  /** Ruta dentro de /empresa/[id] para abrir el detalle. */
  href?: string;
  can?: { edit: boolean };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (d: Date) => d.toISOString().slice(0, 10);
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
/** Inicio del día en Colombia (UTC-5, sin horario de verano). */
const bogotaStart = (iso: string) => new Date(`${iso}T00:00:00-05:00`);
const LEAVE_LABEL: Record<string, string> = { vacation: 'Vacaciones', permission: 'Permiso', sick_leave: 'Incapacidad' };

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  private async access(userId: string, companyId: string) {
    const member = await this.companies.requireMember(userId, companyId);
    await this.companies.requireModule(companyId, CALENDAR_MODULE);
    return member;
  }

  private rolesBelow(me: Member) {
    return COMPANY_ROLES.filter((r) => me.role === 'owner' || roleRank(r) < roleRank(me.role));
  }

  /** Editar o borrar: quien lo creó; un evento de la empresa, también un administrador. */
  private canEdit(me: Member, userId: string, e: { createdById: string; personal: boolean }) {
    return e.createdById === userId || (!e.personal && atLeast(me.role, 'admin'));
  }

  private range(from: string, to: string) {
    if (!DATE.test(from ?? '') || !DATE.test(to ?? '')) throw new BadRequestException('Escribe las fechas como AAAA-MM-DD');
    const start = bogotaStart(from);
    const end = bogotaStart(to);
    if (Number.isNaN(+start) || Number.isNaN(+end) || end < start) throw new BadRequestException('Rango de fechas no válido');
    if ((+end - +start) / 86_400_000 > MAX_RANGE_DAYS) throw new BadRequestException(`Pide máximo ${MAX_RANGE_DAYS} días a la vez`);
    // `to` incluido: hasta el final de ese día.
    return { start, end: new Date(+end + 86_400_000 - 1), from, to };
  }

  async list(userId: string, companyId: string, from: string, to: string) {
    const me = await this.access(userId, companyId);
    return this.collect(me, userId, companyId, this.range(from, to));
  }

  /** Lo de los próximos 14 días, para el inicio de la empresa. */
  async upcoming(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const until = day(new Date(+new Date(`${today}T00:00:00Z`) + 13 * 86_400_000));
    const items = await this.collect(me, userId, companyId, this.range(today, until));
    return items.slice(0, 12);
  }

  private async collect(me: Member, userId: string, companyId: string, r: { start: Date; end: Date; from: string; to: string }) {
    const enabled = new Set((await this.prisma.companyModule.findMany({ where: { companyId }, select: { key: true } })).map((m) => m.key));
    const hr = atLeast(me.role, 'hr');
    const fromDate = new Date(`${r.from}T00:00:00Z`);
    const toDate = new Date(`${r.to}T00:00:00Z`);
    const items: CalendarItem[] = [];

    const events = await this.prisma.calendarEvent.findMany({
      where: {
        companyId,
        startsAt: { lte: r.end },
        OR: [{ endsAt: { gte: r.start } }, { endsAt: null, startsAt: { gte: r.start } }],
        AND: [{ OR: [{ personal: false }, { createdById: userId }] }],
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
    });
    for (const e of events) {
      items.push({
        id: e.id,
        source: 'event',
        kind: e.personal ? 'reminder' : e.kind,
        title: e.title,
        start: e.allDay ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(e.startsAt) : e.startsAt.toISOString(),
        end: e.endsAt ? (e.allDay ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(e.endsAt) : e.endsAt.toISOString()) : null,
        allDay: e.allDay,
        location: e.location,
        description: e.description,
        can: { edit: this.canEdit(me, userId, e) },
      });
    }

    if (enabled.has('requests')) {
      // Vacaciones de todo el equipo; permisos e incapacidades solo los propios o de quienes tengo a cargo.
      const below = atLeast(me.role, 'supervisor') ? this.rolesBelow(me) : [];
      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          status: 'approved',
          type: { in: ['vacation', 'permission', 'sick_leave'] },
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
          OR: [{ type: 'vacation' }, { memberId: me.id }, ...(below.length ? [{ member: { role: { in: below } } }] : [])],
        },
        take: 500,
        select: { id: true, type: true, startDate: true, endDate: true, memberId: true, member: { select: { user: { select: { firstName: true, lastName: true, email: true } } } } },
      });
      for (const l of leaves) {
        const mine = l.memberId === me.id;
        items.push({
          id: l.id,
          source: 'leave',
          kind: l.type,
          title: `${LEAVE_LABEL[l.type]}: ${name(l.member.user)}`,
          start: day(l.startDate!),
          end: day(l.endDate!),
          allDay: true,
          href: mine || atLeast(me.role, 'supervisor') ? `solicitudes/${l.id}` : undefined,
        });
      }
    }

    if (enabled.has('employees')) {
      const people = await this.prisma.companyMember.findMany({
        where: { companyId, status: 'active' },
        select: { id: true, role: true, user: { select: { firstName: true, lastName: true, email: true } }, profile: { select: { birthDate: true, contractEnd: true } } },
      });
      const years = [...new Set([fromDate.getUTCFullYear(), toDate.getUTCFullYear()])];
      for (const p of people) {
        const birth = p.profile?.birthDate;
        if (birth) {
          for (const y of years) {
            const mmdd = day(birth).slice(5);
            // 29 de febrero en año no bisiesto: el 28.
            const iso = mmdd === '02-29' && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1 ? `${y}-02-28` : `${y}-${mmdd}`;
            if (iso >= r.from && iso <= r.to) items.push({ id: `birthday-${p.id}-${y}`, source: 'birthday', kind: 'birthday', title: `Cumpleaños de ${name(p.user)}`, start: iso, end: null, allDay: true });
          }
        }
        const end = p.profile?.contractEnd;
        if (hr && end && (me.role === 'owner' || roleRank(me.role) > roleRank(p.role))) {
          const iso = day(end);
          if (iso >= r.from && iso <= r.to) {
            items.push({ id: `contract-${p.id}`, source: 'contract', kind: 'deadline', title: `Vence el contrato de ${name(p.user)}`, start: iso, end: null, allDay: true, href: `personal/${p.id}` });
          }
        }
      }
    }

    if (enabled.has('announcements')) {
      const ann = await this.prisma.announcement.findMany({
        where: { companyId, kind: 'event', eventAt: { gte: r.start, lte: r.end } },
        take: 200,
        select: { id: true, title: true, eventAt: true, eventPlace: true },
      });
      for (const a of ann) items.push({ id: a.id, source: 'announcement', kind: 'event', title: a.title, start: a.eventAt!.toISOString(), end: null, allDay: false, location: a.eventPlace, href: `comunicados/${a.id}` });
    }

    if (enabled.has('documents') && hr) {
      const docs = await this.prisma.companyDocument.findMany({
        where: { companyId, status: 'ready', expiresOn: { gte: fromDate, lte: toDate } },
        take: 200,
        select: { id: true, title: true, expiresOn: true, memberId: true, member: { select: { role: true } } },
      });
      for (const d of docs) {
        if (d.member && !(me.role === 'owner' || roleRank(me.role) > roleRank(d.member.role)) && d.memberId !== me.id) continue;
        items.push({
          id: d.id,
          source: 'document',
          kind: 'deadline',
          title: `Vence: ${d.title}`,
          start: day(d.expiresOn!),
          end: null,
          allDay: true,
          href: `documentos${d.memberId ? `?member=${d.memberId}` : ''}`,
        });
      }
    }

    // Por fecha; los de todo el día primero.
    const key = (i: CalendarItem) => (i.allDay ? `${i.start}T00:00` : new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(i.start)).replace(' ', 'T'));
    return items.sort((a, b) => key(a).localeCompare(key(b)) || Number(b.allDay) - Number(a.allDay) || a.title.localeCompare(b.title));
  }

  private parse(dto: { startsAt?: string; endsAt?: string | null; allDay?: boolean }) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
    const endsAt = dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null;
    if (startsAt && endsAt && endsAt < startsAt) throw new BadRequestException('El final va después del inicio');
    return { startsAt, endsAt };
  }

  async create(userId: string, companyId: string, dto: CreateEventDto) {
    const me = await this.access(userId, companyId);
    const personal = dto.personal ?? false;
    if (!personal && !atLeast(me.role, 'supervisor')) throw new ForbiddenException('Solo supervisores en adelante crean eventos para todo el equipo. Puedes crear un recordatorio personal.');
    const { startsAt, endsAt } = this.parse(dto);
    const e = await this.prisma.calendarEvent.create({
      data: {
        companyId,
        kind: personal ? 'reminder' : (dto.kind ?? 'meeting'),
        title: dto.title,
        description: dto.description || null,
        location: dto.location || null,
        startsAt: startsAt!,
        endsAt: endsAt ?? null,
        allDay: dto.allDay ?? false,
        personal,
        createdById: userId,
      },
    });
    return { id: e.id };
  }

  private async findEditable(me: Member, userId: string, companyId: string, eventId: string) {
    const e = await this.prisma.calendarEvent.findFirst({ where: { id: eventId, companyId, OR: [{ personal: false }, { createdById: userId }] } });
    if (!e) throw new NotFoundException('Evento no encontrado');
    if (!this.canEdit(me, userId, e)) throw new ForbiddenException('Solo quien lo creó o un administrador lo cambia');
    return e;
  }

  async update(userId: string, companyId: string, eventId: string, dto: UpdateEventDto) {
    const me = await this.access(userId, companyId);
    const e = await this.findEditable(me, userId, companyId, eventId);
    const { startsAt, endsAt } = this.parse({ startsAt: dto.startsAt ?? e.startsAt.toISOString(), endsAt: dto.endsAt === undefined ? e.endsAt?.toISOString() : dto.endsAt });
    await this.prisma.calendarEvent.update({
      where: { id: e.id },
      data: {
        kind: e.personal ? undefined : dto.kind,
        title: dto.title,
        description: dto.description === undefined ? undefined : dto.description || null,
        location: dto.location === undefined ? undefined : dto.location || null,
        startsAt,
        endsAt,
        allDay: dto.allDay,
      },
    });
    return { id: e.id };
  }

  async remove(userId: string, companyId: string, eventId: string) {
    const me = await this.access(userId, companyId);
    const e = await this.findEditable(me, userId, companyId, eventId);
    await this.prisma.calendarEvent.delete({ where: { id: e.id } });
  }
}
