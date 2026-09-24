import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { ContactFormDto } from './dto/contact-form.dto.js';
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
// reglas que impiden cargar recursos raros o compartir cookies con el resto del sitio.
//
// Sobre "allow-scripts": el mapa (Google Maps embed) necesita JavaScript para dibujarse, y sin
// "allow-scripts" un iframe anidado hereda la restricción del padre y no corre nada, aunque el
// origen esté permitido en frame-src (confirmado probando en un Chrome real). Se agrega, pero
// A PROPÓSITO sin "allow-same-origin": sandbox sin ese permiso le da a la página un origen opaco
// (aleatorio) — cualquier script que corra ahí no puede leer las cookies de sesión ni llamar a la
// API como si fuera un usuario real, aunque se ejecute. Es el mismo patrón que usan los sitios que
// alojan contenido embebido de terceros (CodePen y similares).
// Sobre "allow-forms": el formulario de contacto (render.ts, caso 'form') hace un POST normal del
// navegador. Sin este permiso, un documento sandboxeado bloquea CUALQUIER envío de formulario en
// silencio (sin error visible para el visitante) — confirmado probando el envío real en un Chrome.
const PUBLIC_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src http: https: data:; media-src http: https:; frame-src https://www.google.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; sandbox allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms",
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

  /** El formulario de contacto de un sitio publicado postea aquí (ver render.ts, caso 'form'). */
  @Post(':label/contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  contact(@Param('label') label: string, @Body() dto: ContactFormDto) {
    return this.publishing.submitContact(label, dto);
  }

  private async send(label: string, path: string, res: Response) {
    const file = await this.publishing.serve(label, path);
    res.status(file.status).set({ ...PUBLIC_HEADERS, 'Content-Type': file.contentType });
    if (file.status !== 200) res.set('Cache-Control', 'no-store');
    res.send(file.body);
  }
}
