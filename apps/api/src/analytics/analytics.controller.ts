import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AnalyticsService } from './analytics.service.js';

/** Analítica de la página (y la tienda) de la empresa. */
@Controller('companies/:companyId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  report(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Query('days') days?: string) {
    return this.analytics.report(user.id, companyId, Number(days) || 30);
  }
}
