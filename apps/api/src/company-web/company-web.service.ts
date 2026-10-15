import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { validateEditorDocument } from '../editor/editor-document.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MEDIA_STORAGE, MEDIA_TYPES, type MediaStorage } from '../media/media-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublishingService } from '../publishing/publishing.service.js';
import { safeImageUrl, safeUrl } from '../publishing/render/values.js';
import type { FieldChangeDto } from './dto/company-web.dto.js';

/** Clave del módulo en el catálogo de la plataforma. */
export const WEB_MODULE = 'web';
/** Lo que el cliente puede cambiar: textos, botones, fotos y la dirección del mapa. Nunca el diseño. */
const EDITABLE = ['heading', 'text', 'button', 'image', 'map'] as const;
type Kind = (typeof EDITABLE)[number];
const SECTION_LABEL: Record<string, string> = { hero: 'Portada', content: 'Contenido', cta: 'Llamado a la acción', blank: 'Sección' };

type Node = { id: string; type: string; content?: string; props?: Record<string, unknown>; components?: Node[] };
type Section = { id: string; type: string; components: Node[] };
export type Field = { nodeId: string; kind: Kind; content?: string; href?: string; src?: string; alt?: string; address?: string };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Recorre una sección y saca los campos que se pueden editar, en el orden en que aparecen. */
function fieldsOf(nodes: Node[], out: Field[] = []): Field[] {
  for (const n of nodes) {
    if ((EDITABLE as readonly string[]).includes(n.type)) {
      const p = n.props ?? {};
      const kind = n.type as Kind;
      if (kind === 'heading' || kind === 'text') out.push({ nodeId: n.id, kind, content: str(n.content) });
      else if (kind === 'button') out.push({ nodeId: n.id, kind, content: str(n.content), href: str(p.href) });
      else if (kind === 'image') out.push({ nodeId: n.id, kind, src: str(p.src), alt: str(p.alt) });
      else out.push({ nodeId: n.id, kind, address: str(p.address) });
    }
    if (n.components?.length) fieldsOf(n.components, out);
  }
  return out;
}

function findNode(nodes: Node[], id: string): Node | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inner = n.components?.length ? findNode(n.components, id) : null;
    if (inner) return inner;
  }
  return null;
}

