import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { RespondQuoteDto, SaveQuoteDto } from './dto/quotes.dto.js';
import { QuotesService } from './quotes.service.js';

const sendPdf = (res: Response, { pdf, fileName }: { pdf: Buffer; fileName: string }) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store' });
  res.send(pdf);
};

/** Cotizaciones de la empresa. */
@Controller('companies/:companyId/quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.quotes.summary(user.id, companyId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('status') status?: string,
    @Query('contactId', new ParseUUIDPipe({ optional: true })) contactId?: string,
  ) {
    return this.quotes.list(user.id, companyId, { status, contactId });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveQuoteDto) {
    return this.quotes.create(user.id, companyId, dto);
  }

  @Get(':quoteId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.quotes.get(user.id, companyId, quoteId);
  }

  @Put(':quoteId')
  update(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('quoteId', ParseUUIDPipe) quoteId: string, @Body() dto: SaveQuoteDto) {
    return this.quotes.update(user.id, companyId, quoteId, dto);
  }

  /** Genera el enlace para el cliente (y le manda el correo si `email` es true). */
  @Post(':quoteId/send')
  @HttpCode(200)
  send(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() body: { email?: boolean },
  ) {
    return this.quotes.send(user.id, companyId, quoteId, body?.email === true);
  }

  @Post(':quoteId/reopen')
  @HttpCode(200)
  reopen(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.quotes.reopen(user.id, companyId, quoteId);
  }

  @Get(':quoteId/pdf')
  async pdf(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('quoteId', ParseUUIDPipe) quoteId: string, @Res() res: Response) {
    sendPdf(res, await this.quotes.pdf(user.id, companyId, quoteId));
  }

  @Delete(':quoteId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('quoteId', ParseUUIDPipe) quoteId: string) {
    return this.quotes.remove(user.id, companyId, quoteId);
  }
}

/** Lo que abre el cliente desde el enlace del correo: sin sesión, con el token. */
@Controller('public/quotes')
export class PublicQuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.quotes.publicView(token);
  }

  @Get(':token/pdf')
  async pdf(@Param('token') token: string, @Res() res: Response) {
    sendPdf(res, await this.quotes.publicPdf(token));
  }

  @Post(':token/respond')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  respond(@Param('token') token: string, @Body() dto: RespondQuoteDto) {
    return this.quotes.respond(token, dto);
  }
}
