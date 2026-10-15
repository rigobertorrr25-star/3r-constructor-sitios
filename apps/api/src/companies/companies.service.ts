import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { slugify, uniqueSlug } from '../common/slug.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  INVITE_TTL_MS,
  MAX_OWNED_COMPANIES,
  MODULES,
  atLeast,
  isReadyModule,
  roleRank,
  type CompanyRole,
} from './companies.constants.js';
import type { CreateCompanyDto, InviteMemberDto, UpdateCompanyDto, UpdateMemberDto } from './dto/company.dto.js';

const ROLE_LABEL: Record<string, string> = {
  owner: 'dueño',
  admin: 'administrador',
  hr: 'recursos humanos',
  supervisor: 'supervisor',
  employee: 'empleado',
};

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  area: true,
  hiredAt: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

/** "2026-11-10" → fecha (sin hora); "" → null. */
const toDate = (value: string) => (value ? new Date(`${value}T00:00:00Z`) : null);

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // ───────── acceso (lo usan también los módulos) ─────────

  /**
   * El miembro activo de `userId` en una empresa activa, con al menos el rol `min`. Si no pertenece, responde
   * "no encontrada" para no revelar que la empresa existe.
   */
  async requireMember(userId: string, companyId: string, min: CompanyRole = 'employee') {
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { id: true, role: true, status: true, company: { select: { id: true, name: true, status: true } } },
    });
    if (!member || member.status !== 'active') throw new NotFoundException('Empresa no encontrada');
    if (member.company.status !== 'active') throw new ForbiddenException('Esta empresa está suspendida. Escríbenos para reactivarla.');
    if (!atLeast(member.role, min)) throw new ForbiddenException('Tu rol en la empresa no permite esta acción');
    return member;
  }

  /** Falla si la empresa no tiene activo el módulo `key`. */
  async requireModule(companyId: string, key: string) {
    const found = await this.prisma.companyModule.findUnique({ where: { companyId_key: { companyId, key } }, select: { key: true } });
    if (!found) throw new ForbiddenException('Tu empresa no tiene activo este módulo');
  }

  // ───────── empresas ─────────

  async listMine(userId: string) {
    const rows = await this.prisma.companyMember.findMany({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        company: { select: { id: true, name: true, slug: true, city: true, industry: true, status: true, _count: { select: { members: true, modules: true } } } },
      },
    });
    return rows.map((r) => ({
      ...r.company,
      role: r.role,
      memberCount: r.company._count.members,
      moduleCount: r.company._count.modules,
      _count: undefined,
    }));
  }

  async create(userId: string, dto: CreateCompanyDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt) throw new ForbiddenException('Confirma tu correo antes de crear tu empresa');
    const owned = await this.prisma.companyMember.count({ where: { userId, role: 'owner' } });
    if (owned >= MAX_OWNED_COMPANIES) throw new ConflictException(`Puedes crear hasta ${MAX_OWNED_COMPANIES} empresas`);

    const slug = await uniqueSlug(slugify(dto.name, 'empresa'), async (candidate) =>
      (await this.prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })) !== null,
    );
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        slug,
        taxId: dto.taxId || null,
        city: dto.city || null,
        phone: dto.phone || null,
        industry: dto.industry || null,
        members: { create: { userId, role: 'owner' } },
      },
      select: { id: true },
    });
    await this.audit.log({ action: 'COMPANY_CREATED', userId, entityType: 'company', entityId: company.id, ipAddress: ip });
    return this.get(userId, company.id);
  }

  async get(userId: string, companyId: string) {
    const me = await this.requireMember(userId, companyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        taxId: true,
        city: true,
        phone: true,
        industry: true,
        status: true,
        createdAt: true,
        modules: { select: { key: true, enabledAt: true } },
        _count: { select: { members: { where: { status: 'active' } } } },
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const enabled = new Map(company.modules.map((m) => [m.key, m.enabledAt]));
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      taxId: company.taxId,
      city: company.city,
      phone: company.phone,
      industry: company.industry,
      status: company.status,
      createdAt: company.createdAt,
      memberCount: company._count.members,
      me: { memberId: me.id, role: me.role },
      modules: MODULES.map((m) => ({ key: m.key, area: m.area, ready: m.ready, enabled: enabled.has(m.key), enabledAt: enabled.get(m.key) ?? null })),
    };
  }

  async update(userId: string, companyId: string, dto: UpdateCompanyDto, ip?: string) {
    await this.requireMember(userId, companyId, 'admin');
    const data: Record<string, string | null> = {};
    for (const key of ['name', 'taxId', 'city', 'phone', 'industry'] as const) {
      if (dto[key] !== undefined) data[key] = key === 'name' ? dto[key]! : dto[key] || null;
    }
    await this.prisma.company.update({ where: { id: companyId }, data });
    await this.audit.log({ action: 'COMPANY_UPDATED', userId, entityType: 'company', entityId: companyId, metadata: data, ipAddress: ip });
    return this.get(userId, companyId);
  }

  // ───────── miembros ─────────

  async listMembers(userId: string, companyId: string) {
    await this.requireMember(userId, companyId);
    return this.prisma.companyMember.findMany({ where: { companyId }, orderBy: [{ createdAt: 'asc' }], select: memberSelect });
  }

  async updateMember(userId: string, companyId: string, memberId: string, dto: UpdateMemberDto, ip?: string) {
    const actor = await this.requireMember(userId, companyId, 'hr');
    const target = await this.prisma.companyMember.findFirst({ where: { id: memberId, companyId }, select: { id: true, role: true, status: true, userId: true } });
    if (!target) throw new NotFoundException('Esa persona no está en la empresa');

    const isOwner = actor.role === 'owner';
    const isSelf = target.userId === userId;
    const outranks = isOwner || roleRank(actor.role) > roleRank(target.role);

    const data: { role?: string; status?: string; jobTitle?: string | null; area?: string | null; hiredAt?: Date | null } = {};
    if (dto.role !== undefined || dto.status !== undefined) {
      if (!atLeast(actor.role, 'admin')) throw new ForbiddenException('Solo un administrador cambia roles o deshabilita personas');
      if (target.role === 'owner') throw new ForbiddenException('El rol del dueño no se puede cambiar');
      if (!outranks) throw new ForbiddenException('No puedes cambiar a alguien con tu mismo rol o uno mayor');
      if (dto.role !== undefined) {
        if (!isOwner && roleRank(dto.role) >= roleRank(actor.role)) throw new ForbiddenException('No puedes dar un rol igual o mayor que el tuyo');
        data.role = dto.role;
      }
      if (dto.status !== undefined) data.status = dto.status;
    }
    if (dto.jobTitle !== undefined || dto.area !== undefined || dto.hiredAt !== undefined) {
      if (!outranks && !isSelf) throw new ForbiddenException('No puedes editar a alguien con tu mismo rol o uno mayor');
      if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle || null;
      if (dto.area !== undefined) data.area = dto.area || null;
      if (dto.hiredAt !== undefined) {
        const date = toDate(dto.hiredAt);
        if (date && (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dto.hiredAt)) throw new BadRequestException('Esa fecha no existe');
        data.hiredAt = date;
      }
    }
    const updated = await this.prisma.companyMember.update({ where: { id: target.id }, data, select: memberSelect });
    await this.audit.log({ action: 'COMPANY_MEMBER_UPDATED', userId, entityType: 'company', entityId: companyId, metadata: { memberId, ...dto }, ipAddress: ip });
    return updated;
  }

  async removeMember(userId: string, companyId: string, memberId: string, ip?: string) {
    const actor = await this.requireMember(userId, companyId);
    const target = await this.prisma.companyMember.findFirst({ where: { id: memberId, companyId }, select: { id: true, role: true, userId: true } });
    if (!target) throw new NotFoundException('Esa persona no está en la empresa');
    if (target.role === 'owner') throw new ForbiddenException('El dueño no se puede quitar de la empresa');
    const isSelf = target.userId === userId;
    if (!isSelf) {
      if (!atLeast(actor.role, 'admin')) throw new ForbiddenException('Solo un administrador quita personas de la empresa');
      if (actor.role !== 'owner' && roleRank(actor.role) <= roleRank(target.role)) throw new ForbiddenException('No puedes quitar a alguien con tu mismo rol o uno mayor');
    }
    await this.prisma.companyMember.delete({ where: { id: target.id } });
    await this.audit.log({ action: 'COMPANY_MEMBER_REMOVED', userId, entityType: 'company', entityId: companyId, metadata: { memberId, self: isSelf }, ipAddress: ip });
  }

  // ───────── invitaciones ─────────

  async listInvites(userId: string, companyId: string) {
    await this.requireMember(userId, companyId, 'admin');
    return this.prisma.companyInvite.findMany({
      where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
  }

  async invite(userId: string, companyId: string, dto: InviteMemberDto, ip?: string) {
    const actor = await this.requireMember(userId, companyId, 'admin');
    if (actor.role !== 'owner' && roleRank(dto.role) >= roleRank(actor.role)) throw new ForbiddenException('No puedes invitar con un rol igual o mayor que el tuyo');
    const already = await this.prisma.companyMember.findFirst({ where: { companyId, user: { email: { equals: dto.email, mode: 'insensitive' } } }, select: { id: true } });
    if (already) throw new ConflictException('Esa persona ya está en la empresa');

    const token = randomBytes(32).toString('base64url');
    const [, invite] = await this.prisma.$transaction([
      // Una invitación pendiente por correo: la nueva reemplaza a la anterior.
      this.prisma.companyInvite.deleteMany({ where: { companyId, email: dto.email, acceptedAt: null } }),
      this.prisma.companyInvite.create({
        data: { companyId, email: dto.email, role: dto.role, tokenHash: sha256(token), invitedBy: userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    const inviter = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, email: true } });
    await this.email.sendCompanyInvite(dto.email, {
      companyName: actor.company.name,
      inviterName: inviter?.firstName || inviter?.email || '3R',
      roleLabel: ROLE_LABEL[dto.role],
      token,
    });
    await this.audit.log({ action: 'COMPANY_INVITE_SENT', userId, entityType: 'company', entityId: companyId, metadata: { email: dto.email, role: dto.role }, ipAddress: ip });
    return invite;
  }

  async revokeInvite(userId: string, companyId: string, inviteId: string) {
    await this.requireMember(userId, companyId, 'admin');
    const { count } = await this.prisma.companyInvite.deleteMany({ where: { id: inviteId, companyId, acceptedAt: null } });
    if (count === 0) throw new NotFoundException('Invitación no encontrada');
  }

  /** Lo que muestra la página de la invitación antes de aceptarla. Público: solo con el token se ve. */
  async previewInvite(token: string) {
    const invite = await this.prisma.companyInvite.findUnique({
      where: { tokenHash: sha256(token) },
      select: { email: true, role: true, expiresAt: true, acceptedAt: true, company: { select: { name: true } } },
    });
    if (!invite) throw new NotFoundException('Esta invitación no existe o fue reemplazada por otra');
    return {
      companyName: invite.company.name,
      email: invite.email,
      role: invite.role,
      expired: invite.expiresAt <= new Date(),
      accepted: invite.acceptedAt !== null,
    };
  }

  async acceptInvite(userId: string, token: string, ip?: string) {
    const invite = await this.prisma.companyInvite.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, companyId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
    });
    if (!invite) throw new NotFoundException('Esta invitación no existe o fue reemplazada por otra');
    if (invite.acceptedAt) throw new ConflictException('Esta invitación ya se usó');
    if (invite.expiresAt <= new Date()) throw new BadRequestException('Esta invitación venció. Pide que te envíen otra.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException(`Esta invitación es para ${invite.email}. Entra con ese correo para aceptarla.`);
    }
    await this.prisma.$transaction([
      this.prisma.companyMember.upsert({
        where: { companyId_userId: { companyId: invite.companyId, userId } },
        update: { status: 'active' },
        create: { companyId: invite.companyId, userId, role: invite.role },
      }),
      this.prisma.companyInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);
    await this.audit.log({ action: 'COMPANY_INVITE_ACCEPTED', userId, entityType: 'company', entityId: invite.companyId, ipAddress: ip });
    return { companyId: invite.companyId };
  }

  // ───────── equipo de 3R ─────────

  async adminList() {
    const rows = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        city: true,
        industry: true,
        status: true,
        createdAt: true,
        modules: { select: { key: true } },
        members: { where: { role: 'owner' }, select: { user: { select: { email: true, firstName: true } } }, take: 1 },
        _count: { select: { members: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      industry: c.industry,
      status: c.status,
      createdAt: c.createdAt,
      memberCount: c._count.members,
      modules: c.modules.map((m) => m.key),
      owner: c.members[0]?.user ?? null,
    }));
  }

  async adminGet(companyId: string) {
    const company = (await this.adminList()).find((c) => c.id === companyId);
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return { ...company, catalog: MODULES };
  }

  /** Deja activos exactamente los módulos de `keys` (solo los que ya están construidos). */
  async adminSetModules(adminId: string, companyId: string, keys: string[], ip?: string) {
    const unique = [...new Set(keys)];
    const invalid = unique.filter((k) => !isReadyModule(k));
    if (invalid.length > 0) throw new BadRequestException(`Estos módulos no existen o todavía no están listos: ${invalid.join(', ')}`);
    const exists = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Empresa no encontrada');
    await this.prisma.$transaction([
      this.prisma.companyModule.deleteMany({ where: { companyId, key: { notIn: unique } } }),
      this.prisma.companyModule.createMany({ data: unique.map((key) => ({ companyId, key })), skipDuplicates: true }),
    ]);
    await this.audit.log({ action: 'COMPANY_MODULES_SET', userId: adminId, entityType: 'company', entityId: companyId, metadata: { keys: unique }, ipAddress: ip });
    return this.adminGet(companyId);
  }

  async adminSetStatus(adminId: string, companyId: string, status: string, ip?: string) {
    const exists = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Empresa no encontrada');
    await this.prisma.company.update({ where: { id: companyId }, data: { status } });
    await this.audit.log({ action: 'COMPANY_STATUS_SET', userId: adminId, entityType: 'company', entityId: companyId, metadata: { status }, ipAddress: ip });
    return this.adminGet(companyId);
  }
}
