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
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AutosaveDto, CreatePageDto, CreateVersionDto, UpdatePageDto } from './dto/page.dto.js';
import { PagesService } from './pages.service.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('sites/:siteId/pages')
  list(@CurrentUser() user: AuthUser, @Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.pages.list(user.id, siteId);
  }

  @Post('sites/:siteId/pages')
  create(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreatePageDto,
  ) {
    return this.pages.create(user.id, siteId, dto);
  }

  @Get('pages/:pageId')
  get(@CurrentUser() user: AuthUser, @Param('pageId', ParseUUIDPipe) pageId: string) {
    return this.pages.get(user.id, pageId);
  }

  @Patch('pages/:pageId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pages.update(user.id, pageId, dto);
  }

  @Delete('pages/:pageId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('pageId', ParseUUIDPipe) pageId: string) {
    await this.pages.remove(user.id, pageId);
  }

  @Get('pages/:pageId/content')
  content(@CurrentUser() user: AuthUser, @Param('pageId', ParseUUIDPipe) pageId: string) {
    return this.pages.getContent(user.id, pageId);
  }

  @Post('pages/:pageId/autosave')
  @HttpCode(200)
  autosave(
    @CurrentUser() user: AuthUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: AutosaveDto,
  ) {
    return this.pages.autosave(user.id, pageId, dto.content);
  }

  @Get('pages/:pageId/versions')
  versions(@CurrentUser() user: AuthUser, @Param('pageId', ParseUUIDPipe) pageId: string) {
    return this.pages.listVersions(user.id, pageId);
  }

  @Post('pages/:pageId/versions')
  createVersion(
    @CurrentUser() user: AuthUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.pages.createVersion(user.id, pageId, dto.content);
  }

  @Get('pages/:pageId/versions/:versionId')
  version(
    @CurrentUser() user: AuthUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.pages.getVersion(user.id, pageId, versionId);
  }

  @Post('pages/:pageId/versions/:versionId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.pages.restoreVersion(user.id, pageId, versionId);
  }
}
