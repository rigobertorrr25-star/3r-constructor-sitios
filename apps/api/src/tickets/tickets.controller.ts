import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CreateCommentDto, CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto.js';
import { TicketsService } from './tickets.service.js';

/** Tickets internos de una empresa: quién pide, quién atiende, estado e historial. */
@Controller('companies/:companyId/tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.tickets.summary(user.id, companyId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('view') view?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
  ) {
    return this.tickets.list(user.id, companyId, { view, category, q });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user.id, companyId, dto);
  }

  @Get(':ticketId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.tickets.get(user.id, companyId, ticketId);
  }

  @Patch(':ticketId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(user.id, companyId, ticketId, dto);
  }

  @Delete(':ticketId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.tickets.remove(user.id, companyId, ticketId);
  }

  @Post(':ticketId/comments')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tickets.comment(user.id, companyId, ticketId, dto);
  }
}
