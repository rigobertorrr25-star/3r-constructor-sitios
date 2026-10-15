import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AiContentService } from './ai-content.service.js';
import { GenerateDto } from './dto/ai-content.dto.js';

/** Textos con IA: publicaciones, descripciones, correos, textos de la página. */
@Controller('companies/:companyId/ai-content')
@UseGuards(JwtAuthGuard)
export class AiContentController {
  constructor(private readonly content: AiContentService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.content.overview(user.id, companyId);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  generate(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: GenerateDto) {
    return this.content.generate(user.id, companyId, dto);
  }
}
