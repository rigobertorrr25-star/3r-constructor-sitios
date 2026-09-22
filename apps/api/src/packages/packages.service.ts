import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePackageDto, UpdatePackageDto } from './dto/package.dto.js';

const publicSelect = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  description: true,
  priceCents: true,
  monthlyPriceCents: true,
  currency: true,
  features: true,
  pagesIncluded: true,
  deliveryDays: true,
  isFeatured: true,
  sortOrder: true,
} as const;

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lo que ve cualquier visitante: solo paquetes activos. */
  listPublic() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: publicSelect,
    });
  }

  listAll() {
    return this.prisma.package.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: { ...publicSelect, isActive: true, createdAt: true, _count: { select: { orders: true } } },
    });
  }

  async create(adminId: string, dto: CreatePackageDto, ip?: string) {
    await this.ensureSlugFree(dto.slug);
    const created = await this.prisma.package.create({
      data: { ...dto, features: (dto.features ?? []) as Prisma.InputJsonValue },
      select: { ...publicSelect, isActive: true },
    });
    await this.audit.log({ action: 'PACKAGE_CREATED', userId: adminId, entityType: 'package', entityId: created.id, ipAddress: ip });
    return created;
  }

  async update(adminId: string, packageId: string, dto: UpdatePackageDto, ip?: string) {
    const current = await this.prisma.package.findUnique({ where: { id: packageId }, select: { id: true, slug: true } });
    if (!current) throw new NotFoundException('Paquete no encontrado');
    if (dto.slug && dto.slug !== current.slug) await this.ensureSlugFree(dto.slug);

    const { features, ...rest } = dto;
    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { ...rest, ...(features ? { features: features as Prisma.InputJsonValue } : {}) },
      select: { ...publicSelect, isActive: true },
    });
    // Los pedidos existentes conservan el precio con el que se compraron.
    await this.audit.log({
      action: 'PACKAGE_UPDATED',
      userId: adminId,
      entityType: 'package',
      entityId: packageId,
      metadata: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
      ipAddress: ip,
    });
    return updated;
  }

  private async ensureSlugFree(slug: string) {
    const taken = await this.prisma.package.findUnique({ where: { slug }, select: { id: true } });
    if (taken) throw new ConflictException('Ya existe un paquete con ese slug');
  }
}
