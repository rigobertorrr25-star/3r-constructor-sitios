import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CRM_MODULE, CRM_STAGES, STAGE_LABEL } from './crm.constants.js';
import type { CreateActivityDto, CreateContactDto, UpdateContactDto } from './dto/crm.dto.js';

const contactSelect = {
  id: true,
  name: true,
  organization: true,
  email: true,
  phone: true,
  stage: true,
  valueCents: true,
  source: true,
  notes: true,
  ownerMemberId: true,
  lastContactAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Sale vacío como null, y el valor de pesos a centavos. */
const clean = (v: string | undefined) => (v === undefined ? undefined : v || null);
const cents = (pesos: number | null | undefined) => (pesos === undefined ? undefined : pesos === null ? null : pesos * 100);

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  /** Cualquier miembro activo usa el CRM si la empresa lo tiene activo. Borrar exige administrador. */
  private async access(userId: string, companyId: string, min: 'employee' | 'admin' = 'employee') {
    const member = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, CRM_MODULE);
    return member;
  }

  private async checkOwner(companyId: string, ownerMemberId: string | null | undefined) {
    if (!ownerMemberId) return;
    const owner = await this.prisma.companyMember.findFirst({ where: { id: ownerMemberId, companyId, status: 'active' }, select: { id: true } });
    if (!owner) throw new BadRequestException('El responsable tiene que ser alguien activo de la empresa');
  }

  async list(userId: string, companyId: string, filters: { stage?: string; q?: string }) {
    await this.access(userId, companyId);
    const q = filters.q?.trim();
    return this.prisma.crmContact.findMany({
      where: {
        companyId,
        ...(filters.stage && (CRM_STAGES as readonly string[]).includes(filters.stage) ? { stage: filters.stage } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { organization: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: contactSelect,
    });
  }

  /** Cuántos clientes y cuánto valor hay en cada etapa. Lo usa el tablero y el inicio de la empresa. */
  async summary(userId: string, companyId: string) {
    await this.access(userId, companyId);
    const groups = await this.prisma.crmContact.groupBy({ by: ['stage'], where: { companyId }, _count: { _all: true }, _sum: { valueCents: true } });
    const stages = CRM_STAGES.map((stage) => {
      const g = groups.find((x) => x.stage === stage);
      return { stage, count: g?._count._all ?? 0, valueCents: g?._sum.valueCents ?? 0 };
    });
    const open = stages.filter((s) => s.stage !== 'won' && s.stage !== 'lost');
    return {
      stages,
      total: stages.reduce((n, s) => n + s.count, 0),
      openCount: open.reduce((n, s) => n + s.count, 0),
      openValueCents: open.reduce((n, s) => n + s.valueCents, 0),
      wonValueCents: stages.find((s) => s.stage === 'won')!.valueCents,
    };
  }

  async create(userId: string, companyId: string, dto: CreateContactDto) {
    await this.access(userId, companyId);
    await this.checkOwner(companyId, dto.ownerMemberId);
    return this.prisma.crmContact.create({
      data: {
        companyId,
        name: dto.name,
        organization: clean(dto.organization),
        email: clean(dto.email)?.toLowerCase() ?? null,
        phone: clean(dto.phone),
        stage: dto.stage ?? 'lead',
        source: dto.source ?? 'manual',
        valueCents: cents(dto.value) ?? null,
        notes: clean(dto.notes),
        ownerMemberId: dto.ownerMemberId || null,
        createdById: userId,
      },
      select: contactSelect,
    });
  }

  async get(userId: string, companyId: string, contactId: string) {
    await this.access(userId, companyId);
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
      select: {
        ...contactSelect,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { id: true, kind: true, body: true, createdAt: true, userId: true },
        },
      },
    });
    if (!contact) throw new NotFoundException('Cliente no encontrado');
    // Nombre de quien registró cada actividad (puede ya no estar en la empresa).
    const ids = [...new Set(contact.activities.map((a) => a.userId).filter((x): x is string => !!x))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, email: true } }) : [];
    const who = new Map(users.map((u) => [u.id, u.firstName || u.email]));
    return { ...contact, activities: contact.activities.map((a) => ({ ...a, author: a.userId ? (who.get(a.userId) ?? null) : null, userId: undefined })) };
  }

  async update(userId: string, companyId: string, contactId: string, dto: UpdateContactDto) {
    await this.access(userId, companyId);
    const current = await this.prisma.crmContact.findFirst({ where: { id: contactId, companyId }, select: { id: true, stage: true } });
    if (!current) throw new NotFoundException('Cliente no encontrado');
    if (dto.ownerMemberId !== undefined) await this.checkOwner(companyId, dto.ownerMemberId);

    const stageChanged = dto.stage !== undefined && dto.stage !== current.stage;
    const [contact] = await this.prisma.$transaction([
      this.prisma.crmContact.update({
        where: { id: current.id },
        data: {
          name: dto.name,
          organization: clean(dto.organization),
          email: dto.email === undefined ? undefined : dto.email ? dto.email.toLowerCase() : null,
          phone: clean(dto.phone),
          stage: dto.stage,
          source: dto.source,
          valueCents: cents(dto.value),
          notes: clean(dto.notes),
          ownerMemberId: dto.ownerMemberId === undefined ? undefined : dto.ownerMemberId || null,
        },
        select: contactSelect,
      }),
      ...(stageChanged
        ? [
            this.prisma.crmActivity.create({
              data: { companyId, contactId: current.id, userId, kind: 'stage', body: `${STAGE_LABEL[current.stage]} → ${STAGE_LABEL[dto.stage!]}` },
            }),
          ]
        : []),
    ]);
    return contact;
  }

  async remove(userId: string, companyId: string, contactId: string) {
    await this.access(userId, companyId, 'admin');
    const { count } = await this.prisma.crmContact.deleteMany({ where: { id: contactId, companyId } });
    if (count === 0) throw new NotFoundException('Cliente no encontrado');
  }

  async addActivity(userId: string, companyId: string, contactId: string, dto: CreateActivityDto) {
    await this.access(userId, companyId);
    const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, companyId }, select: { id: true } });
    if (!contact) throw new NotFoundException('Cliente no encontrado');
    const now = new Date();
    const [activity] = await this.prisma.$transaction([
      this.prisma.crmActivity.create({
        data: { companyId, contactId, userId, kind: dto.kind, body: dto.body, createdAt: now },
        select: { id: true, kind: true, body: true, createdAt: true },
      }),
      // Una llamada, un correo, un WhatsApp o una reunión cuentan como último contacto; una nota no.
      ...(dto.kind !== 'note' ? [this.prisma.crmContact.update({ where: { id: contactId }, data: { lastContactAt: now } })] : []),
    ]);
    return activity;
  }
}
