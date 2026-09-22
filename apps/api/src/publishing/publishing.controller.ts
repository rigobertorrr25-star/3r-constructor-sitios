import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { PublishingService } from './publishing.service.js';

/** Publicar y despublicar: solo el dueño del sitio. */
@Controller('sites/:siteId')
@UseGuards(JwtAuthGuard)
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post('publish')
  @HttpCode(200)
  publish(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Req() req: { ip?: string },
  ) {
    return this.publishing.publish(user.id, siteId, req.ip);
  }

  @Post('unpublish')
  @HttpCode(200)
  unpublish(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Req() req: { ip?: string },
  ) {
    return this.publishing.unpublish(user.id, siteId, req.ip);
  }

  @Get('publication')
  status(@CurrentUser() user: AuthUser, @Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.publishing.status(user.id, siteId);
  }
}

// Las páginas publicadas son contenido de terceros. Aunque ya se sanea todo, el navegador recibe además
// reglas que impiden ejecutar scripts, cargar recursos raros o compartir cookies con el resto del sitio.
const PUBLIC_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src http: https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-popups allow-popups-to-escape-sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  // El navegador siempre revalida (quien acaba de publicar ve el cambio al instante); una caché compartida/CDN puede guardarla 30 s.
  'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
};

/** Sirve los archivos de un sitio publicado. Público: no exige sesión. */
@Controller('public/sites')
export class PublicSitesController {
  constructor(private readonly publishing: PublishingService) {}

  @Get(':label')
  root(@Param('label') label: string, @Res() res: Response) {
    return this.send(label, '', res);
  }

  @Get(':label/*path')
  page(@Param('label') label: string, @Param('path') path: string | string[], @Res() res: Response) {
    return this.send(label, Array.isArray(path) ? path.join('/') : path, res);
  }

  private async send(label: string, path: string, res: Response) {
    const file = await this.publishing.serve(label, path);
    res.status(file.status).set({ ...PUBLIC_HEADERS, 'Content-Type': file.contentType });
    if (file.status !== 200) res.set('Cache-Control', 'no-store');
    res.send(file.body);
  }
}
