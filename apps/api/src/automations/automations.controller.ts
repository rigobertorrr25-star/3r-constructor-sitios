import { Body, Controller, Delete, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AutomationsService } from './automations.service.js';
import { SaveAutomationDto } from './dto/automations.dto.js';

/** Automatizaciones de la empresa: si pasa X, hacer Y. */
@Controller('companies/:companyId/automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.automations.list(user.id, companyId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveAutomationDto) {
    return this.automations.create(user.id, companyId, dto);
  }

  @Put(':automationId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Body() dto: SaveAutomationDto,
  ) {
    return this.automations.update(user.id, companyId, automationId, dto);
  }

  @Patch(':automationId')
  @HttpCode(200)
  toggle(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
    @Query('active', ParseBoolPipe) active: boolean,
  ) {
    return this.automations.toggle(user.id, companyId, automationId, active);
  }

  @Delete(':automationId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('automationId', ParseUUIDPipe) automationId: string,
  ) {
    return this.automations.remove(user.id, companyId, automationId);
  }
}
