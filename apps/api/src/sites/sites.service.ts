import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { slugify, uniqueSlug } from '../common/slug.js';
import { emptyDocument } from '../editor/editor-document.js';
import { PlansService } from '../plans/plans.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSiteDto, UpdateSiteDto } from './dto/site.dto.js';

const siteSummary = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  templateId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { pages: true } },
} as const;

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  list(userId: string) {
    return this.prisma.site.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: siteSummary,
    });
  }

  async get(userId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, userId },
      select: {
        ...siteSummary,
        pages: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            slug: true,
            isHomepage: true,
            isPublished: true,
            sortOrder: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!site) throw new NotFoundException('Sitio no encontrado');
    return site;
  }

  async create(userId: string, dto: CreateSiteDto, ip?: string) {
    const limits = await this.plans.getLimits(userId);
    if (limits.maxSites !== null) {
      const count = await this.prisma.site.count({ where: { userId } });
      if (count >= limits.maxSites) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PLAN_LIMIT',
          message: `Tu plan (${limits.planName}) permite ${limits.maxSites} sitio(s). Actualiza tu plan para crear más.`,
        });
      }
    }

    const template = await this.prisma.template.findFirst({
      where: { slug: dto.templateSlug ?? 'blank', isActive: true },
    });
    if (!template) throw new BadRequestException('La plantilla no existe');

    const slug = await uniqueSlug(slugify(dto.name), async (candidate) => {
      const taken = await this.prisma.site.findFirst({
        where: { userId, slug: candidate },
        select: { id: true },
      });
      return taken !== null;
    });

    // La plantilla original nunca se modifica: se copia su JSON a la primera versión.
    const content = structuredClone(template.content ?? emptyDocument()) as Prisma.InputJsonValue;

    const site = await this.prisma.site.create({
      data: {
        userId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        templateId: template.id,
        pages: {
          create: {
            title: 'Inicio',
            slug: 'inicio',
            isHomepage: true,
            versions: { create: { versionNumber: 1, content, createdBy: userId } },
          },
        },
      },
      select: siteSummary,
    });

    await this.audit.log({
      action: 'SITE_CREATED',
      userId,
      entityType: 'site',
      entityId: site.id,
      metadata: { template: template.slug },
      ipAddress: ip,
    });
    return site;
  }

  async update(userId: string, siteId: string, dto: UpdateSiteDto) {
    await this.assertOwned(userId, siteId);
    return this.prisma.site.update({
      where: { id: siteId },
      data: { name: dto.name?.trim(), description: dto.description },
      select: siteSummary,
    });
  }

  async remove(userId: string, siteId: string, ip?: string) {
    await this.assertOwned(userId, siteId);
    await this.prisma.site.delete({ where: { id: siteId } });
    await this.audit.log({
      action: 'SITE_DELETED',
      userId,
      entityType: 'site',
      entityId: siteId,
      ipAddress: ip,
    });
  }

  private async assertOwned(userId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, userId }, select: { id: true } });
    if (!site) throw new NotFoundException('Sitio no encontrado');
  }
}
