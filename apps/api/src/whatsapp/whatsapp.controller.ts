import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { ConnectWhatsappDto, SendTemplateDto, SendTextDto, StartConversationDto, UpdateConversationDto } from './dto/whatsapp.dto.js';
import { WhatsappService } from './whatsapp.service.js';

/** Bandeja de WhatsApp de la empresa. */
@Controller('companies/:companyId/whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Query('filter') filter?: string) {
    return this.whatsapp.overview(user.id, companyId, filter);
  }

  @Post('templates/sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.whatsapp.syncTemplates(user.id, companyId);
  }

  @Post('conversations')
  start(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: StartConversationDto) {
    return this.whatsapp.start(user.id, companyId, dto);
  }

  @Get('conversations/:conversationId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.whatsapp.get(user.id, companyId, conversationId);
  }

  @Patch('conversations/:conversationId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.whatsapp.update(user.id, companyId, conversationId, dto);
  }

  @Post('conversations/:conversationId/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendTextDto,
  ) {
    return this.whatsapp.sendText(user.id, companyId, conversationId, dto.body);
  }

  @Post('conversations/:conversationId/template')
  template(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendTemplateDto,
  ) {
    return this.whatsapp.sendTemplate(user.id, companyId, conversationId, dto.templateId, dto.params);
  }
}

/** El equipo de 3R conecta el número de WhatsApp Business de la empresa. */
@Controller('admin/companies/:companyId/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminWhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get()
  get(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.whatsapp.adminGet(companyId);
  }

  @Put()
  connect(
    @CurrentUser() admin: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: ConnectWhatsappDto,
    @Req() req: Request,
  ) {
    return this.whatsapp.adminConnect(admin.id, companyId, dto, req.ip);
  }

  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() admin: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Req() req: Request) {
    return this.whatsapp.adminDisconnect(admin.id, companyId, req.ip);
  }
}

/** Avisos de Meta: mensajes nuevos y estados (enviado, entregado, leído). Público: la firma prueba que vienen de Meta. */
@Controller('webhooks/whatsapp')
@SkipThrottle()
export class WhatsappWebhookController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get()
  @Header('content-type', 'text/plain')
  verify(@Query('hub.mode') mode?: string, @Query('hub.verify_token') token?: string, @Query('hub.challenge') challenge?: string) {
    const ok = this.whatsapp.verifySubscription(mode, token, challenge);
    if (!ok) throw new NotFoundException();
    return ok;
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!this.whatsapp.validSignature(req.rawBody, signature)) throw new ForbiddenException('Firma no válida');
    await this.whatsapp.handleEvent(body as Parameters<WhatsappService['handleEvent']>[0]);
    return { ok: true };
  }
}
