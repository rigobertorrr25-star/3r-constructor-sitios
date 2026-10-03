import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CrmService } from './crm.service.js';
import { CreateActivityDto, CreateContactDto, UpdateContactDto } from './dto/crm.dto.js';

/** CRM de una empresa: sus clientes, el embudo y el historial de cada uno. */
@Controller('companies/:companyId/crm')
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.crm.summary(user.id, companyId);
  }

  @Get('contacts')
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Query('stage') stage?: string, @Query('q') q?: string) {
    return this.crm.list(user.id, companyId, { stage, q });
  }

  @Post('contacts')
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateContactDto) {
    return this.crm.create(user.id, companyId, dto);
  }

  @Get('contacts/:contactId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.crm.get(user.id, companyId, contactId);
  }

  @Patch('contacts/:contactId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.crm.update(user.id, companyId, contactId, dto);
  }

  @Delete('contacts/:contactId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.crm.remove(user.id, companyId, contactId);
  }

  @Post('contacts/:contactId/activities')
  addActivity(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.crm.addActivity(user.id, companyId, contactId, dto);
  }
}
