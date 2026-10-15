import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AnnouncementsService } from './announcements.service.js';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcements.dto.js';

/** Comunicados de la empresa: noticias, avisos y eventos para todo el equipo. */
@Controller('companies/:companyId/announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.announcements.summary(user.id, companyId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.announcements.list(user.id, companyId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(user.id, companyId, dto);
  }

  /** Abrirlo lo marca como leído. */
  @Get(':announcementId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('announcementId', ParseUUIDPipe) id: string) {
    return this.announcements.get(user.id, companyId, id);
  }

  @Patch(':announcementId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('announcementId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(user.id, companyId, id, dto);
  }

  @Delete(':announcementId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('announcementId', ParseUUIDPipe) id: string) {
    return this.announcements.remove(user.id, companyId, id);
  }
}