@Injectable()
export class CompanyWebService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly publishing: PublishingService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly media: MediaStorage,
  ) {}

  /** Ver es para todo el equipo; cambiar y publicar, para los administradores de la empresa. */
  private async access(userId: string, companyId: string, min: 'employee' | 'admin' = 'admin') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, WEB_MODULE);
    const c = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { siteId: true } });
    return { me, siteId: c.siteId };
  }

  private async page(siteId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, siteId }, select: { id: true, title: true, slug: true, isHomepage: true } });
    if (!page) throw new NotFoundException('Página no encontrada');
    const version = await this.prisma.pageVersion.findFirst({
      where: { pageId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, content: true },
    });
    if (!version) throw new NotFoundException('Esta página todavía no tiene contenido');
    return { page, version };
  }

  async overview(userId: string, companyId: string) {
    const { me, siteId } = await this.access(userId, companyId, 'employee');
    const canEdit = atLeast(me.role, 'admin');
    if (!siteId) return { canEdit, site: null };
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        pages: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, title: true, slug: true, isHomepage: true } },
      },
    });
    return { canEdit, site: { ...site, publication: await this.publishing.status(userId, siteId, false) } };
  }

  /** Los campos de una página, agrupados por sección. */
  async pageFields(userId: string, companyId: string, pageId: string) {
    const { siteId } = await this.access(userId, companyId);
    if (!siteId) throw new NotFoundException('La empresa no tiene una página vinculada');
    const { page, version } = await this.page(siteId, pageId);
    const doc = version.content as unknown as { sections: Section[] };
    let n = 0;
    const sections = doc.sections
      .map((s) => ({ id: s.id, label: `${SECTION_LABEL[s.type] ?? 'Sección'} ${++n}`, fields: fieldsOf(s.components) }))
      .filter((s) => s.fields.length);
    return { page, versionId: version.id, sections };
  }

  private apply(node: Node, c: FieldChangeDto) {
    const props = { ...(node.props ?? {}) } as Record<string, string | number | boolean>;
    const bad = (m: string) => new BadRequestException(m);
    switch (node.type) {
      case 'heading':
        if (c.content !== undefined) {
          if (!c.content.trim()) throw bad('Un título no puede quedar vacío');
          if (c.content.length > 300) throw bad('Un título es muy largo (máximo 300 letras)');
          node.content = c.content;
        }
        break;
      case 'text':
        if (c.content !== undefined) node.content = c.content;
        break;
      case 'button':
        if (c.content !== undefined) {
          if (!c.content.trim() || c.content.length > 80) throw bad('El texto de un botón va de 1 a 80 letras');
          node.content = c.content;
        }
        if (c.href !== undefined) {
          if (c.href.trim() && !safeUrl(c.href)) throw bad('El enlace de un botón debe empezar por https://, mailto:, tel: o /');
          props.href = c.href.trim();
        }
        break;
      case 'image':
        if (c.src !== undefined) {
          if (c.src.trim() && !safeImageUrl(c.src)) throw bad('La foto debe ser un enlace https://');
          props.src = c.src.trim();
        }
        if (c.alt !== undefined) props.alt = c.alt.trim();
        break;
      case 'map':
        if (c.address !== undefined) props.address = c.address.trim();
        break;
      default:
        throw bad('Esa parte de la página no se puede editar desde aquí');
    }
    node.props = props;
  }

  /** Guarda los cambios como una versión nueva (el equipo de 3R puede volver atrás desde el editor). */
  async saveFields(userId: string, companyId: string, pageId: string, baseVersionId: string, changes: FieldChangeDto[]) {
    const { siteId } = await this.access(userId, companyId);
    if (!siteId) throw new NotFoundException('La empresa no tiene una página vinculada');
    const { version } = await this.page(siteId, pageId);
    if (version.id !== baseVersionId)
      throw new ConflictException('Alguien cambió esta página mientras la editabas. Recarga para ver la versión más reciente.');
    if (!changes.length) return { versionId: version.id, changed: 0 };
    const doc = structuredClone(version.content) as unknown as { sections: Section[] };
    for (const c of changes) {
      const node = doc.sections.map((s) => findNode(s.components, c.nodeId)).find(Boolean);
      if (!node) throw new BadRequestException('La página cambió; recarga para ver la versión más reciente');
      this.apply(node, c);
    }
    try {
      validateEditorDocument(doc);
    } catch (e) {
      throw new BadRequestException(`No se pudo guardar: ${(e as Error).message}`);
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const v = await tx.pageVersion.create({
        data: { pageId, versionNumber: version.versionNumber + 1, content: doc as unknown as Prisma.InputJsonValue, createdBy: userId },
        select: { id: true },
      });
      // Así el estado de publicación sabe que hay cambios sin publicar.
      await tx.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
      return v;
    });
    await this.audit.log({
      action: 'COMPANY_SITE_EDITED',
      userId,
      entityType: 'site',
      entityId: siteId,
      metadata: { companyId, pageId, changes: changes.length },
    });
    return { versionId: created.id, changed: changes.length };
  }

  async publish(userId: string, companyId: string, ip?: string) {
    const { siteId } = await this.access(userId, companyId);
    if (!siteId) throw new NotFoundException('La empresa no tiene una página vinculada');
    return this.publishing.publish(userId, siteId, ip, false);
  }

  async presignImage(userId: string, companyId: string, contentType: string, origin: string) {
    await this.access(userId, companyId);
    return this.media.presignUpload(`web-${companyId}-${randomUUID()}.${MEDIA_TYPES[contentType]}`, contentType, origin);
  }

  // ───────── equipo de 3R ─────────

  /** Páginas que se pueden vincular (con el cliente del pedido, para no confundirse). */
  async adminOptions(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { siteId: true } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const sites = await this.prisma.site.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        name: true,
        status: true,
        order: { select: { orderNumber: true, user: { select: { email: true } } } },
        company: { select: { id: true, name: true } },
      },
    });
    return {
      siteId: company.siteId,
      options: sites.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        order: s.order ? { number: s.order.orderNumber, client: s.order.user.email } : null,
        linkedTo: s.company && s.company.id !== companyId ? s.company.name : null,
      })),
    };
  }

  async adminLink(adminId: string, companyId: string, siteId: string | null, ip?: string) {
    if (siteId) {
      const other = await this.prisma.company.findFirst({ where: { siteId, id: { not: companyId } }, select: { name: true } });
      if (other) throw new BadRequestException(`Esa página ya está vinculada a ${other.name}`);
      if (!(await this.prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }))) throw new NotFoundException('Página no encontrada');
    }
    await this.prisma.company.update({ where: { id: companyId }, data: { siteId } });
    await this.audit.log({
      action: 'COMPANY_SITE_LINKED',
      userId: adminId,
      entityType: 'company',
      entityId: companyId,
      metadata: { siteId },
      ipAddress: ip,
    });
    return this.adminOptions(companyId);
  }
}
