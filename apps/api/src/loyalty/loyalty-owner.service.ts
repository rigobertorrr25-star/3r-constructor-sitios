import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { LoyaltyProgram } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStaffDto, UpdateStaffDto } from './dto/loyalty.dto.js';
import { BUSINESS_UTC_OFFSET_HOURS, OWNER_SESSION_TTL } from './loyalty.constants.js';
import { LoyaltyService, cardProgress, rewardsOf } from './loyalty.service.js';

export interface OwnerTokenPayload {
  sub: string;
  typ: 'loyalty-owner';
}

const DAY = 86_400_000;

/** Medianoche de hoy en la hora del negocio, expresada en UTC. */
function startOfBusinessDay(now = new Date()) {
  const offset = BUSINESS_UTC_OFFSET_HOURS * 3_600_000;
  return new Date(Math.floor((now.getTime() + offset) / DAY) * DAY - offset);
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Evita que Excel interprete como fórmula lo que escribió un cliente (=, +, -, @).
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

@Injectable()
export class LoyaltyOwnerService {
  // Firma propia para las sesiones del dueño: un token de este panel nunca sirve en el resto de la API.
  private readonly jwt: JwtService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    config: ConfigService,
  ) {
    this.jwt = new JwtService({
      secret: `${config.getOrThrow<string>('JWT_ACCESS_SECRET')}:loyalty-owner`,
      signOptions: { expiresIn: OWNER_SESSION_TTL },
    });
  }

  async login(slug: string, key: string) {
    const program = await this.loyalty.program(slug);
    if (!(await this.loyalty.verifySecret(program.ownerKeyHash, key))) throw new UnauthorizedException('Clave incorrecta');
    const payload: OwnerTokenPayload = { sub: program.id, typ: 'loyalty-owner' };
    return { token: await this.jwt.signAsync(payload), program: { name: program.name, slug: program.slug } };
  }

  /** Devuelve el programa si el token es del dueño de ese mismo programa. */
  async authorize(slug: string, token: string | undefined): Promise<LoyaltyProgram> {
    const program = await this.loyalty.program(slug);
    try {
      const payload = token ? await this.jwt.verifyAsync<OwnerTokenPayload>(token) : null;
      if (payload?.typ === 'loyalty-owner' && payload.sub === program.id) return program;
    } catch {
      /* vencido o inválido */
    }
    throw new UnauthorizedException({ statusCode: 401, code: 'OWNER_SESSION', message: 'Tu sesión terminó. Entra otra vez con tu clave.' });
  }

  async changeKey(program: LoyaltyProgram, current: string, next: string) {
    if (!(await this.loyalty.verifySecret(program.ownerKeyHash, current))) throw new UnauthorizedException('La clave actual no es correcta');
    await this.prisma.loyaltyProgram.update({ where: { id: program.id }, data: { ownerKeyHash: await this.loyalty.hashSecret(next) } });
    return { ok: true };
  }

  async summary(program: LoyaltyProgram) {
    const today = startOfBusinessDay();
    const since7 = new Date(today.getTime() - 6 * DAY);
    const since30 = new Date(today.getTime() - 29 * DAY);
    const where = { programId: program.id };

    const [customers, newCustomers30, events30, staff] = await Promise.all([
      this.prisma.loyaltyCustomer.count({ where }),
      this.prisma.loyaltyCustomer.count({ where: { ...where, createdAt: { gte: since30 } } }),
      this.prisma.loyaltyEvent.findMany({
        where: { ...where, createdAt: { gte: since30 }, kind: { in: ['stamp', 'redeem'] } },
        select: { kind: true, createdAt: true, rewardAt: true, staffId: true, customerId: true },
      }),
      this.prisma.loyaltyStaff.findMany({ where, select: { id: true, name: true, isActive: true }, orderBy: { createdAt: 'asc' } }),
    ]);

    const stamps30 = events30.filter((e) => e.kind === 'stamp');
    const redeems30 = events30.filter((e) => e.kind === 'redeem');
    const offset = BUSINESS_UTC_OFFSET_HOURS * 3_600_000;
    const dayKey = (d: Date) => new Date(d.getTime() + offset).toISOString().slice(0, 10);
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) byDay.set(dayKey(new Date(today.getTime() - i * DAY)), 0);
    for (const e of stamps30) {
      const k = dayKey(e.createdAt);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }

    const { list } = await this.customers(program);
    return {
      program: { name: program.name, goal: program.goal, cooldownMinutes: program.cooldownMinutes, rewards: rewardsOf(program) },
      customers,
      newCustomers30,
      activeCustomers30: new Set(stamps30.map((e) => e.customerId)).size,
      waitingReward: list.filter((c) => c.ready).length,
      stamps: {
        today: stamps30.filter((e) => e.createdAt >= today).length,
        last7: stamps30.filter((e) => e.createdAt >= since7).length,
        last30: stamps30.length,
      },
      redemptions30: rewardsOf(program).map((r) => ({ ...r, count: redeems30.filter((e) => e.rewardAt === r.at).length })),
      stampsByDay: [...byDay].map(([date, count]) => ({ date, count })),
      staff: staff.map((s) => ({
        name: s.name,
        isActive: s.isActive,
        stamps30: stamps30.filter((e) => e.staffId === s.id).length,
        redeems30: redeems30.filter((e) => e.staffId === s.id).length,
      })),
    };
  }

  async customers(program: LoyaltyProgram, q?: string) {
    const term = q?.trim();
    const digits = term?.replace(/\D/g, '');
    const customers = await this.prisma.loyaltyCustomer.findMany({
      where: {
        programId: program.id,
        ...(term
          ? { OR: [{ name: { contains: term, mode: 'insensitive' as const } }, ...(digits ? [{ phone: { contains: digits } }] : [])] }
          : {}),
      },
      orderBy: [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 500,
      include: { events: { select: { kind: true, cardNumber: true, rewardAt: true } } },
    });
    const list = customers.map((c) => {
      const progress = cardProgress(program, c.cardNumber, c.events);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        stamps: progress.stamps,
        goal: program.goal,
        ready: progress.ready?.label ?? null,
        visits: c.events.filter((e) => e.kind === 'stamp').length,
        redemptions: c.events.filter((e) => e.kind === 'redeem').length,
        cardsCompleted: progress.cardsCompleted,
        lastVisitAt: c.lastVisitAt,
        createdAt: c.createdAt,
      };
    });
    return { list };
  }

  async customersCsv(program: LoyaltyProgram) {
    const { list } = await this.customers(program);
    const header = ['Nombre', 'Celular', 'Sellos en la tarjeta', 'Premio por canjear', 'Visitas', 'Premios canjeados', 'Tarjetas completas', 'Última visita', 'Registrado'];
    const date = (d: Date | null) => (d ? new Date(d.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') : '');
    const rows = list.map((c) => [c.name, c.phone, `${c.stamps}/${c.goal}`, c.ready ?? '', c.visits, c.redemptions, c.cardsCompleted, date(c.lastVisitAt), date(c.createdAt)]);
    // BOM para que Excel abra bien las tildes; punto y coma porque Excel en español separa así.
    return '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  }

  async events(program: LoyaltyProgram, limit = 100) {
    const events = await this.prisma.loyaltyEvent.findMany({
      where: { programId: program.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
      include: { customer: { select: { name: true, phone: true } }, staff: { select: { name: true } } },
    });
    const labels = new Map(rewardsOf(program).map((r) => [r.at, r.label]));
    return events.map((e) => ({
      id: e.id,
      kind: e.kind,
      at: e.createdAt,
      customer: e.customer.name,
      phone: e.customer.phone,
      staff: e.staff?.name ?? null,
      reward: e.rewardAt ? (labels.get(e.rewardAt) ?? `Sello ${e.rewardAt}`) : null,
    }));
  }

  listStaff(program: LoyaltyProgram) {
    return this.prisma.loyaltyStaff.findMany({
      where: { programId: program.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
  }

  async createStaff(program: LoyaltyProgram, dto: CreateStaffDto) {
    await this.loyalty.ensurePinFree(program.id, dto.pin);
    const staff = await this.prisma.loyaltyStaff.create({
      data: { programId: program.id, name: dto.name.trim(), pinHash: await this.loyalty.hashSecret(dto.pin) },
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
    return staff;
  }

  async updateStaff(program: LoyaltyProgram, staffId: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.loyaltyStaff.findFirst({ where: { id: staffId, programId: program.id } });
    if (!staff) throw new NotFoundException('Mesero no encontrado');
    if (dto.pin) await this.loyalty.ensurePinFree(program.id, dto.pin, staff.id);
    // Su código viejo pudo pasar a otro mesero mientras estaba de baja: al volver, lleva uno nuevo.
    if (dto.isActive && !staff.isActive && !dto.pin) {
      throw new BadRequestException('Para volver a activar a este mesero, ponle un código nuevo');
    }
    return this.prisma.loyaltyStaff.update({
      where: { id: staff.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.pin ? { pinHash: await this.loyalty.hashSecret(dto.pin) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
  }
}
