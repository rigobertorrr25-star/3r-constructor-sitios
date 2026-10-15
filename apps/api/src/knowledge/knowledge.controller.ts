import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { SaveArticleDto, VoteDto } from './dto/knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Centro de conocimiento: manuales y procesos del equipo, y preguntas frecuentes para clientes. */
@Controller('companies/:companyId/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    return this.knowledge.list(user.id, companyId, str(q), str(category));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveArticleDto) {
    return this.knowledge.create(user.id, companyId, dto);
  }

  @Post('public-link')
  @HttpCode(200)
  enablePublic(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.knowledge.enablePublic(user.id, companyId);
  }

  @Delete('public-link')
  @HttpCode(204)
  disablePublic(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.knowledge.disablePublic(user.id, companyId);
  }

  @Get(':articleId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('articleId', ParseUUIDPipe) articleId: string) {
    return this.knowledge.get(user.id, companyId, articleId);
  }

  @Put(':articleId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() dto: SaveArticleDto,
  ) {
    return this.knowledge.update(user.id, companyId, articleId, dto);
  }

  @Delete(':articleId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('articleId', ParseUUIDPipe) articleId: string) {
    return this.knowledge.remove(user.id, companyId, articleId);
  }

  @Post(':articleId/vote')
  @HttpCode(200)
  vote(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() dto: VoteDto,
  ) {
    return this.knowledge.vote(user.id, companyId, articleId, dto.helpful);
  }
}

/** Centro de ayuda público de una empresa (/ayuda/[token]), sin cuenta. */
@Controller('public/help')
export class PublicHelpController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get(':token')
  list(@Param('token') token: string, @Query('q') q?: string, @Query('category') category?: string) {
    return this.knowledge.publicList(token, str(q), str(category));
  }

  @Get(':token/:articleId')
  get(@Param('token') token: string, @Param('articleId') articleId: string) {
    return this.knowledge.publicGet(token, articleId);
  }

  @Post(':token/:articleId/vote')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  vote(@Param('token') token: string, @Param('articleId') articleId: string, @Body() dto: VoteDto) {
    return this.knowledge.publicVote(token, articleId, dto.helpful);
  }
}
