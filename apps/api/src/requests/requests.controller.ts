import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CreateRequestDto, DecideRequestDto } from './dto/requests.dto.js';
import { RequestsService } from './requests.service.js';

/** Permisos, vacaciones, incapacidades y certificados: el empleado pide, el supervisor aprueba, RR. HH. confirma. */
@Controller('companies/:companyId/requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.requests.summary(user.id, companyId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('view') view?: string,
    @Query('type') type?: string,
  ) {
    return this.requests.list(user.id, companyId, { view, type });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateRequestDto) {
    return this.requests.create(user.id, companyId, dto);
  }

  @Get(':requestId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.requests.get(user.id, companyId, requestId);
  }

  @Post(':requestId/decision')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideRequestDto,
  ) {
    return this.requests.decide(user.id, companyId, requestId, dto);
  }

  @Post(':requestId/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.requests.cancel(user.id, companyId, requestId);
  }
}
