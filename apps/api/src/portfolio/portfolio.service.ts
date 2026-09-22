import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePortfolioItemDto, UpdatePortfolioItemDto } from './dto/portfolio.dto.js';

const publicSelect = {
  id: true,
  title: true,
  url: true,
  category: true,
  description: true,
  thumbnailUrl: true,
  sortOrder: true,
} as const;

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPublic() {
    return this.prisma.portfolioItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: publicSelect,
    });
  }

  listAll() {
    return this.prisma.portfolioItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: { ...publicSelect, isActive: true },
    });
  }

  async create(adminId: string, dto: CreatePortfolioItemDto, ip?: string) {
    const item = await this.prisma.portfolioItem.create({ data: dto, select: { ...publicSelect, isActive: true } });
    await this.audit.log({ action: 'PORTFOLIO_CREATED', userId: adminId, entityType: 'portfolio_item', entityId: item.id, ipAddress: ip });
    return item;
  }

  async update(adminId: string, id: string, dto: UpdatePortfolioItemDto, ip?: string) {
    const exists = await this.prisma.portfolioItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Ejemplo no encontrado');
    const { thumbnailUrl, ...rest } = dto;
    const item = await this.prisma.portfolioItem.update({
      where: { id },
      data: { ...rest, ...(thumbnailUrl !== undefined ? { thumbnailUrl: thumbnailUrl || null } : {}) },
      select: { ...publicSelect, isActive: true },
    });
    await this.audit.log({ action: 'PORTFOLIO_UPDATED', userId: adminId, entityType: 'portfolio_item', entityId: id, ipAddress: ip });
    return item;
  }

  async remove(adminId: string, id: string, ip?: string) {
    const exists = await this.prisma.portfolioItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Ejemplo no encontrado');
    await this.prisma.portfolioItem.delete({ where: { id } });
    await this.audit.log({ action: 'PORTFOLIO_DELETED', userId: adminId, entityType: 'portfolio_item', entityId: id, ipAddress: ip });
  }
}
