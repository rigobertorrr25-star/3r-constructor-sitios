import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CreateSiteDto, UpdateSiteDto } from './dto/site.dto.js';
import { SitesService } from './sites.service.js';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.sites.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSiteDto, @Req() req: { ip?: string }) {
    return this.sites.create(user.id, dto, req.ip);
  }

  @Get(':siteId')
  get(@CurrentUser() user: AuthUser, @Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.sites.get(user.id, siteId);
  }

  @Patch(':siteId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sites.update(user.id, siteId, dto);
  }

  @Delete(':siteId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Req() req: { ip?: string },
  ) {
    await this.sites.remove(user.id, siteId, req.ip);
  }
}
