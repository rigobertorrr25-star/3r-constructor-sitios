import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { LoyaltyCustomer, LoyaltyProgram, LoyaltyStaff } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RecoverCardDto, RegisterCustomerDto } from './dto/loyalty.dto.js';
import { PIN_ATTEMPTS, PIN_LOCK_MINUTES, maskPhone, normalizePhone, type Reward } from './loyalty.constants.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const rewardsOf = (program: Pick<LoyaltyProgram, 'rewards'>) => program.rewards as unknown as Reward[];

/** Revisa que los premios estén en orden, sin repetir, y que el último complete la tarjeta. */
export function checkRewards(rewards: Reward[], goal: number) {
  const ats = rewards.map((r) => r.at);
  const sorted = ats.every((at, i) => i === 0 || at > ats[i - 1]);
  if (!sorted) throw new BadRequestException('Los premios van de menor a mayor número de sellos, sin repetir');
  if (ats[ats.length - 1] !== goal) throw new BadRequestException('El último premio tiene que estar en el último sello de la tarjeta');
}

type CardEvent = { kind: string; cardNumber: number; rewardAt: number | null };

/** Cómo va la tarjeta en curso de un cliente, a partir de su historial. */
export function cardProgress(program: Pick<LoyaltyProgram, 'goal' | 'rewards'>, cardNumber: number, events: CardEvent[]) {
  const current = events.filter((e) => e.cardNumber === cardNumber);
  const stamps = current.filter((e) => e.kind === 'stamp').length;
  const redeemed = new Set(current.filter((e) => e.kind === 'redeem').map((e) => e.rewardAt));
  const rewards = rewardsOf(program).map((r) => ({
    ...r,
    status: redeemed.has(r.at) ? 'used' : stamps >= r.at ? 'ready' : 'locked',
  }));
  // Canjeado el último premio, la tarjeta queda completa (con sus palmeras) hasta el siguiente sello.
  const complete = stamps >= program.goal && redeemed.has(program.goal);
  return {
    stamps,
    rewards,
    ready: rewards.find((r) => r.status === 'ready') ?? null,
    next: rewards.find((r) => r.at > stamps) ?? null,
    complete,
    cardsCompleted: events.filter((e) => e.kind === 'redeem' && e.rewardAt === program.goal).length,
  };
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async program(slug: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({ where: { slug } });
    if (!program || !program.isActive) throw new NotFoundException('Programa no encontrado');
    return program;
  }

  /** Lo que la tarjeta necesita mostrar antes de que el cliente se registre. */
  async publicInfo(slug: string) {
    const p = await this.program(slug);
    return { name: p.name, goal: p.goal, cooldownMinutes: p.cooldownMinutes, rewards: rewardsOf(p) };
  }

  async register(slug: string, dto: RegisterCustomerDto) {
    const program = await this.program(slug);
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('Escribe un celular válido, por ejemplo 300 123 4567');
    const exists = await this.prisma.loyaltyCustomer.findUnique({ where: { programId_phone: { programId: program.id, phone } } });
    if (exists) {
      throw new ConflictException({
        statusCode: 409,
        code: 'PHONE_EXISTS',
        message: 'Ese celular ya tiene una tarjeta. Pídele al mesero que la pase a este celular con su código.',
      });
    }
    const token = randomBytes(32).toString('base64url');
    const customer = await this.prisma.loyaltyCustomer.create({
      data: { programId: program.id, name: dto.name.trim(), phone, consentAt: new Date(), tokenHash: sha256(token) },
    });
    return { token, card: await this.card(program, customer) };
  }

  async customerByToken(program: LoyaltyProgram, token: string | undefined) {
    const customer = token
      ? await this.prisma.loyaltyCustomer.findUnique({ where: { tokenHash: sha256(token) } })
      : null;
    if (!customer || customer.programId !== program.id) {
      throw new UnauthorizedException({ statusCode: 401, code: 'NO_CARD', message: 'No encontramos tu tarjeta en este celular' });
    }
    return customer;
  }

  async getCard(slug: string, token: string | undefined) {
    const program = await this.program(slug);
    return this.card(program, await this.customerByToken(program, token));
  }

  async card(program: LoyaltyProgram, customer: LoyaltyCustomer) {
    const events = await this.prisma.loyaltyEvent.findMany({
      where: { customerId: customer.id },
      select: { kind: true, cardNumber: true, rewardAt: true },
    });
    const lastStamp = await this.prisma.loyaltyEvent.findFirst({
      where: { customerId: customer.id, kind: 'stamp' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const progress = cardProgress(program, customer.cardNumber, events);
    const nextStampAt = lastStamp ? new Date(lastStamp.createdAt.getTime() + program.cooldownMinutes * 60_000) : null;
    return {
      program: { name: program.name, goal: program.goal, cooldownMinutes: program.cooldownMinutes },
      name: customer.name,
      phone: maskPhone(customer.phone),
      cardNumber: customer.cardNumber,
      ...progress,
      nextStampAt: nextStampAt && nextStampAt > new Date() ? nextStampAt.toISOString() : null,
    };
  }

  /** Busca qué mesero tiene ese código. Con pocos meseros por negocio, revisar uno por uno basta. */
  private async staffByPin(programId: string, pin: string): Promise<LoyaltyStaff | null> {
    const staff = await this.prisma.loyaltyStaff.findMany({ where: { programId, isActive: true } });
    for (const s of staff) {
      if (await argon2.verify(s.pinHash, pin).catch(() => false)) return s;
    }
    return null;
  }

  /** Comprueba el código del mesero contando los intentos fallidos de esa tarjeta. */
  private async checkPin(customer: LoyaltyCustomer, pin: string) {
    const now = new Date();
    if (customer.lockedUntil && customer.lockedUntil > now) throw this.locked(customer.lockedUntil);
    const staff = await this.staffByPin(customer.programId, pin);
    if (!staff) {
      const failed = customer.failedPins + 1;
      const lock = failed >= PIN_ATTEMPTS ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000) : null;
      await this.prisma.loyaltyCustomer.update({
        where: { id: customer.id },
        data: lock ? { failedPins: 0, lockedUntil: lock } : { failedPins: failed },
      });
      if (lock) throw this.locked(lock);
      throw new UnauthorizedException({ statusCode: 401, code: 'BAD_PIN', message: 'Código incorrecto. Intenta otra vez.' });
    }
    if (customer.failedPins || customer.lockedUntil) {
      await this.prisma.loyaltyCustomer.update({ where: { id: customer.id }, data: { failedPins: 0, lockedUntil: null } });
    }
    return staff;
  }

  private locked(until: Date) {
    const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
    return new HttpException(
      { statusCode: 429, code: 'LOCKED', message: `Demasiados intentos. Espera ${minutes} min y vuelve a intentar.` },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async stamp(slug: string, token: string | undefined, pin: string) {
    const program = await this.program(slug);
    let customer = await this.customerByToken(program, token);
    const staff = await this.checkPin(customer, pin);

    const card = await this.card(program, customer);
    if (card.nextStampAt) {
      throw new ConflictException({ statusCode: 409, code: 'TOO_SOON', message: 'Ya recibiste un sello hace poco. El siguiente, en tu próxima visita.', nextStampAt: card.nextStampAt });
    }
    if (card.stamps >= program.goal) {
      if (!card.complete) throw new ConflictException({ statusCode: 409, code: 'CARD_FULL', message: 'Canjea tu último premio para empezar una tarjeta nueva.' });
      customer = await this.prisma.loyaltyCustomer.update({ where: { id: customer.id }, data: { cardNumber: { increment: 1 } } });
    }
    await this.prisma.$transaction([
      this.prisma.loyaltyEvent.create({
        data: { programId: program.id, customerId: customer.id, staffId: staff.id, kind: 'stamp', cardNumber: customer.cardNumber },
      }),
      this.prisma.loyaltyCustomer.update({ where: { id: customer.id }, data: { lastVisitAt: new Date() } }),
    ]);
    return { staff: staff.name, card: await this.card(program, customer) };
  }

  async redeem(slug: string, token: string | undefined, pin: string) {
    const program = await this.program(slug);
    const customer = await this.customerByToken(program, token);
    const staff = await this.checkPin(customer, pin);
    const card = await this.card(program, customer);
    if (!card.ready) throw new ConflictException({ statusCode: 409, code: 'NO_REWARD', message: 'Todavía no hay un premio para canjear.' });
    await this.prisma.loyaltyEvent.create({
      data: { programId: program.id, customerId: customer.id, staffId: staff.id, kind: 'redeem', cardNumber: customer.cardNumber, rewardAt: card.ready.at },
    });
    return { staff: staff.name, reward: card.ready.label, card: await this.card(program, customer) };
  }

  /** Pasa la tarjeta a otro celular: el mesero confirma con su código y el celular anterior deja de verla. */
  async recover(slug: string, dto: RecoverCardDto) {
    const program = await this.program(slug);
    const phone = normalizePhone(dto.phone);
    const customer = phone
      ? await this.prisma.loyaltyCustomer.findUnique({ where: { programId_phone: { programId: program.id, phone } } })
      : null;
    if (!customer) throw new NotFoundException({ statusCode: 404, code: 'NO_CARD', message: 'No hay ninguna tarjeta con ese celular' });
    const staff = await this.checkPin(customer, dto.pin);
    const token = randomBytes(32).toString('base64url');
    const updated = await this.prisma.loyaltyCustomer.update({ where: { id: customer.id }, data: { tokenHash: sha256(token) } });
    await this.prisma.loyaltyEvent.create({
      data: { programId: program.id, customerId: customer.id, staffId: staff.id, kind: 'recover', cardNumber: customer.cardNumber },
    });
    return { token, card: await this.card(program, updated) };
  }

  // ── Utilidades compartidas con el panel del dueño y el del equipo ──

  hashSecret(secret: string) {
    return argon2.hash(secret, { type: argon2.argon2id });
  }

  verifySecret(hash: string, secret: string) {
    return argon2.verify(hash, secret).catch(() => false);
  }

  /** Dos meseros activos no pueden compartir código: no se sabría quién puso el sello. */
  async ensurePinFree(programId: string, pin: string, exceptStaffId?: string) {
    const holder = await this.staffByPin(programId, pin);
    if (holder && holder.id !== exceptStaffId) throw new ConflictException('Ese código ya lo usa otro mesero. Elige uno distinto.');
  }
}
