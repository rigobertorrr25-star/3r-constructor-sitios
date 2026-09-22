import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { slugify, uniqueSlug } from '../common/slug.js';
import { emptyDocument, validateEditorDocument } from '../editor/editor-document.js';
import { PlansService } from '../plans/plans.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePageDto, UpdatePageDto } from './dto/page.dto.js';

const pageSummary = {
  id: true,
  siteId: true,
  title: true,
  slug: true,
  pageType: true,
  sortOrder: true,
  isHomepage: true,
  isPublished: true,
  seoTitle: true,
  seoDescription: true,
  createdAt: true,
  updatedAt: true,
} as const;

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async list(userId: string, siteId: string) {
    await this.assertSiteOwned(userId, siteId);
    return this.prisma.page.findMany({
      where: { siteId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: pageSummary,
    });
  }

  async create(userId: string, siteId: string, dto: CreatePageDto) {
    await this.assertSiteOwned(userId, siteId);

    const limits = await this.plans.getLimits(userId);
    if (limits.maxPages !== null) {
      const count = await this.prisma.page.count({ where: { siteId } });
      if (count >= limits.maxPages) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PLAN_LIMIT',
          message: `Tu plan (${limits.planName}) permite ${limits.maxPages} páginas por sitio.`,
        });
      }
    }

    const base = dto.slug ?? slugify(dto.title, 'pagina');
    const slug = dto.slug
      ? await this.ensureSlugFree(siteId, dto.slug)
      : await uniqueSlug(base, async (candidate) => {
          const taken = await this.prisma.page.findFirst({ where: { siteId, slug: candidate }, select: { id: true } });
          return taken !== null;
        });

    const last = await this.prisma.page.aggregate({ where: { siteId }, _max: { sortOrder: true } });
    return this.prisma.page.create({
      data: {
        siteId,
        title: dto.title.trim(),
        slug,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        versions: { create: { versionNumber: 1, content: asJson(emptyDocument()), createdBy: userId } },
      },
      select: pageSummary,
    });
  }

  async get(userId: string, pageId: string) {
    const page = await this.findOwnedPage(userId, pageId);
    return page;
  }

  async update(userId: string, pageId: string, dto: UpdatePageDto) {
    const page = await this.findOwnedPage(userId, pageId);
    if (dto.slug && dto.slug !== page.slug) await this.ensureSlugFree(page.siteId, dto.slug);
    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        title: dto.title?.trim(),
        slug: dto.slug,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        isPublished: dto.isPublished,
        sortOrder: dto.sortOrder,
      },
      select: pageSummary,
    });
  }

  async remove(userId: string, pageId: string) {
    const page = await this.findOwnedPage(userId, pageId);
    if (page.isHomepage) throw new BadRequestException('No se puede eliminar la página de inicio');
    await this.prisma.page.delete({ where: { id: pageId } });
  }

  /** Contenido de la versión más reciente (la que abre el editor). */
  async getContent(userId: string, pageId: string) {
    await this.findOwnedPage(userId, pageId);
    const latest = await this.latestVersion(pageId);
    return {
      versionId: latest.id,
      versionNumber: latest.versionNumber,
      content: latest.content,
      updatedAt: latest.createdAt,
    };
  }

  /**
   * Guardado automático. Actualiza la versión más reciente en el lugar para no crear
   * una versión por pulsación. Si esa versión ya se publicó, abre una nueva para no
   * modificar lo que está en línea.
   */
  async autosave(userId: string, pageId: string, rawContent: unknown) {
    await this.findOwnedPage(userId, pageId);
    const content = validateEditorDocument(rawContent);
    const latest = await this.latestVersion(pageId);

    const isPublished =
      (await this.prisma.publication.count({ where: { versionId: latest.id } })) > 0 ||
      (await this.prisma.site.count({ where: { publishedVersionId: latest.id } })) > 0;

    const saved = isPublished
      ? await this.createVersionRow(pageId, latest.versionNumber + 1, content, userId)
      : await this.prisma.pageVersion.update({
          where: { id: latest.id },
          data: { content: asJson(content), createdBy: userId },
        });

    await this.prisma.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
    return { versionId: saved.id, versionNumber: saved.versionNumber, savedAt: new Date().toISOString() };
  }

  async listVersions(userId: string, pageId: string) {
    await this.findOwnedPage(userId, pageId);
    return this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, createdBy: true, createdAt: true },
    });
  }

  async getVersion(userId: string, pageId: string, versionId: string) {
    await this.findOwnedPage(userId, pageId);
    const version = await this.prisma.pageVersion.findFirst({ where: { id: versionId, pageId } });
    if (!version) throw new NotFoundException('Versión no encontrada');
    return version;
  }

  /** Crea un punto de restauración (nueva versión), con el contenido dado o copiando el último. */
  async createVersion(userId: string, pageId: string, rawContent?: unknown) {
    await this.findOwnedPage(userId, pageId);
    const latest = await this.latestVersion(pageId);
    const content = rawContent === undefined ? latest.content : validateEditorDocument(rawContent);
    const created = await this.createVersionRow(pageId, latest.versionNumber + 1, content, userId);
    return { versionId: created.id, versionNumber: created.versionNumber, createdAt: created.createdAt };
  }

  /** Restaurar no borra historia: copia esa versión como una versión nueva. */
  async restoreVersion(userId: string, pageId: string, versionId: string) {
    const version = await this.getVersion(userId, pageId, versionId);
    const latest = await this.latestVersion(pageId);
    const created = await this.createVersionRow(pageId, latest.versionNumber + 1, version.content, userId);
    return { versionId: created.id, versionNumber: created.versionNumber, createdAt: created.createdAt };
  }

  // ───────── auxiliares ─────────

  private async createVersionRow(pageId: string, versionNumber: number, content: unknown, userId: string) {
    try {
      return await this.prisma.pageVersion.create({
        data: { pageId, versionNumber, content: asJson(content), createdBy: userId },
      });
    } catch (error) {
      // UNIQUE(page_id, version_number): dos guardados a la vez pidieron el mismo número.
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('La página cambió mientras guardabas. Vuelve a intentarlo.');
      }
      throw error;
    }
  }

  private async latestVersion(pageId: string) {
    const latest = await this.prisma.pageVersion.findFirst({
      where: { pageId },
      orderBy: { versionNumber: 'desc' },
    });
    if (!latest) throw new NotFoundException('La página no tiene versiones');
    return latest;
  }

  private async ensureSlugFree(siteId: string, slug: string) {
    const taken = await this.prisma.page.findFirst({ where: { siteId, slug }, select: { id: true } });
    if (taken) throw new ConflictException('Ya existe una página con ese slug en este sitio');
    return slug;
  }

  private async assertSiteOwned(userId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, userId }, select: { id: true } });
    if (!site) throw new NotFoundException('Sitio no encontrado');
  }

  private async findOwnedPage(userId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, site: { userId } },
      select: pageSummary,
    });
    if (!page) throw new NotFoundException('Página no encontrada');
    return page;
  }
}
