import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { bearerOf, type RawRequest } from './bearer.js';
import { ChangeOwnerKeyDto, CreateStaffDto, OwnerLoginDto, UpdateStaffDto } from './dto/loyalty.dto.js';
import { LoyaltyOwnerService } from './loyalty-owner.service.js';

/** Panel del dueño del negocio: entra con su clave y ve clientes, sellos, canjes y meseros. */
@Controller('loyalty/:slug/owner')
export class LoyaltyOwnerController {
  constructor(private readonly owner: LoyaltyOwnerService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Param('slug') slug: string, @Body() dto: OwnerLoginDto) {
    return this.owner.login(slug, dto.key);
  }

  @Post('key')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async changeKey(@Param('slug') slug: string, @Body() dto: ChangeOwnerKeyDto, @Req() req: RawRequest) {
    return this.owner.changeKey(await this.owner.authorize(slug, bearerOf(req)), dto.current, dto.next);
  }

  @Get('summary')
  async summary(@Param('slug') slug: string, @Req() req: RawRequest) {
    return this.owner.summary(await this.owner.authorize(slug, bearerOf(req)));
  }

  @Get('customers')
  async customers(@Param('slug') slug: string, @Query('q') q: string | undefined, @Req() req: RawRequest) {
    return (await this.owner.customers(await this.owner.authorize(slug, bearerOf(req)), q)).list;
  }

  @Get('customers.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="clientes.csv"')
  async customersCsv(@Param('slug') slug: string, @Req() req: RawRequest) {
    return this.owner.customersCsv(await this.owner.authorize(slug, bearerOf(req)));
  }

  @Get('events')
  async events(@Param('slug') slug: string, @Query('limit') limit: string | undefined, @Req() req: RawRequest) {
    return this.owner.events(await this.owner.authorize(slug, bearerOf(req)), Number(limit) || 100);
  }

  @Get('staff')
  async staff(@Param('slug') slug: string, @Req() req: RawRequest) {
    return this.owner.listStaff(await this.owner.authorize(slug, bearerOf(req)));
  }

  @Post('staff')
  async createStaff(@Param('slug') slug: string, @Body() dto: CreateStaffDto, @Req() req: RawRequest) {
    return this.owner.createStaff(await this.owner.authorize(slug, bearerOf(req)), dto);
  }

  @Patch('staff/:staffId')
  async updateStaff(
    @Param('slug') slug: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: RawRequest,
  ) {
    return this.owner.updateStaff(await this.owner.authorize(slug, bearerOf(req)), staffId, dto);
  }
}
