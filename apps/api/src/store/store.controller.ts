import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { PlaceOrderDto, QuoteCartDto, SaveCouponDto, SaveProductDto, StoreImageDto, StoreSettingsDto, UpdateOrderDto } from './dto/store.dto.js';
import { StoreService } from './store.service.js';

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const originOf = (req: Request) => `${req.protocol}://${req.get('host')}`;

/** Tienda online de la empresa: ajustes, productos, cupones y pedidos. */
@Controller('companies/:companyId/store')
@UseGuards(JwtAuthGuard)
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.store.getSettings(user.id, companyId);
  }

  @Put('settings')
  saveSettings(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: StoreSettingsDto) {
    return this.store.saveSettings(user.id, companyId, dto);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.store.summary(user.id, companyId);
  }

  @Post('images/presign')
  @HttpCode(200)
  presign(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: StoreImageDto, @Req() req: Request) {
    return this.store.presignImage(user.id, companyId, dto.contentType, originOf(req));
  }

  @Get('products')
  listProducts(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.store.listProducts(user.id, companyId);
  }

  @Post('products')
  createProduct(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveProductDto) {
    return this.store.createProduct(user.id, companyId, dto);
  }

  @Get('products/:productId')
  getProduct(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.store.getProduct(user.id, companyId, productId);
  }

  @Put('products/:productId')
  updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SaveProductDto,
  ) {
    return this.store.updateProduct(user.id, companyId, productId, dto);
  }

  @Delete('products/:productId')
  @HttpCode(204)
  removeProduct(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.store.removeProduct(user.id, companyId, productId);
  }

  @Get('coupons')
  listCoupons(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.store.listCoupons(user.id, companyId);
  }

  @Post('coupons')
  createCoupon(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveCouponDto) {
    return this.store.createCoupon(user.id, companyId, dto);
  }

  @Put('coupons/:couponId')
  updateCoupon(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() dto: SaveCouponDto,
  ) {
    return this.store.updateCoupon(user.id, companyId, couponId, dto);
  }

  @Delete('coupons/:couponId')
  @HttpCode(204)
  removeCoupon(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('couponId', ParseUUIDPipe) couponId: string,
  ) {
    return this.store.removeCoupon(user.id, companyId, couponId);
  }

  @Get('orders')
  listOrders(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Query('status') status?: string) {
    return this.store.listOrders(user.id, companyId, str(status));
  }

  @Get('orders/:orderId')
  getOrder(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.store.getOrder(user.id, companyId, orderId);
  }

  @Patch('orders/:orderId')
  updateOrder(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.store.updateOrder(user.id, companyId, orderId, dto);
  }
}

/** La tienda que ven los clientes, sin cuenta. */
@Controller('public/store')
export class PublicStoreController {
  constructor(private readonly store: StoreService) {}

  @Get(':slug')
  catalog(@Param('slug') slug: string) {
    return this.store.publicCatalog(slug);
  }

  @Get(':slug/products/:productId')
  product(@Param('slug') slug: string, @Param('productId') productId: string) {
    return this.store.publicProductView(slug, productId);
  }

  @Post(':slug/quote')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  quote(@Param('slug') slug: string, @Body() dto: QuoteCartDto) {
    return this.store.publicQuote(slug, dto);
  }

  @Post(':slug/orders')
  // Generoso: los pedidos llegan a través del servidor de la web, que comparte una sola IP.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  place(@Param('slug') slug: string, @Body() dto: PlaceOrderDto) {
    return this.store.placeOrder(slug, dto);
  }

  @Get(':slug/orders/:token')
  order(@Param('slug') slug: string, @Param('token') token: string) {
    return this.store.publicOrder(slug, token);
  }
}
