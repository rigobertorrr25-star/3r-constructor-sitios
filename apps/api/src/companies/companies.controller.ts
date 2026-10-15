import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { CompaniesService } from './companies.service.js';
import {
  AcceptInviteDto,
  AdminCompanyModulesDto,
  AdminUpdateCompanyDto,
  CreateCompanyDto,
  InviteMemberDto,
  UpdateCompanyDto,
  UpdateMemberDto,
} from './dto/company.dto.js';

type Req = { ip?: string };

/** Las empresas de quien inició sesión. Cada acción comprueba su rol dentro de la empresa. */
@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.companies.listMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto, @Req() req: Req) {
    return this.companies.create(user.id, dto, req.ip);
  }

  @Get(':companyId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companies.get(user.id, companyId);
  }

  @Patch(':companyId')
  update(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: UpdateCompanyDto, @Req() req: Req) {
    return this.companies.update(user.id, companyId, dto, req.ip);
  }

  @Get(':companyId/members')
  members(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companies.listMembers(user.id, companyId);
  }

  @Patch(':companyId/members/:memberId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: Req,
  ) {
    return this.companies.updateMember(user.id, companyId, memberId, dto, req.ip);
  }

  @Delete(':companyId/members/:memberId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: Req,
  ) {
    return this.companies.removeMember(user.id, companyId, memberId, req.ip);
  }

  @Get(':companyId/invites')
  invites(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companies.listInvites(user.id, companyId);
  }

  @Post(':companyId/invites')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  invite(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: InviteMemberDto, @Req() req: Req) {
    return this.companies.invite(user.id, companyId, dto, req.ip);
  }

  @Delete(':companyId/invites/:inviteId')
  @HttpCode(204)
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.companies.revokeInvite(user.id, companyId, inviteId);
  }
}

/** La invitación por correo: verla no exige sesión (solo el token); aceptarla sí. */
@Controller('company-invites')
export class CompanyInvitesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  preview(@Param('token') token: string) {
    return this.companies.previewInvite(token);
  }

  @Post('accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto, @Req() req: Req) {
    return this.companies.acceptInvite(user.id, dto.token, req.ip);
  }
}

/** El equipo de 3R ve todas las empresas, activa módulos y suspende o reactiva. */
@Controller('admin/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminCompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list() {
    return this.companies.adminList();
  }

  @Get(':companyId')
  get(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companies.adminGet(companyId);
  }

  @Put(':companyId/modules')
  setModules(@CurrentUser() admin: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: AdminCompanyModulesDto, @Req() req: Req) {
    return this.companies.adminSetModules(admin.id, companyId, dto.keys, req.ip);
  }

  @Patch(':companyId')
  setStatus(@CurrentUser() admin: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: AdminUpdateCompanyDto, @Req() req: Req) {
    return this.companies.adminSetStatus(admin.id, companyId, dto.status, req.ip);
  }
}
