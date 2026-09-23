import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { PresignMediaDto } from './dto/presign-media.dto.js';
import { LocalMediaStorage } from './local-media-storage.js';
import { MEDIA_MAX_BYTES, MEDIA_STORAGE, MEDIA_TYPES, type MediaStorage } from './media-storage.js';

const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(Object.entries(MEDIA_TYPES).map(([type, ext]) => [ext, type]));

const originOf = (req: Request) => `${req.protocol}://${req.get('host')}`;

/** Pide permiso para subir una imagen o un video: solo el equipo, desde el editor. */
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class MediaController {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  @Post('presign')
  async presign(@Body() dto: PresignMediaDto, @Req() req: Request) {
    const ext = MEDIA_TYPES[dto.contentType];
    const key = `${randomUUID()}.${ext}`;
    return this.storage.presignUpload(key, dto.contentType, originOf(req));
  }
}

/**
 * Solo entran en juego cuando no hay R2 configurado (respaldo en disco). Reciben y sirven el
 * archivo directo; la subida la autoriza la firma que dio /media/presign, no una sesión — así el
 * navegador puede subir el archivo sin pasar por el servidor de Next.
 */
@Controller('media')
export class LocalMediaController {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  @Put('local/:key')
  async receive(@Param('key') key: string, @Query('exp') exp: string, @Query('sig') sig: string, @Req() req: Request) {
    if (!(this.storage instanceof LocalMediaStorage)) throw new NotFoundException();
    const decodedKey = decodeURIComponent(key);
    if (!this.storage.verify(decodedKey, Number(exp), sig)) {
      throw new BadRequestException('El enlace de subida venció o no es válido; pide uno nuevo.');
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      total += (chunk as Buffer).length;
      if (total > MEDIA_MAX_BYTES) throw new BadRequestException('El archivo es demasiado grande (máximo 100 MB).');
      chunks.push(chunk as Buffer);
    }
    await this.storage.save(decodedKey, Buffer.concat(chunks));
    return { ok: true };
  }

  @Get('files/:key')
  async serve(@Param('key') key: string, @Res() res: Response) {
    if (!(this.storage instanceof LocalMediaStorage)) throw new NotFoundException();
    const decodedKey = decodeURIComponent(key);
    const ext = decodedKey.split('.').pop() ?? '';
    const contentType = EXT_TO_TYPE[ext];
    if (!contentType) throw new NotFoundException();
    try {
      const { readFile } = await import('node:fs/promises');
      const buffer = await readFile(this.storage.path(decodedKey));
      // helmet cierra por defecto los recursos a que solo el propio origen los cargue (Cross-Origin-Resource-Policy:
      // same-origin) — hay que abrirlo aquí porque el sitio (otro origen) sí necesita mostrar estas imágenes/videos.
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.send(buffer);
    } catch {
      throw new NotFoundException();
    }
  }
}
