import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AuditService } from '../audit/audit.service.js';
import { Role } from '../common/roles.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProgramDto, UpdateProgramDto } from './dto/loyalty.dto.js';
import { LoyaltyService, checkRewards, rewardsOf } from './loyalty.service.js';

const programView = {
  id: true,
  slug: true,
  name: true,
  goal: true,
  cooldownMinutes: true,
  rewards: true,
  isActive: true,
  createdAt: true,
  _count: { select: { customers: true, staff: true } },
} as const;

/** El equipo de 3R da de alta el programa de cada negocio; el dueño maneja el resto desde su panel. */
@Controller('admin/loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminLoyaltyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.prisma.loyaltyProgram.findMany({ orderBy: { createdAt: 'desc' }, select: programView });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProgramDto) {
    checkRewards(dto.rewards, dto.goal);
    if (await this.prisma.loyaltyProgram.findUnique({ where: { slug: dto.slug } })) {
      throw new ConflictException('Ya hay un programa con ese identificador');
    }
    const program = await this.prisma.loyaltyProgram.create({
      data: {
        slug: dto.slug,
        name: dto.name.trim(),
        goal: dto.goal,
        cooldownMinutes: dto.cooldownMinutes,
        rewards: dto.rewards.map((r) => ({ at: r.at, label: r.label.trim() })) as unknown as Prisma.InputJsonValue,
        ownerKeyHash: await this.loyalty.hashSecret(dto.ownerKey),
      },
      select: programView,
    });
    await this.audit.log({ action: 'loyalty.program.create', userId: user.id, entityType: 'loyalty_program', entityId: program.id });
    return program;
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgramDto) {
    const current = await this.prisma.loyaltyProgram.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Programa no encontrado');
    const goal = dto.goal ?? current.goal;
    checkRewards(dto.rewards ?? rewardsOf(current), goal);
    const program = await this.prisma.loyaltyProgram.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.goal ? { goal: dto.goal } : {}),
        ...(dto.cooldownMinutes !== undefined ? { cooldownMinutes: dto.cooldownMinutes } : {}),
        ...(dto.rewards ? { rewards: dto.rewards.map((r) => ({ at: r.at, label: r.label.trim() })) as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.ownerKey ? { ownerKeyHash: await this.loyalty.hashSecret(dto.ownerKey) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: programView,
    });
    await this.audit.log({
      action: 'loyalty.program.update',
      userId: user.id,
      entityType: 'loyalty_program',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return program;
  }
}
