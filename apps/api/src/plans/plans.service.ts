import { Injectable } from '@nestjs/common';
import { Role } from '../common/roles.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PlanLimits {
  planName: string;
  maxSites: number | null;
  maxPages: number | null;
  maxStorageMb: number | null;
  customDomains: boolean;
}

// Sin suscripción activa se aplican los límites de una prueba gratuita (iguales a Starter).
const FREE_LIMITS: PlanLimits = {
  planName: 'Gratis',
  maxSites: 1,
  maxPages: 5,
  maxStorageMb: 500,
  customDomains: false,
};

// El equipo construye las páginas de todos los clientes: no tiene límites.
const STAFF_LIMITS: PlanLimits = {
  planName: 'Equipo',
  maxSites: null,
  maxPages: null,
  maxStorageMb: null,
  customDomains: true,
};

const ACTIVE_STATUSES = ['active', 'trialing'];

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Los límites se comprueban siempre en backend, nunca solo en la interfaz. */
  async getLimits(userId: string): Promise<PlanLimits> {
    const staff = await this.prisma.userRole.findFirst({
      where: { userId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
      select: { userId: true },
    });
    if (staff) return STAFF_LIMITS;

    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!subscription) return FREE_LIMITS;
    const { plan } = subscription;
    return {
      planName: plan.name,
      maxSites: plan.maxSites,
      maxPages: plan.maxPages,
      maxStorageMb: plan.maxStorageMb,
      customDomains: plan.customDomains ?? false,
    };
  }
}
