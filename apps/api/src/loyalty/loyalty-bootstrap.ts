import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Reward } from './loyalty.constants.js';
import { LoyaltyService, checkRewards } from './loyalty.service.js';

/** "4: 20 % de descuento | 7: Café gratis | 10: Cóctel gratis" → premios. */
export function parseRewardList(raw: string): Reward[] | null {
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
  const rewards = parts.map((p) => {
    const m = /^(\d{1,2})\s*:\s*(.{2,60})$/.exec(p);
    return m ? { at: Number(m[1]), label: m[2].trim() } : null;
  });
  return rewards.length && rewards.every(Boolean) ? (rewards as Reward[]) : null;
}

/**
 * Crea el primer programa al arrancar, para poner en marcha un negocio sin el panel del equipo
 * (por ejemplo, con solo la API publicada en Render). Nunca cambia un programa que ya existe:
 * después de crearlo, todo se maneja desde el panel del dueño y estas variables se pueden borrar.
 */
@Injectable()
export class LoyaltyBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger('Fidelización');

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async onApplicationBootstrap() {
    const slug = this.config.get<string>('LOYALTY_BOOTSTRAP_SLUG')?.trim();
    if (!slug) return;
    const name = this.config.get<string>('LOYALTY_BOOTSTRAP_NAME')?.trim();
    const ownerKey = this.config.get<string>('LOYALTY_BOOTSTRAP_OWNER_KEY') ?? '';
    const rewards = parseRewardList(this.config.get<string>('LOYALTY_BOOTSTRAP_REWARDS') ?? '');
    const hours = Number(this.config.get<string>('LOYALTY_BOOTSTRAP_COOLDOWN_HOURS') ?? '3');

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !name || ownerKey.length < 8 || !rewards || !(hours >= 0)) {
      this.logger.warn('LOYALTY_BOOTSTRAP_* incompleto o inválido: no se creó el programa.');
      return;
    }
    if (await this.prisma.loyaltyProgram.findUnique({ where: { slug } })) return;
    const goal = rewards[rewards.length - 1].at;
    try {
      checkRewards(rewards, goal);
    } catch {
      this.logger.warn('LOYALTY_BOOTSTRAP_REWARDS: los premios van de menor a mayor sin repetir.');
      return;
    }
    await this.prisma.loyaltyProgram.create({
      data: {
        slug,
        name,
        goal,
        cooldownMinutes: Math.round(hours * 60),
        rewards: rewards as unknown as Prisma.InputJsonValue,
        ownerKeyHash: await this.loyalty.hashSecret(ownerKey),
      },
    });
    this.logger.log(`Programa "${slug}" creado. Ya puedes borrar las variables LOYALTY_BOOTSTRAP_*.`);
  }
}
