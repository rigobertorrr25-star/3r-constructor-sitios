import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AnswerDto, SaveSurveyDto } from './dto/surveys.dto.js';
import { SurveysService } from './surveys.service.js';

/** Encuestas del equipo y de clientes. */
@Controller('companies/:companyId/surveys')
@UseGuards(JwtAuthGuard)
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.surveys.summary(user.id, companyId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.surveys.list(user.id, companyId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveSurveyDto) {
    return this.surveys.create(user.id, companyId, dto);
  }

  @Get(':surveyId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return this.surveys.get(user.id, companyId, surveyId);
  }

  @Put(':surveyId')
  update(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string, @Body() dto: SaveSurveyDto) {
    return this.surveys.update(user.id, companyId, surveyId, dto);
  }

  @Post(':surveyId/open')
  @HttpCode(200)
  open(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return this.surveys.open(user.id, companyId, surveyId);
  }

  @Post(':surveyId/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return this.surveys.close(user.id, companyId, surveyId);
  }

  @Delete(':surveyId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return this.surveys.remove(user.id, companyId, surveyId);
  }

  @Post(':surveyId/responses')
  answer(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string, @Body() dto: AnswerDto) {
    return this.surveys.answer(user.id, companyId, surveyId, dto);
  }

  @Get(':surveyId/results')
  results(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return this.surveys.results(user.id, companyId, surveyId);
  }
}

/** Lo que abre el cliente con el enlace de la encuesta, sin cuenta. */
@Controller('public/surveys')
export class PublicSurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.surveys.publicView(token);
  }

  @Post(':token/responses')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  answer(@Param('token') token: string, @Body() dto: AnswerDto) {
    return this.surveys.publicAnswer(token, dto);
  }
}
