import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { COMPANY_ROLES, atLeast, roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRequestDto, DecideRequestDto } from './dto/requests.dto.js';
import { ABSENCE_TYPES, HR_ONLY_TYPES, MAX_RANGE_DAYS, OPEN_STATUSES, REQUESTS_MODULE, REQUEST_TYPES, TYPE_LABEL } from './requests.constants.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;

const personSelect = { select: { id: true, role: true, jobTitle: true, user: { select: { firstName: true, lastName: true, email: true } } } } as const;
const requestSelect = {
  id: true,
  type: true,
  startDate: true,
  endDate: true,
  days: true,
  reason: true,
  status: true,
  supervisorAt: true,
  supervisorNote: true,
  hrAt: true,
  hrNote: true,
  createdAt: true,
  updatedAt: true,
  memberId: true,
  member: personSelect,
} as const;

type Row = Prisma.LeaveRequestGetPayload<{ select: typeof requestSelect }>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Esa fecha no existe');
  return date;
};
/** Días entre dos fechas (incluidas) sin contar domingos. */
const daysWithoutSundays = (start: Date, end: Date) => {
  let n = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() !== 0) n++;
  return n;
};
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const shortDate = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly email: EmailService,
  ) {}

  private async access(userId: string, companyId: string) {
    const member = await this.companies.requireMember(userId, companyId);
    await this.companies.requireModule(companyId, REQUESTS_MODULE);
    return member;
  }

  /** Roles por debajo del mío (el dueño, todos). Sobre ellos puedo aprobar y ver solicitudes. */
  private rolesBelow(me: Member) {
    return COMPANY_ROLES.filter((r) => me.role === 'owner' || roleRank(r) < roleRank(me.role));
  }

  /** Las mías, y si soy supervisor en adelante, las de quienes tienen menor rango. */
  private scope(me: Member, companyId: string): Prisma.LeaveRequestWhereInput {
    if (!atLeast(me.role, 'supervisor')) return { companyId, memberId: me.id };
    return { companyId, OR: [{ memberId: me.id }, { member: { role: { in: this.rolesBelow(me) } } }] };
  }

  /** Puedo decidir si está en mi paso: el supervisor (o más) en `pending`, RR. HH. (o más) en `supervisor_ok`; siempre sobre alguien de menor rango. */
  private canDecide(me: Member, r: { status: string; memberId: string; member: { role: string } }) {
    const above = me.role === 'owner' || roleRank(me.role) > roleRank(r.member.role);
    if (!above || (r.memberId === me.id && me.role !== 'owner')) return false;
    if (r.status === 'pending') return atLeast(me.role, 'supervisor');
    if (r.status === 'supervisor_ok') return atLeast(me.role, 'hr');
    return false;
  }

  /** Quién decide cada paso: para no buscar en el inicio a quien no le toca. */
  private toDecideWhere(me: Member, companyId: string): Prisma.LeaveRequestWhereInput {
    const steps = [atLeast(me.role, 'supervisor') ? 'pending' : null, atLeast(me.role, 'hr') ? 'supervisor_ok' : null].filter((s): s is string => !!s);
    if (!steps.length) return { id: { in: [] } };
    return {
      companyId,
      status: { in: steps },
      member: { role: { in: this.rolesBelow(me) } },
      ...(me.role === 'owner' ? {} : { memberId: { not: me.id } }),
    };
  }

  private shape(me: Member, r: Row) {
    return {
      id: r.id,
      type: r.type,
      startDate: day(r.startDate),
      endDate: day(r.endDate),
      days: r.days,
      reason: r.reason,
      status: r.status,
      supervisorAt: r.supervisorAt,
      supervisorNote: r.supervisorNote,
      hrAt: r.hrAt,
      hrNote: r.hrNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      member: { id: r.member.id, role: r.member.role, jobTitle: r.member.jobTitle, name: name(r.member.user) },
      can: { decide: this.canDecide(me, r), cancel: r.memberId === me.id && OPEN_STATUSES.includes(r.status) },
    };
  }

  async list(userId: string, companyId: string, filters: { view?: string; type?: string }) {
    const me = await this.access(userId, companyId);
    const view: Prisma.LeaveRequestWhereInput =
      filters.view === 'to_decide' ? this.toDecideWhere(me, companyId) : filters.view === 'all' ? this.scope(me, companyId) : { companyId, memberId: me.id };
    const rows = await this.prisma.leaveRequest.findMany({
      where: { AND: [view, filters.type && (REQUEST_TYPES as readonly string[]).includes(filters.type) ? { type: filters.type } : {}] },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: requestSelect,
    });
    return rows.map((r) => this.shape(me, r));
  }

  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const today = new Date(`${todayBogota()}T00:00:00Z`);
    const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const [toDecide, myOpen, absent, vacations] = await Promise.all([
      this.prisma.leaveRequest.count({ where: this.toDecideWhere(me, companyId) }),
      this.prisma.leaveRequest.count({ where: { companyId, memberId: me.id, status: { in: OPEN_STATUSES } } }),
      // Quién no está hoy (dentro de lo que puedo ver).
      this.prisma.leaveRequest.findMany({
        where: { AND: [this.scope(me, companyId), { status: 'approved', type: { in: ABSENCE_TYPES }, startDate: { lte: today }, endDate: { gte: today } }] },
        select: { type: true, endDate: true, member: personSelect },
        take: 100,
      }),
      this.prisma.leaveRequest.aggregate({
        where: { companyId, memberId: me.id, status: 'approved', type: 'vacation', startDate: { gte: yearStart } },
        _sum: { days: true },
      }),
    ]);
    return {
      toDecide,
      myOpen,
      myVacationDaysThisYear: vacations._sum.days ?? 0,
      absentToday: absent.map((a) => ({ name: name(a.member.user), type: a.type, until: day(a.endDate) })),
    };
  }

  async create(userId: string, companyId: string, dto: CreateRequestDto) {
    const me = await this.access(userId, companyId);
    const needsDates = dto.type !== 'certificate';
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (dto.startDate) startDate = toDate(dto.startDate);
    if (dto.endDate) endDate = toDate(dto.endDate);
    if (needsDates && !startDate) throw new BadRequestException('Elige desde qué día');
    if (startDate && !endDate) endDate = startDate;
    if (startDate && endDate) {
      if (endDate < startDate) throw new BadRequestException('La fecha final va después de la inicial');
      if ((+endDate - +startDate) / 86_400_000 + 1 > MAX_RANGE_DAYS) throw new BadRequestException(`Una solicitud cubre máximo ${MAX_RANGE_DAYS} días`);
    }
    // Un certificado va directo a RR. HH.; si quien pide ya es RR. HH. o más, igual espera a alguien de mayor rango.
    const status = HR_ONLY_TYPES.includes(dto.type) ? 'supervisor_ok' : 'pending';
    const request = await this.prisma.leaveRequest.create({
      data: {
        companyId,
        memberId: me.id,
        type: dto.type,
        startDate,
        endDate,
        days: startDate && endDate ? daysWithoutSundays(startDate, endDate) : 0,
        reason: dto.reason,
        status,
      },
      select: requestSelect,
    });
    await this.notifyDeciders(me, request);
    return this.shape(me, request);
  }

  /** Avisa por correo a quienes les toca decidir el paso actual (máximo 10). */
  private async notifyDeciders(me: Member, r: Row) {
    const minRole = r.status === 'pending' ? 'supervisor' : 'hr';
    const roles = COMPANY_ROLES.filter((role) => atLeast(role, minRole) && (role === 'owner' || roleRank(role) > roleRank(r.member.role)));
    const deciders = await this.prisma.companyMember.findMany({
      where: { companyId: me.company.id, status: 'active', role: { in: roles }, id: { not: r.memberId } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { user: { select: { email: true } } },
    });
    const dates = r.startDate ? (r.endDate && +r.endDate !== +r.startDate ? `${shortDate(r.startDate)} al ${shortDate(r.endDate)}` : shortDate(r.startDate)) : '';
    const url = this.email.requestUrl(me.company.id, r.id);
    for (const d of deciders) {
      void this.email.sendLeaveRequestPending(d.user.email, {
        companyName: me.company.name,
        personName: name(r.member.user),
        typeLabel: TYPE_LABEL[r.type],
        dates,
        requestUrl: url,
      });
    }
  }

  private async find(me: Member, companyId: string, requestId: string) {
    const r = await this.prisma.leaveRequest.findFirst({ where: { AND: [{ id: requestId }, this.scope(me, companyId)] }, select: requestSelect });
    if (!r) throw new NotFoundException('Solicitud no encontrada');
    return r;
  }

  async get(userId: string, companyId: string, requestId: string) {
    const me = await this.access(userId, companyId);
    const r = await this.find(me, companyId, requestId);
    // Quién decidió cada paso (pueden ya no estar en la empresa).
    const full = await this.prisma.leaveRequest.findUniqueOrThrow({ where: { id: r.id }, select: { supervisorById: true, hrById: true } });
    const ids = [full.supervisorById, full.hrById].filter((x): x is string => !!x);
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [];
    const who = (id: string | null) => {
      const u = users.find((x) => x.id === id);
      return u ? name(u) : null;
    };
    return { ...this.shape(me, r), supervisorBy: who(full.supervisorById), hrBy: who(full.hrById) };
  }

  async decide(userId: string, companyId: string, requestId: string, dto: DecideRequestDto) {
    const me = await this.access(userId, companyId);
    const r = await this.find(me, companyId, requestId);
    if (!this.canDecide(me, r)) throw new ForbiddenException(OPEN_STATUSES.includes(r.status) ? 'Esta solicitud no te toca decidirla' : 'Esta solicitud ya se cerró');
    const now = new Date();
    const note = dto.note || null;
    const approve = dto.decision === 'approve';
    // RR. HH. (o más) que decide en el primer paso cierra los dos de una vez.
    const finalStep = r.status === 'supervisor_ok' || atLeast(me.role, 'hr');
    const data: Prisma.LeaveRequestUpdateInput =
      r.status === 'pending'
        ? {
            supervisorById: userId,
            supervisorAt: now,
            supervisorNote: note,
            status: !approve ? 'rejected' : finalStep ? 'approved' : 'supervisor_ok',
            ...(approve && finalStep ? { hrById: userId, hrAt: now } : {}),
          }
        : { hrById: userId, hrAt: now, hrNote: note, status: approve ? 'approved' : 'rejected' };
    // Solo cambia si sigue en el mismo paso (dos personas decidiendo a la vez).
    const { count } = await this.prisma.leaveRequest.updateMany({ where: { id: r.id, status: r.status }, data: data as Prisma.LeaveRequestUpdateManyMutationInput });
    if (count === 0) throw new BadRequestException('Alguien más acaba de decidir esta solicitud. Recarga la página.');
    const updated = await this.prisma.leaveRequest.findUniqueOrThrow({ where: { id: r.id }, select: requestSelect });

    if (updated.status === 'supervisor_ok') await this.notifyDeciders(me, updated);
    else {
      const requester = await this.prisma.companyMember.findFirst({ where: { id: r.memberId, status: 'active' }, select: { user: { select: { email: true } } } });
      if (requester && r.memberId !== me.id) {
        void this.email.sendLeaveRequestDecided(requester.user.email, {
          companyName: me.company.name,
          typeLabel: TYPE_LABEL[r.type],
          approved: updated.status === 'approved',
          note,
          requestUrl: this.email.requestUrl(companyId, r.id),
        });
      }
    }
    return this.shape(me, updated);
  }

  async cancel(userId: string, companyId: string, requestId: string) {
    const me = await this.access(userId, companyId);
    const r = await this.find(me, companyId, requestId);
    if (r.memberId !== me.id) throw new ForbiddenException('Solo quien pidió la solicitud la cancela');
    const { count } = await this.prisma.leaveRequest.updateMany({ where: { id: r.id, status: { in: OPEN_STATUSES } }, data: { status: 'cancelled' } });
    if (count === 0) throw new BadRequestException('Esta solicitud ya se decidió; habla con tu supervisor o con RR. HH.');
    return this.shape(me, await this.prisma.leaveRequest.findUniqueOrThrow({ where: { id: r.id }, select: requestSelect }));
  }
}
