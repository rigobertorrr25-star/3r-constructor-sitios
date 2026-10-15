import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { UpdateProfileDto } from './dto/employees.dto.js';
import { EmployeesService } from './employees.service.js';

/** Portal del empleado: directorio del equipo y ficha de cada persona. */
@Controller('companies/:companyId/employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  directory(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.employees.directory(user.id, companyId);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.employees.summary(user.id, companyId);
  }

  @Get(':memberId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.employees.get(user.id, companyId, memberId);
  }

  @Patch(':memberId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.employees.update(user.id, companyId, memberId, dto);
  }
}
