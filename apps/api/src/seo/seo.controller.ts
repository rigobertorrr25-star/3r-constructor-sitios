import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { PageMetaDto } from './dto/seo.dto.js';
import { SeoService } from './seo.service.js';

/** SEO: revisión de la página de la empresa y su título y descripción para Google. */
@Controller('companies/:companyId/seo')
@UseGuards(JwtAuthGuard)
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  report(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.seo.report(user.id, companyId);
  }

  @Put('pages/:pageId')
  saveMeta(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: PageMetaDto,
  ) {
    return this.seo.saveMeta(user.id, companyId, pageId, dto);
  }
}
