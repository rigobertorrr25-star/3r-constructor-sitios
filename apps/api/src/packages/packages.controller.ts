import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto.js';
import { PackagesService } from './packages.service.js';

/** Catálogo público: lo ve cualquier visitante, sin iniciar sesión. */
@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  list() {
    return this.packages.listPublic();
  }
}

/** Edición del catálogo, solo para el equipo. */
@Controller('admin/packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminPackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  list() {
    return this.packages.listAll();
  }

  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreatePackageDto, @Req() req: { ip?: string }) {
    return this.packages.create(admin.id, dto, req.ip);
  }

  @Patch(':packageId')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: UpdatePackageDto,
    @Req() req: { ip?: string },
  ) {
    return this.packages.update(admin.id, packageId, dto, req.ip);
  }
}
