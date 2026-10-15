import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublishingService } from '../publishing/publishing.service.js';
import type { PageMetaDto } from './dto/seo.dto.js';
import { audit, effectiveTitle, type AuditPage } from './seo-audit.js';

/** Clave del módulo en el catálogo de la plataforma. */
export const SEO_MODULE = 'seo';

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly publishing: PublishingService,
    private readonly auditLog: AuditService,
  ) {}

  /** Ver la revisión: supervisor en adelante. Cambiar títulos y descripciones: administradores. */
  private async access(userId: string, companyId: string, min: 'supervisor' | 'admin' = 'supervisor') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, SEO_MODULE);
    const c = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { siteId: true, modules: { where: { key: 'web' }, select: { key: true } } },
    });
    return { me, siteId: c.siteId, hasWeb: c.modules.length > 0 };
  }

  async report(userId: string, companyId: string) {
    const { me, siteId, hasWeb } = await this.access(userId, companyId);
    if (!siteId) return { site: null, canEdit: false, hasWeb };
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        name: true,
        pages: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            slug: true,
            isHomepage: true,
            seoTitle: true,
            seoDescription: true,
            versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { content: true } },
          },
        },
      },
    });
    const publication = await this.publishing.status(userId, siteId, false);
    const pages: AuditPage[] = site.pages.map((p) => ({
      id: p.id,
      title: p.title,
      isHomepage: p.isHomepage,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      doc: (p.versions[0]?.content ?? null) as AuditPage['doc'],
    }));
    const { score, checks } = audit({ name: site.name, published: publication.published, customDomain: publication.customDomain, pages });
    const base = publication.customUrl ?? publication.url;
    return {
      canEdit: atLeast(me.role, 'admin'),
      hasWeb,
      site: { name: site.name, url: base, published: publication.published, hasUnpublishedChanges: publication.hasUnpublishedChanges },
      score,
      checks,
      pages: site.pages.map((p, i) => ({
        id: p.id,
        title: p.title,
        isHomepage: p.isHomepage,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        googleTitle: effectiveTitle(pages[i], site.name),
        url: base ? `${base.replace(/\/$/, '')}${p.isHomepage ? '' : `/${p.slug}`}` : null,
      })),
    };
  }

  /** Título y descripción para Google de una página. Se ven en Google después de publicar. */
  async saveMeta(userId: string, companyId: string, pageId: string, dto: PageMetaDto) {
    const { siteId } = await this.access(userId, companyId, 'admin');
    if (!siteId) throw new NotFoundException('La empresa no tiene una página vinculada');
    const { count } = await this.prisma.page.updateMany({
      where: { id: pageId, siteId },
      data: { seoTitle: dto.seoTitle || null, seoDescription: dto.seoDescription || null },
    });
    if (!count) throw new NotFoundException('Página no encontrada');
    await this.auditLog.log({ action: 'COMPANY_SITE_SEO_EDITED', userId, entityType: 'site', entityId: siteId, metadata: { companyId, pageId } });
    return { ok: true };
  }
}
