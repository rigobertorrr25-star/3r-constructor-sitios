import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { atLeast, roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DOCUMENT_MAX_BYTES, DOCUMENT_STORAGE, DOCUMENT_TYPES, type DocumentStorage } from './document-storage.js';
import { COMPANY_CATEGORIES, DOCUMENTS_MODULE, EMPLOYEE_CATEGORIES } from './documents.constants.js';
import type { RequestUploadDto, UpdateDocumentDto } from './dto/documents.dto.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;
type Doc = Prisma.CompanyDocumentGetPayload<{ select: typeof docSelect }>;

const docSelect = {
  id: true,
  memberId: true,
  category: true,
  title: true,
  fileName: true,
  contentType: true,
  size: true,
  storageKey: true,
  status: true,
  audience: true,
  expiresOn: true,
  uploadedById: true,
  createdAt: true,
  member: { select: { id: true, role: true } },
} as const;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Esa fecha no existe');
  return date;
};
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
/** Nombre de archivo seguro para guardar y descargar: sin rutas ni caracteres de control. */
const safeFileName = (n: string) => n.replace(/[\\/\u0000-\u001f"]/g, '_').slice(-200) || 'documento';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly audit: AuditService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  private async access(userId: string, companyId: string) {
    const member = await this.companies.requireMember(userId, companyId);
    await this.companies.requireModule(companyId, DOCUMENTS_MODULE);
    return member;
  }

  private above(me: Member, role: string) {
    return me.role === 'owner' || roleRank(me.role) > roleRank(role);
  }

  /** Documentos de un empleado: los ve él mismo y RR. HH. en adelante sobre alguien de menor rango. */
  private canSeeMember(me: Member, target: { id: string; role: string }) {
    return target.id === me.id || (atLeast(me.role, 'hr') && this.above(me, target.role));
  }

  private canSee(me: Member, d: Doc) {
    if (!d.memberId) return d.audience === 'all' || atLeast(me.role, 'hr');
    return !!d.member && this.canSeeMember(me, d.member);
  }

  /** Cambiar o borrar: RR. HH. (sobre quien corresponde); el empleado solo borra lo que él mismo subió. */
  private canManage(me: Member, d: Doc, userId: string) {
    if (!d.memberId) return atLeast(me.role, 'hr');
    if (!d.member) return false;
    if (atLeast(me.role, 'hr') && this.above(me, d.member.role)) return true;
    return d.memberId === me.id && d.uploadedById === userId;
  }

  private async uploaders(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const users = unique.length ? await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, email: true } }) : [];
    return new Map(users.map((u) => [u.id, name(u)]));
  }

  private shape(me: Member, d: Doc, userId: string, who: Map<string, string>) {
    return {
      id: d.id,
      memberId: d.memberId,
      category: d.category,
      title: d.title,
      fileName: d.fileName,
      contentType: d.contentType,
      size: d.size,
      audience: d.audience,
      expiresOn: day(d.expiresOn),
      uploadedBy: d.uploadedById ? (who.get(d.uploadedById) ?? null) : null,
      createdAt: d.createdAt,
      can: { manage: this.canManage(me, d, userId) },
    };
  }

  private async target(companyId: string, memberId: string) {
    const t = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      select: { id: true, role: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!t) throw new NotFoundException('Esa persona no está en la empresa');
    return t;
  }

  /** Sin `memberId`: los de la empresa. Con `memberId`: los de ese empleado (si lo puedo ver). */
  async list(userId: string, companyId: string, memberId?: string) {
    const me = await this.access(userId, companyId);
    let where: Prisma.CompanyDocumentWhereInput;
    let owner: { id: string; name: string } | null = null;
    if (memberId) {
      const t = await this.target(companyId, memberId);
      if (!this.canSeeMember(me, t)) throw new NotFoundException('Esa persona no está en la empresa');
      owner = { id: t.id, name: name(t.user) };
      where = { companyId, memberId, status: 'ready' };
    } else {
      where = { companyId, memberId: null, status: 'ready', ...(atLeast(me.role, 'hr') ? {} : { audience: 'all' }) };
    }
    const rows = await this.prisma.companyDocument.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500, select: docSelect });
    const who = await this.uploaders(rows.map((r) => r.uploadedById));
    return { owner, canUpload: memberId ? memberId === me.id || atLeast(me.role, 'hr') : atLeast(me.role, 'hr'), documents: rows.map((d) => this.shape(me, d, userId, who)) };
  }

  /** Personas cuyas carpetas puedo abrir (para RR. HH.). */
  async folders(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const members = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, jobTitle: true, user: { select: { firstName: true, lastName: true, email: true } }, _count: { select: { documents: { where: { status: 'ready' } } } } },
    });
    return members
      .filter((m) => this.canSeeMember(me, m))
      .map((m) => ({ id: m.id, name: name(m.user), jobTitle: m.jobTitle, count: m._count.documents, self: m.id === me.id }));
  }

  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const today = todayBogota();
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + 30);
    const [company, mine, expiring] = await Promise.all([
      this.prisma.companyDocument.count({ where: { companyId, memberId: null, status: 'ready', ...(atLeast(me.role, 'hr') ? {} : { audience: 'all' }) } }),
      this.prisma.companyDocument.count({ where: { companyId, memberId: me.id, status: 'ready' } }),
      atLeast(me.role, 'hr')
        ? this.prisma.companyDocument.findMany({
            where: { companyId, status: 'ready', expiresOn: { lte: limit } },
            orderBy: { expiresOn: 'asc' },
            take: 50,
            select: { ...docSelect, member: { select: { id: true, role: true, user: { select: { firstName: true, lastName: true, email: true } } } } },
          })
        : Promise.resolve([]),
    ]);
    const visible = expiring.filter((d) => !d.member || this.above(me, d.member.role) || d.memberId === me.id);
    return {
      company,
      mine,
      expiring: visible.map((d) => ({
        id: d.id,
        title: d.title,
        expiresOn: day(d.expiresOn),
        expired: day(d.expiresOn)! < today,
        memberId: d.memberId,
        person: d.member ? name(d.member.user) : null,
      })),
    };
  }

  async requestUpload(userId: string, companyId: string, dto: RequestUploadDto, origin: string) {
    const me = await this.access(userId, companyId);
    if (dto.memberId) {
      const t = await this.target(companyId, dto.memberId);
      if (!(t.id === me.id || (atLeast(me.role, 'hr') && this.above(me, t.role)))) throw new ForbiddenException('No puedes subir documentos a esta persona');
      if (!(EMPLOYEE_CATEGORIES as readonly string[]).includes(dto.category)) throw new BadRequestException('Elige qué tipo de documento es');
    } else {
      if (!atLeast(me.role, 'hr')) throw new ForbiddenException('Solo Recursos Humanos sube documentos de la empresa');
      if (!(COMPANY_CATEGORIES as readonly string[]).includes(dto.category)) throw new BadRequestException('Elige qué tipo de documento es');
    }
    const key = `${randomUUID()}.${DOCUMENT_TYPES[dto.contentType]}`;
    const doc = await this.prisma.companyDocument.create({
      data: {
        companyId,
        memberId: dto.memberId ?? null,
        category: dto.category,
        title: dto.title,
        fileName: safeFileName(dto.fileName),
        contentType: dto.contentType,
        size: dto.size,
        storageKey: key,
        audience: dto.memberId ? 'all' : (dto.audience ?? 'all'),
        expiresOn: dto.expiresOn ? toDate(dto.expiresOn) : null,
        uploadedById: userId,
      },
      select: { id: true },
    });
    return { documentId: doc.id, upload: await this.storage.presignUpload(key, dto.contentType, origin) };
  }

  /** Después de subir: comprueba que el archivo llegó y lo deja disponible. */
  async confirm(userId: string, companyId: string, documentId: string) {
    const me = await this.access(userId, companyId);
    const d = await this.prisma.companyDocument.findFirst({ where: { id: documentId, companyId, status: 'pending', uploadedById: userId }, select: docSelect });
    if (!d) throw new NotFoundException('Documento no encontrado');
    const size = await this.storage.size(d.storageKey);
    if (size === null) throw new BadRequestException('El archivo no llegó. Inténtalo otra vez.');
    if (size > DOCUMENT_MAX_BYTES) {
      await this.storage.remove(d.storageKey);
      await this.prisma.companyDocument.delete({ where: { id: d.id } });
      throw new BadRequestException('El archivo pesa más de 20 MB.');
    }
    const ready = await this.prisma.companyDocument.update({ where: { id: d.id }, data: { status: 'ready', size }, select: docSelect });
    return this.shape(me, ready, userId, await this.uploaders([ready.uploadedById]));
  }

  private async findVisible(me: Member, companyId: string, documentId: string) {
    const d = await this.prisma.companyDocument.findFirst({ where: { id: documentId, companyId, status: 'ready' }, select: docSelect });
    if (!d || !this.canSee(me, d)) throw new NotFoundException('Documento no encontrado');
    return d;
  }

  async download(userId: string, companyId: string, documentId: string, origin: string) {
    const me = await this.access(userId, companyId);
    const d = await this.findVisible(me, companyId, documentId);
    // Los documentos de un empleado son datos personales: queda constancia de quién los descargó.
    if (d.memberId && d.memberId !== me.id) {
      await this.audit.log({ action: 'COMPANY_DOCUMENT_DOWNLOADED', userId, entityType: 'company', entityId: companyId, metadata: { documentId: d.id, memberId: d.memberId } });
    }
    return { url: await this.storage.presignDownload(d.storageKey, d.fileName, d.contentType, origin) };
  }

  async update(userId: string, companyId: string, documentId: string, dto: UpdateDocumentDto) {
    const me = await this.access(userId, companyId);
    const d = await this.findVisible(me, companyId, documentId);
    if (!this.canManage(me, d, userId)) throw new ForbiddenException('No puedes cambiar este documento');
    const allowed = d.memberId ? EMPLOYEE_CATEGORIES : COMPANY_CATEGORIES;
    if (dto.category && !(allowed as readonly string[]).includes(dto.category)) throw new BadRequestException('Elige qué tipo de documento es');
    const updated = await this.prisma.companyDocument.update({
      where: { id: d.id },
      data: {
        title: dto.title,
        category: dto.category,
        audience: d.memberId ? undefined : dto.audience,
        expiresOn: dto.expiresOn === undefined ? undefined : toDate(dto.expiresOn),
      },
      select: docSelect,
    });
    return this.shape(me, updated, userId, await this.uploaders([updated.uploadedById]));
  }

  async remove(userId: string, companyId: string, documentId: string) {
    const me = await this.access(userId, companyId);
    const d = await this.findVisible(me, companyId, documentId);
    if (!this.canManage(me, d, userId)) throw new ForbiddenException('No puedes borrar este documento');
    await this.prisma.companyDocument.delete({ where: { id: d.id } });
    await this.storage.remove(d.storageKey).catch(() => undefined);
    await this.audit.log({ action: 'COMPANY_DOCUMENT_DELETED', userId, entityType: 'company', entityId: companyId, metadata: { documentId: d.id, memberId: d.memberId, title: d.title } });
  }
}
