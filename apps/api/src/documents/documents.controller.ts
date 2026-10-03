import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { DocumentsService } from './documents.service.js';
import { RequestUploadDto, UpdateDocumentDto } from './dto/documents.dto.js';

const originOf = (req: Request) => `${req.protocol}://${req.get('host')}`;

/** Documentos privados de la empresa y de cada empleado. */
@Controller('companies/:companyId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.documents.summary(user.id, companyId);
  }

  @Get('folders')
  folders(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.documents.folders(user.id, companyId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Query('memberId', new ParseUUIDPipe({ optional: true })) memberId?: string) {
    return this.documents.list(user.id, companyId, memberId);
  }

  /** Paso 1: registra el documento y devuelve el enlace firmado para subir el archivo. */
  @Post('uploads')
  requestUpload(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: RequestUploadDto, @Req() req: Request) {
    return this.documents.requestUpload(user.id, companyId, dto, originOf(req));
  }

  /** Paso 2: ya subido, queda disponible. */
  @Post(':documentId/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.documents.confirm(user.id, companyId, documentId);
  }

  /** Enlace firmado de descarga (vence en 5 minutos). */
  @Get(':documentId/download')
  download(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('documentId', ParseUUIDPipe) documentId: string, @Req() req: Request) {
    return this.documents.download(user.id, companyId, documentId, originOf(req));
  }

  @Patch(':documentId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(user.id, companyId, documentId, dto);
  }

  @Delete(':documentId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.documents.remove(user.id, companyId, documentId);
  }
}
