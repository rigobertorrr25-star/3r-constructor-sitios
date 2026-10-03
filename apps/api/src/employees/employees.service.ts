import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { atLeast, roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateProfileDto } from './dto/employees.dto.js';
import { EMPLOYEES_MODULE, PERSONAL_FIELDS, WORK_FIELDS } from './employees.constants.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;

const userSelect = { select: { id: true, email: true, firstName: true, lastName: true } } as const;
/** "2026-11-10" → fecha (sin hora); "" → null. Falla si la fecha no existe (31 de febrero). */
const toDate = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Esa fecha no existe');
  return date;
};
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
/** Fecha de hoy en Colombia, "AAAA-MM-DD". */
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly audit: AuditService,
  ) {}

  private async access(userId: string, companyId: string) {
    const member = await this.companies.requireMember(userId, companyId);
    await this.companies.requireModule(companyId, EMPLOYEES_MODULE);
    return member;
  }

  /**
   * Qué puede hacer `me` con la ficha de `target`:
   * - personal: la propia, o RR. HH. en adelante sobre alguien de menor rango.
   * - work (contrato, salario, notas de RR. HH.): RR. HH. en adelante sobre alguien de menor rango; el dueño también la suya.
   */
  private can(me: Member, target: { id: string; role: string }) {
    const self = me.id === target.id;
    const above = me.role === 'owner' || roleRank(me.role) > roleRank(target.role);
    const hr = atLeast(me.role, 'hr');
    return { view: self || (hr && above), personal: self || (hr && above), work: hr && above };
  }

  /** Directorio para todo el equipo: sin datos privados. El cumpleaños sale sin año y el teléfono solo si la persona lo permite. */
  async directory(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const rows = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        jobTitle: true,
        area: true,
        hiredAt: true,
        user: userSelect,
        profile: { select: { birthDate: true, phone: true, showPhone: true } },
      },
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      jobTitle: m.jobTitle,
      area: m.area,
      hiredAt: day(m.hiredAt),
      user: m.user,
      birthday: m.profile?.birthDate ? day(m.profile.birthDate)!.slice(5) : null,
      phone: m.profile?.showPhone ? m.profile.phone : null,
      canView: this.can(me, m).view,
    }));
  }

  /** Cumpleaños del mes para todos; fichas incompletas y contratos por vencer para RR. HH. */
  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const today = todayBogota();
    const month = today.slice(5, 7);
    const rows = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      select: { id: true, role: true, profile: { select: { birthDate: true, documentNumber: true, emergencyPhone: true, contractEnd: true } } },
    });
    const birthdaysThisMonth = rows.filter((m) => m.profile?.birthDate && day(m.profile.birthDate)!.slice(5, 7) === month).length;
    if (!atLeast(me.role, 'hr')) return { people: rows.length, birthdaysThisMonth };
    const in30 = new Date(`${today}T00:00:00Z`);
    in30.setUTCDate(in30.getUTCDate() + 30);
    const limit = day(in30)!;
    return {
      people: rows.length,
      birthdaysThisMonth,
      incompleteProfiles: rows.filter((m) => !m.profile?.documentNumber || !m.profile?.emergencyPhone).length,
      contractsEnding: rows.filter((m) => {
        const end = day(m.profile?.contractEnd ?? null);
        return end !== null && end >= today && end <= limit;
      }).length,
    };
  }

  private async target(companyId: string, memberId: string) {
    const target = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      select: { id: true, role: true, status: true, jobTitle: true, area: true, hiredAt: true, user: userSelect, profile: true },
    });
    if (!target) throw new NotFoundException('Esa persona no está en la empresa');
    return target;
  }

  async get(userId: string, companyId: string, memberId: string) {
    const me = await this.access(userId, companyId);
    const target = await this.target(companyId, memberId);
    const can = this.can(me, target);
    // Sin permiso, la ficha no existe para quien pregunta.
    if (!can.view) throw new NotFoundException('Ficha no encontrada');
    return this.shape(target, can);
  }

  private shape(target: Awaited<ReturnType<EmployeesService['target']>>, can: ReturnType<EmployeesService['can']>) {
    const p = target.profile;
    return {
      id: target.id,
      role: target.role,
      status: target.status,
      jobTitle: target.jobTitle,
      area: target.area,
      hiredAt: day(target.hiredAt),
      user: target.user,
      personal: {
        documentType: p?.documentType ?? null,
        documentNumber: p?.documentNumber ?? null,
        phone: p?.phone ?? null,
        showPhone: p?.showPhone ?? false,
        birthDate: day(p?.birthDate ?? null),
        address: p?.address ?? null,
        city: p?.city ?? null,
        emergencyName: p?.emergencyName ?? null,
        emergencyPhone: p?.emergencyPhone ?? null,
        emergencyRelation: p?.emergencyRelation ?? null,
        eps: p?.eps ?? null,
        pensionFund: p?.pensionFund ?? null,
      },
      // El empleado ve su contrato y salario, pero no las notas de RR. HH.
      work: {
        contractType: p?.contractType ?? null,
        contractEnd: day(p?.contractEnd ?? null),
        salary: p?.salary ?? null,
        schedule: p?.schedule ?? null,
        ...(can.work ? { hrNotes: p?.hrNotes ?? null } : {}),
      },
      updatedAt: p?.updatedAt ?? null,
      can: { personal: can.personal, work: can.work },
    };
  }

  async update(userId: string, companyId: string, memberId: string, dto: UpdateProfileDto) {
    const me = await this.access(userId, companyId);
    const target = await this.target(companyId, memberId);
    const can = this.can(me, target);
    if (!can.view) throw new NotFoundException('Ficha no encontrada');
    const touches = (fields: readonly string[]) => fields.some((f) => (dto as Record<string, unknown>)[f] !== undefined);
    if (touches(PERSONAL_FIELDS) && !can.personal) throw new ForbiddenException('No puedes editar los datos personales de esta persona');
    if (touches(WORK_FIELDS) && !can.work) throw new ForbiddenException('Solo Recursos Humanos cambia el contrato y el salario');

    const text = (v: string | undefined) => (v === undefined ? undefined : v || null);
    const date = (v: string | undefined) => (v === undefined ? undefined : toDate(v));
    const data = {
      documentType: text(dto.documentType),
      documentNumber: text(dto.documentNumber),
      phone: text(dto.phone),
      showPhone: dto.showPhone,
      birthDate: date(dto.birthDate),
      address: text(dto.address),
      city: text(dto.city),
      emergencyName: text(dto.emergencyName),
      emergencyPhone: text(dto.emergencyPhone),
      emergencyRelation: text(dto.emergencyRelation),
      eps: text(dto.eps),
      pensionFund: text(dto.pensionFund),
      contractType: text(dto.contractType),
      contractEnd: date(dto.contractEnd),
      salary: dto.salary,
      schedule: text(dto.schedule),
      hrNotes: text(dto.hrNotes),
    };
    await this.prisma.employeeProfile.upsert({ where: { memberId: target.id }, create: { memberId: target.id, companyId, ...data }, update: data });
    // Contrato y salario son datos sensibles: queda constancia de quién los cambió (sin guardar el valor).
    if (touches(WORK_FIELDS)) {
      await this.audit.log({
        action: 'EMPLOYEE_WORK_UPDATED',
        userId,
        entityType: 'company',
        entityId: companyId,
        metadata: { memberId: target.id, fields: WORK_FIELDS.filter((f) => dto[f] !== undefined) },
      });
    }
    return this.shape(await this.target(companyId, memberId), can);
  }
}
