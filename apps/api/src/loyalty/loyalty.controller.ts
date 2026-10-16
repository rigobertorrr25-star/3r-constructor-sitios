import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { bearerOf, type RawRequest } from './bearer.js';
import { PinDto, RecoverCardDto, RegisterCustomerDto } from './dto/loyalty.dto.js';
import { LoyaltyService } from './loyalty.service.js';

/**
 * Tarjeta de sellos del cliente final. Pública (la usa la página del negocio desde otro dominio):
 * el celular se identifica con el token que recibió al registrarse.
 */
@Controller('loyalty/:slug')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  info(@Param('slug') slug: string) {
    return this.loyalty.publicInfo(slug);
  }

  @Post('customers')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Param('slug') slug: string, @Body() dto: RegisterCustomerDto) {
    return this.loyalty.register(slug, dto);
  }

  @Post('customers/recover')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  recover(@Param('slug') slug: string, @Body() dto: RecoverCardDto) {
    return this.loyalty.recover(slug, dto);
  }

  @Get('card')
  card(@Param('slug') slug: string, @Req() req: RawRequest) {
    return this.loyalty.getCard(slug, bearerOf(req));
  }

  @Post('card/stamp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  stamp(@Param('slug') slug: string, @Body() dto: PinDto, @Req() req: RawRequest) {
    return this.loyalty.stamp(slug, bearerOf(req), dto.pin);
  }

  @Post('card/redeem')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  redeem(@Param('slug') slug: string, @Body() dto: PinDto, @Req() req: RawRequest) {
    return this.loyalty.redeem(slug, bearerOf(req), dto.pin);
  }
}
