import { Injectable, Logger } from '@nestjs/common';
import { COMPANY_ROLES, atLeast, roleRank, type CompanyRole } from '../companies/companies.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const ALERTS_MODULE = 'alerts';

export type AlertInput = { kind: string; title: string; body?: string | null; href?: string | null; dedupeKey?: string | null };

/**
 * Crea avisos en la campanita. Lo usan los demás módulos (ticket asignado, solicitud por decidir…) y la revisión
 * diaria. Solo si la empresa tiene activo el módulo de Alertas; nunca rompe lo que lo llamó.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enabled(companyId: string) {
    return !!(await this.prisma.companyModule.findUnique({ where: { companyId_key: { companyId, key: ALERTS_MODULE } }, select: { key: true } }));
  }

  /** Avisa a esas personas (sin repetir: mismo `dedupeKey` para la misma persona no se crea dos veces). */
  async notify(companyId: string, memberIds: (string | null | undefined)[], alert: AlertInput) {
    try {
      const ids = [...new Set(memberIds.filter((x): x is string => !!x))];
      if (!ids.length || !(await this.enabled(companyId))) return 0;
      const { count } = await this.prisma.notification.createMany({
        data: ids.map((memberId) => ({
          companyId,
          memberId,
          kind: alert.kind,
          title: alert.title.slice(0, 200),
          body: alert.body ? alert.body.slice(0, 500) : null,
          href: alert.href ?? null,
          dedupeKey: alert.dedupeKey ?? null,
        })),
        skipDuplicates: true,
      });
      return count;
    } catch (error) {
      this.logger.warn(`No se pudo crear la alerta "${alert.title}": ${(error as Error).message}`);
      return 0;
    }
  }

  /** Personas activas con rol `min` o mayor y por encima de `aboveRole` (para avisar a quien decide). */
  async membersAbove(companyId: string, min: CompanyRole, aboveRole?: string, exclude?: string) {
    const roles = COMPANY_ROLES.filter((r) => atLeast(r, min) && (!aboveRole || r === 'owner' || roleRank(r) > roleRank(aboveRole)));
    const rows = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active', role: { in: roles }, ...(exclude ? { id: { not: exclude } } : {}) },
      select: { id: true },
      take: 50,
    });
    return rows.map((r) => r.id);
  }
}
