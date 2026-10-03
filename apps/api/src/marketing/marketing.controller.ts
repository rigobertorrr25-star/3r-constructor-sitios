import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { SaveCampaignDto, SegmentDto, SubscribeDto } from './dto/marketing.dto.js';
import { MarketingService } from './marketing.service.js';

/** Campañas de correo a los clientes que aceptaron recibirlas. */
@Controller('companies/:companyId/marketing')
@UseGuards(JwtAuthGuard)
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.marketing.overview(user.id, companyId);
  }

  @Post('audience')
  @HttpCode(200)
  audience(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SegmentDto) {
    return this.marketing.audienceCount(user.id, companyId, dto);
  }

  @Post('newsletter')
  @HttpCode(200)
  enableNewsletter(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.marketing.enableNewsletter(user.id, companyId);
  }

  @Delete('newsletter')
  @HttpCode(204)
  disableNewsletter(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.marketing.disableNewsletter(user.id, companyId);
  }

  @Post('campaigns')
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveCampaignDto) {
    return this.marketing.create(user.id, companyId, dto);
  }

  @Get('campaigns/:campaignId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.marketing.get(user.id, companyId, campaignId);
  }

  @Put('campaigns/:campaignId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: SaveCampaignDto,
  ) {
    return this.marketing.update(user.id, companyId, campaignId, dto);
  }

  @Delete('campaigns/:campaignId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.marketing.remove(user.id, companyId, campaignId);
  }

  @Post('campaigns/:campaignId/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  test(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.marketing.test(user.id, companyId, campaignId);
  }

  @Post('campaigns/:campaignId/send')
  @HttpCode(200)
  send(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.marketing.send(user.id, companyId, campaignId);
  }
}

/** Suscribirse y darse de baja, sin cuenta. */
@Controller('public')
export class PublicMarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('newsletter/:token')
  newsletter(@Param('token') token: string) {
    return this.marketing.publicNewsletter(token);
  }

  @Post('newsletter/:token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  subscribe(@Param('token') token: string, @Body() dto: SubscribeDto) {
    return this.marketing.subscribe(token, dto);
  }

  @Get('marketing/unsubscribe/:token')
  unsubscribeView(@Param('token') token: string) {
    return this.marketing.publicUnsubscribe(token);
  }

  @Post('marketing/unsubscribe/:token')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribe(@Param('token') token: string) {
    return this.marketing.unsubscribe(token);
  }
}
