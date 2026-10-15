import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AssistantService } from './assistant.service.js';
import { AskDto, DocumentAiDto, FeedbackDto } from './dto/assistant.dto.js';

/** Asistente con IA que responde con los documentos de la empresa. */
@Controller('companies/:companyId/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.assistant.overview(user.id, companyId);
  }

  @Post('ask')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  ask(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: AskDto) {
    return this.assistant.ask(user.id, companyId, dto);
  }

  @Post('questions/:questionId/feedback')
  @HttpCode(204)
  feedback(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.assistant.feedback(user.id, companyId, questionId, dto.helpful);
  }

  @Put('documents/:documentId')
  setDocument(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: DocumentAiDto,
  ) {
    return this.assistant.setDocument(user.id, companyId, documentId, dto.enabled);
  }
}
