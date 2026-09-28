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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { AttendanceService } from './attendance.service.js';
import {
  CreateBusinessDto,
  CreateEmployeeDto,
  PunchDto,
  RecordsQueryDto,
  UpdateBusinessDto,
  UpdateEmployeeDto,
  UpdateRecordDto,
} from './dto/attendance.dto.js';

/** Sin sesión: la tablet de la entrada y el celular del empleado. */
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('kiosk/:secret')
  kiosk(@Param('secret') secret: string) {
    return this.attendance.kiosk(secret);
  }

  @Get(':slug')
  business(@Param('slug') slug: string) {
    return this.attendance.publicBusiness(slug);
  }

  // Los empleados comparten el wifi (la misma IP): el límite deja pasar un cambio de turno completo,
  // y adivinar un PIN igual exige un código vigente de la tablet.
  @Post(':slug/punch')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  punch(@Param('slug') slug: string, @Body() dto: PunchDto) {
    return this.attendance.punch(slug, dto.code, dto.pin);
  }
}

@Controller('admin/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  list() {
    return this.attendance.listBusinesses();
  }

  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateBusinessDto, @Req() req: { ip?: string }) {
    return this.attendance.createBusiness(admin.id, dto, req.ip);
  }

  @Get(':businessId')
  get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.attendance.getBusiness(businessId);
  }

  @Patch(':businessId')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.updateBusiness(admin.id, businessId, dto, req.ip);
  }

  @Post(':businessId/employees')
  createEmployee(
    @CurrentUser() admin: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateEmployeeDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.createEmployee(admin.id, businessId, dto, req.ip);
  }

  @Patch(':businessId/employees/:employeeId')
  updateEmployee(
    @CurrentUser() admin: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.updateEmployee(admin.id, businessId, employeeId, dto, req.ip);
  }

  @Get(':businessId/records')
  records(@Param('businessId', ParseUUIDPipe) businessId: string, @Query() query: RecordsQueryDto) {
    return this.attendance.listRecords(businessId, query);
  }

  @Patch(':businessId/records/:recordId')
  updateRecord(
    @CurrentUser() admin: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateRecordDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.updateRecord(admin.id, businessId, recordId, dto, req.ip);
  }

  @Delete(':businessId/records/:recordId')
  @HttpCode(204)
  async deleteRecord(
    @CurrentUser() admin: AuthUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Req() req: { ip?: string },
  ) {
    await this.attendance.deleteRecord(admin.id, businessId, recordId, req.ip);
  }
}
