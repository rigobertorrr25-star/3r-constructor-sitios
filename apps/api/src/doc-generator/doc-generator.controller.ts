import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { DocGeneratorService } from './doc-generator.service.js';
import { GenerateDocumentDto } from './dto/doc-generator.dto.js';

/** Certificados laborales, constancias y cartas con los datos del empleado ya llenos, en PDF. */
@Controller('companies/:companyId/doc-generator')
@UseGuards(JwtAuthGuard)
export class DocGeneratorController {
  constructor(private readonly generator: DocGeneratorService) {}

  @Get('people')
  people(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.generator.people(user.id, companyId);
  }

  /** Devuelve el PDF. Si se guardó copia, su id va en la cabecera X-Saved-Document. */
  @Post('generate')
  async generate(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: GenerateDocumentDto, @Res() res: Response) {
    const { pdf, fileName, savedDocumentId } = await this.generator.generate(user.id, companyId, dto);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      ...(savedDocumentId ? { 'X-Saved-Document': savedDocumentId } : {}),
    });
    res.send(pdf);
  }
}
