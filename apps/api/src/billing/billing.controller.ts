import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { BillingService } from './billing.service.js';
import { ConfirmInvoiceDto, MarkPaidDto, SaveSubscriptionDto, SetPricesDto } from './dto/billing.dto.js';

/** El plan y las facturas de mi empresa (dueño y administradores). */
@Controller('companies/:companyId/billing')
@UseGuards(JwtAuthGuard)
export class CompanyBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.billing.mine(user.id, companyId);
  }

  @Post('invoices/:invoiceId/wompi')
  checkout(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.billing.checkout(user.id, companyId, invoiceId);
  }

  @Post('invoices/:invoiceId/wompi/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: ConfirmInvoiceDto,
  ) {
    return this.billing.confirm(user.id, companyId, invoiceId, dto.transactionId);
  }
}

/** El equipo de 3R: precios de los módulos, plan de cada empresa y facturas. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('billing/prices')
  prices() {
    return this.billing.prices();
  }

  @Put('billing/prices')
  setPrices(@Body() dto: SetPricesDto) {
    return this.billing.setPrices(dto.prices);
  }

  @Get('companies/:companyId/billing')
  overview(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.billing.adminOverview(companyId);
  }

  @Put('companies/:companyId/subscription')
  saveSubscription(@Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveSubscriptionDto) {
    return this.billing.saveSubscription(companyId, dto);
  }

  @Post('companies/:companyId/invoices')
  generate(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.billing.generateInvoice(companyId);
  }

  @Post('invoices/:invoiceId/paid')
  @HttpCode(200)
  markPaid(@Param('invoiceId', ParseUUIDPipe) invoiceId: string, @Body() dto: MarkPaidDto) {
    return this.billing.markPaid(invoiceId, dto.method, dto.note);
  }

  @Post('invoices/:invoiceId/void')
  @HttpCode(200)
  void(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.billing.voidInvoice(invoiceId);
  }
}

/** Revisión diaria del cobro. La llama el cron de Vercel con `Authorization: Bearer <CRON_SECRET>`. */
@Controller('internal/billing')
@SkipThrottle()
export class InternalBillingController {
  private readonly secret: string;

  constructor(
    private readonly billing: BillingService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('CRON_SECRET') ?? '';
  }

  @Post('run')
  @HttpCode(200)
  run(@Headers('authorization') authorization?: string) {
    if (!this.secret) throw new ServiceUnavailableException('CRON_SECRET sin configurar');
    const expected = Buffer.from(`Bearer ${this.secret}`);
    const given = Buffer.from(authorization ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return this.billing.run();
  }
}
