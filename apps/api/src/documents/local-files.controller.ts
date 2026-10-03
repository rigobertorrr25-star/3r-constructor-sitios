import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DOCUMENT_MAX_BYTES, DOCUMENT_STORAGE, type DocumentStorage } from './document-storage.js';
import { LocalDocumentStorage } from './local-document-storage.js';

/**
 * Solo sin R2 (respaldo en disco): recibe y entrega los documentos. No usa sesión: lo autoriza la firma corta que
 * dio la API después de comprobar permisos, igual que un enlace firmado de R2.
 */
@Controller('company-files')
export class LocalFilesController {
  constructor(@Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage) {}

  @Put(':key')
  async receive(@Param('key') key: string, @Query('exp') exp: string, @Query('sig') sig: string, @Req() req: Request) {
    if (!(this.storage instanceof LocalDocumentStorage)) throw new NotFoundException();
    if (!this.storage.verify('PUT', key, Number(exp), sig)) throw new BadRequestException('El enlace de subida venció o no es válido.');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      total += (chunk as Buffer).length;
      if (total > DOCUMENT_MAX_BYTES) throw new BadRequestException('El archivo pesa más de 20 MB.');
      chunks.push(chunk as Buffer);
    }
    await this.storage.save(key, Buffer.concat(chunks));
    return { ok: true };
  }

  @Get(':key')
  async serve(
    @Param('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('name') name: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    if (!(this.storage instanceof LocalDocumentStorage)) throw new NotFoundException();
    if (!this.storage.verify('GET', key, Number(exp), sig, `${name}|${type}`)) throw new NotFoundException();
    try {
      const buffer = await this.storage.read(key);
      res.set({
        'Content-Type': type,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.send(buffer);
    } catch {
      throw new NotFoundException();
    }
  }
}
