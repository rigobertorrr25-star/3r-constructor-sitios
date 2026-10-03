import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { LinkSiteDto, SavePageContentDto, WebImageDto } from './dto/company-web.dto.js';
import { CompanyWebService } from './company-web.service.js';

const originOf = (req: Request) => `${req.protocol}://${req.get('host')}`;

/** Constructor web: la empresa cambia los textos y las fotos de su página, y la publica. */
@Controller('companies/:companyId/web')
@UseGuards(JwtAuthGuard)
export class CompanyWebController {
  constructor(private readonly web: CompanyWebService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.web.overview(user.id, companyId);
  }

  @Get('pages/:pageId')
  fields(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('pageId', ParseUUIDPipe) pageId: string) {
    return this.web.pageFields(user.id, companyId, pageId);
  }

  @Put('pages/:pageId')
  save(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: SavePageContentDto,
  ) {
    return this.web.saveFields(user.id, companyId, pageId, dto.baseVersionId, dto.changes);
  }

  @Post('publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Req() req: Request) {
    return this.web.publish(user.id, companyId, req.ip);
  }

  @Post('images/presign')
  @HttpCode(200)
  presign(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: WebImageDto, @Req() req: Request) {
    return this.web.presignImage(user.id, companyId, dto.contentType, originOf(req));
  }
}

/** El equipo de 3R vincula la página de un pedido con la empresa del cliente. */
@Controller('admin/companies/:companyId/site')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminCompanyWebController {
  constructor(private readonly web: CompanyWebService) {}

  @Get()
  options(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.web.adminOptions(companyId);
  }

  @Put()
  link(@CurrentUser() admin: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: LinkSiteDto, @Req() req: Request) {
    return this.web.adminLink(admin.id, companyId, dto.siteId, req.ip);
  }
}
