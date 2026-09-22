import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminEventDto, CreateOrderSiteDto, UpdateOrderDto } from './dto/order.dto.js';

/** Gestión de pedidos para el equipo (ADMIN / SUPER_ADMIN). */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get('stats')
  stats() {
    return this.orders.stats();
  }

  @Get('orders')
  list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.orders.list({ status, q });
  }

  @Get('orders/:orderId')
  get(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.get(orderId);
  }

  @Patch('orders/:orderId')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderDto,
    @Req() req: { ip?: string },
  ) {
    return this.orders.update(admin.id, orderId, dto, req.ip);
  }

  @Post('orders/:orderId/events')
  addEvent(
    @CurrentUser() admin: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AdminEventDto,
  ) {
    return this.orders.addEvent(admin.id, orderId, dto.body, dto.internal === true);
  }

  @Post('orders/:orderId/site')
  createSite(
    @CurrentUser() admin: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrderSiteDto,
    @Req() req: { ip?: string },
  ) {
    return this.orders.createSite(admin.id, orderId, dto.templateSlug, req.ip);
  }
}
