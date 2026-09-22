import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';

// Punto de partida del panel administrativo (paso 29). Por ahora solo comprueba el RBAC.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}
