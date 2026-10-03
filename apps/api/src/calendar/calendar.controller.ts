import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CalendarService } from './calendar.service.js';
import { CreateEventDto, UpdateEventDto } from './dto/calendar.dto.js';

/** Calendario de la empresa: sus eventos más vacaciones, cumpleaños, eventos de comunicados y vencimientos. */
@Controller('companies/:companyId/calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  /** `from` y `to` en AAAA-MM-DD (hora de Colombia), máximo 62 días. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.calendar.list(user.id, companyId, from, to);
  }

  @Get('upcoming')
  upcoming(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.calendar.upcoming(user.id, companyId);
  }

  @Post('events')
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: CreateEventDto) {
    return this.calendar.create(user.id, companyId, dto);
  }

  @Patch('events/:eventId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.calendar.update(user.id, companyId, eventId, dto);
  }

  @Delete('events/:eventId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.calendar.remove(user.id, companyId, eventId);
  }
}
