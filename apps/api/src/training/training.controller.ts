import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { QuizDto, SaveCourseDto } from './dto/training.dto.js';
import { TrainingService } from './training.service.js';

const UUID = /^[0-9a-f-]{36}$/i;

/** Capacitaciones: cursos con lecciones, evaluación y certificado. */
@Controller('companies/:companyId/training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.training.summary(user.id, companyId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.training.list(user.id, companyId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveCourseDto) {
    return this.training.create(user.id, companyId, dto);
  }

  @Get(':courseId')
  get(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.training.get(user.id, companyId, courseId);
  }

  @Put(':courseId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: SaveCourseDto,
  ) {
    return this.training.update(user.id, companyId, courseId, dto);
  }

  @Post(':courseId/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.training.publish(user.id, companyId, courseId);
  }

  @Post(':courseId/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.training.archive(user.id, companyId, courseId);
  }

  @Delete(':courseId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.training.remove(user.id, companyId, courseId);
  }

  @Post(':courseId/lessons/:lessonId/done')
  @HttpCode(200)
  lessonDone(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.training.lessonDone(user.id, companyId, courseId, lessonId);
  }

  @Post(':courseId/quiz')
  @HttpCode(200)
  quiz(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: QuizDto,
  ) {
    return this.training.quiz(user.id, companyId, courseId, dto);
  }

  @Get(':courseId/team')
  team(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.training.team(user.id, companyId, courseId);
  }

  @Get(':courseId/certificate')
  async certificate(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('memberId') memberId: string | undefined,
    @Res() res: Response,
  ) {
    const { pdf, fileName } = await this.training.certificate(user.id, companyId, courseId, memberId && UUID.test(memberId) ? memberId : undefined);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store' });
    res.send(pdf);
  }
}
