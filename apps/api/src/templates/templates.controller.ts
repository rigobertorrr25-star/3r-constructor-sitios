import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista las plantillas activas. El contenido completo no se envía en el listado. */
  @Get()
  list() {
    return this.prisma.template.findMany({
      where: { isActive: true },
      orderBy: [{ isPremium: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        thumbnailUrl: true,
        isPremium: true,
      },
    });
  }
}
