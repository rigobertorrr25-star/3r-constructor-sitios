import { Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto.js';
import { PaymentsService } from './payments.service.js';

/** El cliente paga su pedido con Wompi. Cada consulta filtra por su propio id. */
@Controller('orders/:orderId/payments/wompi')
@UseGuards(JwtAuthGuard)
export class OrderPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Devuelve la dirección del pago de Wompi por lo que falta del pedido. */
  @Post()
  checkout(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.createCheckout(user.id, orderId);
  }

  /** Al volver de Wompi, la web confirma la transacción sin esperar el aviso. */
  @Post('confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.payments.confirm(user.id, orderId, dto.transactionId);
  }
}

/** Avisos de Wompi (webhook). Público: la firma del aviso es lo que prueba que viene de Wompi. */
@Controller('payments/wompi')
@SkipThrottle()
export class WompiEventsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('events')
  @HttpCode(200)
  events(@Body() body: Record<string, unknown>, @Headers('x-event-checksum') checksum?: string) {
    return this.payments.handleEvent(body ?? {}, checksum);
  }
}
