import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CreateOrderDto, MessageDto } from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

/** Pedidos del cliente autenticado. Cada consulta filtra por su propio id. */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto, @Req() req: { ip?: string }) {
    return this.orders.create(user.id, dto, req.ip);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user.id);
  }

  @Get(':orderId')
  get(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.orders.getMine(user.id, orderId);
  }

  @Post(':orderId/messages')
  message(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: MessageDto,
  ) {
    return this.orders.addMessage(user.id, orderId, dto.body);
  }

  @Post(':orderId/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: { ip?: string },
  ) {
    return this.orders.cancel(user.id, orderId, req.ip);
  }
}
