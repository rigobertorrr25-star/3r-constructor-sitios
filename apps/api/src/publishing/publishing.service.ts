import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { slugify, uniqueSlug } from '../common/slug.js';
import { validateEditorDocument } from '../editor/editor-document.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ContactFormDto } from './dto/contact-form.dto.js';
import { renderNotFound, renderPage, renderRobots, renderSitemap } from './render/render.js';
import { PUBLISH_STORAGE, type PublishStorage } from './storage.js';

// Direcciones que no se pueden dar a un cliente: se confundirían con servicios propios.
const RESERVED_LABELS = new Set(['www', 'app', 'api', 'admin', 'mail', 'ftp', 'smtp', 'cdn', 'static', 'assets', 'dashboard', 'login', 'blog', 'ayuda', 'soporte', 'support', 'status']);

const KEEP_PUBLICATIONS = 5;
const PAGE_KEY = /^[a-z0-9-]{1,150}$/;

export interface PublishedFile {
  status: number;
  contentType: string;
  body: string;
}

interface Manifest {
  siteName: string;
  pages: { path: string; file: string }[];
}

@Injectable()
export class PublishingService {
  private readonly rootHost: string;
  private readonly urlTemplate: string;
  private readonly adminEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    @Inject(PUBLISH_STORAGE) private readonly storage: PublishStorage,
    config: ConfigService,
  ) {
    this.rootHost = (config.get<string>('SITES_ROOT_HOST') ?? 'localhost').toLowerCase();
    this.urlTemplate = config.get<string>('SITES_URL_TEMPLATE') ?? 'http://{label}.localhost:3000';
    this.adminEmail = config.get<string>('ADMIN_EMAIL') ?? '';
  }

  private urlFor(label: string) {
    return this.urlTemplate.replace('{label}', label);
  }

  private labelOf(domain: string) {
    return domain.slice(0, -(this.rootHost.length + 1));
  }

  // ───────── publicar ─────────

  async publish(userId: string, siteId: string, ip?: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, userId },
      include: { pages: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, domains: { where: { type: 'subdomain' } } },
    });
    if (!site) throw new NotFoundException('Sitio no encontrado');
    if (site.pages.length === 0) throw new BadRequestException('El sitio no tiene páginas');

    // Contenido más reciente de cada página. Se valida entero antes de publicar nada.
    const rendered: { page: (typeof site.pages)[number]; versionId: string; doc: unknown }[] = [];
    for (const page of site.pages) {
      const version = await this.prisma.pageVersion.findFirst({ where: { pageId: page.id }, orderBy: { versionNumber: 'desc' } });
      if (!version) throw new BadRequestException(`La página "${page.title}" no tiene contenido`);
      try {
        validateEditorDocument(version.content);
      } catch (error) {
        throw new BadRequestException(`La página "${page.title}" no se puede publicar: ${(error as Error).message}`);
      }
      rendered.push({ page, versionId: version.id, doc: version.content });
    }
    const home = rendered.find((r) => r.page.isHomepage) ?? rendered[0];

    const domain = site.domains[0] ?? (await this.allocateDomain(site.id, site.name));
    const label = this.labelOf(domain.domain);

    const publication = await this.prisma.publication.create({
      data: { siteId: site.id, versionId: home.versionId, status: 'building' },
    });
    const job = await this.prisma.deploymentJob.create({
      data: { publicationId: publication.id, siteId: site.id, status: 'running', attempts: 1, startedAt: new Date() },
    });

    try {
      const baseUrl = this.urlFor(label);
      const pathOf = (r: (typeof rendered)[number]) => (r === home ? '/' : `/${r.page.slug}`);
      const files: Record<string, string> = {};
      const manifest: Manifest = { siteName: site.name, pages: [] };

      for (const r of rendered) {
        // El prefijo evita que una página con slug "index" pise la portada.
        const file = r === home ? 'index.html' : `p-${r.page.slug}.html`;
        files[file] = renderPage(
          { title: r.page.title, seoTitle: r.page.seoTitle, seoDescription: r.page.seoDescription, doc: r.doc },
          {
            siteName: site.name,
            isHomepage: r === home,
            nav: rendered.map((other) => ({ label: other.page.title, href: pathOf(other), current: other === r })),
            formAction: `/s/${label}/contact`,
          },
        );
        manifest.pages.push({ path: pathOf(r), file });
      }
      files['sitemap.xml'] = renderSitemap(baseUrl, manifest.pages.map((p) => p.path));
      files['robots.txt'] = renderRobots(baseUrl);
      files['manifest.json'] = JSON.stringify(manifest);

      const dir = `${label}/${publication.id}`;
      await this.storage.put(dir, files);

      const publishedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.publication.update({
          where: { id: publication.id },
          data: { status: 'published', deploymentUrl: baseUrl, storagePath: dir, publishedAt },
        }),
        this.prisma.site.update({ where: { id: site.id }, data: { status: 'published', publishedVersionId: home.versionId } }),
        // SQL directo: con updateMany, Prisma también cambiaría updated_at y publicar contaría como una edición.
        this.prisma.$executeRaw`UPDATE pages SET is_published = true WHERE site_id = ${site.id}::uuid AND is_published = false`,
        this.prisma.deploymentJob.update({ where: { id: job.id }, data: { status: 'succeeded', finishedAt: new Date() } }),
      ]);
      await this.prune(site.id);
      await this.audit.log({ action: 'SITE_PUBLISHED', userId, entityType: 'site', entityId: site.id, metadata: { publicationId: publication.id, pages: rendered.length }, ipAddress: ip });

      return { publicationId: publication.id, url: baseUrl, publishedAt: publishedAt.toISOString(), pages: rendered.length };
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.publication.update({ where: { id: publication.id }, data: { status: 'failed' } }),
        this.prisma.deploymentJob.update({ where: { id: job.id }, data: { status: 'failed', finishedAt: new Date(), errorMessage: (error as Error).message.slice(0, 500) } }),
      ]).catch(() => undefined);
      throw error;
    }
  }

  /** Reserva la dirección del sitio (una sola vez): su nombre, con sufijo si ya está tomada. */
  private async allocateDomain(siteId: string, siteName: string) {
    const label = await uniqueSlug(slugify(siteName), async (candidate) => {
      if (RESERVED_LABELS.has(candidate)) return true;
      const taken = await this.prisma.domain.findUnique({ where: { domain: `${candidate}.${this.rootHost}` }, select: { id: true } });
      return taken !== null;
    });
    return this.prisma.domain.create({
      data: { siteId, domain: `${label}.${this.rootHost}`, type: 'subdomain', verificationStatus: 'verified', sslStatus: 'active', verifiedAt: new Date() },
    });
  }

  /** Conserva solo las últimas publicaciones en disco (permite volver atrás sin acumular basura). */
  private async prune(siteId: string) {
    const old = await this.prisma.publication.findMany({
      where: { siteId, status: 'published', storagePath: { not: null } },
      orderBy: { publishedAt: 'desc' },
      skip: KEEP_PUBLICATIONS,
      select: { id: true, storagePath: true },
    });
    for (const item of old) {
      if (item.storagePath) await this.storage.remove(item.storagePath).catch(() => undefined);
      await this.prisma.publication.update({ where: { id: item.id }, data: { status: 'archived', storagePath: null } });
    }
  }

  async unpublish(userId: string, siteId: string, ip?: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, userId }, select: { id: true } });
    if (!site) throw new NotFoundException('Sitio no encontrado');
    await this.prisma.site.update({ where: { id: siteId }, data: { status: 'draft' } });
    await this.audit.log({ action: 'SITE_UNPUBLISHED', userId, entityType: 'site', entityId: siteId, ipAddress: ip });
    return this.status(userId, siteId);
  }

  // ───────── estado ─────────

  async status(userId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, userId },
      select: { status: true, domains: { where: { type: 'subdomain' }, select: { domain: true } }, pages: { select: { updatedAt: true } } },
    });
    if (!site) throw new NotFoundException('Sitio no encontrado');

    const last = await this.prisma.publication.findFirst({
      where: { siteId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, publishedAt: true },
    });
    const domain = site.domains[0]?.domain;
    const published = site.status === 'published' && !!last;
    const newestEdit = site.pages.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), new Date(0));
    return {
      published,
      url: domain ? this.urlFor(this.labelOf(domain)) : null,
      publishedAt: last?.publishedAt?.toISOString() ?? null,
      hasUnpublishedChanges: published && !!last?.publishedAt && newestEdit > last.publishedAt,
    };
  }

  // ───────── servir ─────────

  /** Archivo público de un sitio publicado. No exige sesión: cualquiera puede ver una página publicada. */
  async serve(label: string, rawPath: string): Promise<PublishedFile> {
    const missing = (siteName = 'este sitio'): PublishedFile => ({ status: 404, contentType: 'text/html; charset=utf-8', body: renderNotFound(siteName) });
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return missing();

    const domain = await this.prisma.domain.findUnique({
      where: { domain: `${label}.${this.rootHost}` },
      select: { site: { select: { id: true, status: true, name: true } } },
    });
    if (!domain || domain.site.status !== 'published') return missing();

    const publication = await this.prisma.publication.findFirst({
      where: { siteId: domain.site.id, status: 'published', storagePath: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { storagePath: true },
    });
    if (!publication?.storagePath) return missing(domain.site.name);

    const dir = publication.storagePath;
    const key = rawPath.replace(/^\/+|\/+$/g, '').toLowerCase().replace(/\.html$/, '');

    if (key === 'robots.txt' || key === 'sitemap.xml') {
      const body = await this.storage.get(dir, key);
      return body === null
        ? missing(domain.site.name)
        : { status: 200, contentType: key === 'robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8', body };
    }

    if (key !== '' && !PAGE_KEY.test(key)) return missing(domain.site.name);
    const manifestText = await this.storage.get(dir, 'manifest.json');
    const manifest = manifestText ? (JSON.parse(manifestText) as Manifest) : null;
    const entry = manifest?.pages.find((p) => p.path === (key === '' ? '/' : `/${key}`));
    if (!entry) return missing(domain.site.name);

    const body = await this.storage.get(dir, entry.file);
    return body === null ? missing(domain.site.name) : { status: 200, contentType: 'text/html; charset=utf-8', body };
  }

  // ───────── formulario de contacto ─────────

  /** A dónde llega el aviso: el correo del cliente dueño del pedido; si no hay pedido, al equipo. */
  private async contactRecipient(siteId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({ where: { siteId }, select: { user: { select: { email: true } } } });
    return order?.user.email ?? (this.adminEmail || null);
  }

  async submitContact(label: string, dto: ContactFormDto): Promise<{ ok: true }> {
    // Honeypot: un visitante real nunca llena este campo (está oculto en la página). Se responde
    // "listo" igual, para no delatarle al bot que lo detectamos.
    if (dto.website) return { ok: true };
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return { ok: true };

    const domain = await this.prisma.domain.findUnique({
      where: { domain: `${label}.${this.rootHost}` },
      select: { site: { select: { id: true, name: true, status: true } } },
    });
    if (!domain || domain.site.status !== 'published') return { ok: true };

    await this.prisma.formSubmission.create({
      data: { siteId: domain.site.id, name: dto.name, email: dto.email, phone: dto.phone, message: dto.message },
    });

    const to = await this.contactRecipient(domain.site.id);
    if (to) {
      await this.email.sendSiteContactMessage(to, {
        siteName: domain.site.name,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        message: dto.message,
      });
    }
    // Aviso automático al visitante: no es una IA respondiendo, solo confirma que el mensaje llegó.
    await this.email.sendSiteContactAutoReply(dto.email, { siteName: domain.site.name, name: dto.name }, to ?? undefined);
    return { ok: true };
  }
}
