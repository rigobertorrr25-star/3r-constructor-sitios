import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AnalyticsService, type VisitInfo } from '../analytics/analytics.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { ContactFormDto } from './dto/contact-form.dto.js';
import { CustomDomainDto } from './dto/custom-domain.dto.js';
import { DomainExpiryDto } from './dto/domain-expiry.dto.js';
import { DomainRenewalsService } from './domain-renewals.service.js';
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

  /** Dominio propio del cliente (tunegocio.com). Con texto vacío se quita. */
  @Put('domain')
  setDomain(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CustomDomainDto,
    @Req() req: { ip?: string },
  ) {
    return this.publishing.setCustomDomain(user.id, siteId, dto.domain, req.ip);
  }

  /** Hasta cuándo está pagado el dominio propio (si el registrador dice otra fecha). */
  @Put('domain/expiry')
  setDomainExpiry(
    @CurrentUser() user: AuthUser,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: DomainExpiryDto,
    @Req() req: { ip?: string },
  ) {
    return this.publishing.setDomainExpiry(user.id, siteId, dto.expiresOn, req.ip);
  }

  /** El cliente pagó la renovación del dominio: un año más. */
  @Post('domain/renew')
  @HttpCode(200)
  renewDomain(@CurrentUser() user: AuthUser, @Param('siteId', ParseUUIDPipe) siteId: string, @Req() req: { ip?: string }) {
    return this.publishing.renewDomain(user.id, siteId, req.ip);
  }
}

/**
 * Revisión diaria de dominios por vencer. La llama el cron de Vercel (a través de la web) con
 * `Authorization: Bearer <CRON_SECRET>`; sin CRON_SECRET configurado, no hace nada.
 */
@Controller('internal/domain-renewals')
@SkipThrottle()
export class DomainRenewalsController {
  private readonly secret: string;

  constructor(
    private readonly renewals: DomainRenewalsService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('CRON_SECRET') ?? '';
  }

  @Post('run')
  @HttpCode(200)
  run(@Headers('authorization') authorization?: string) {
    if (!this.secret) throw new ServiceUnavailableException('CRON_SECRET sin configurar');
    const expected = Buffer.from(`Bearer ${this.secret}`);
    const given = Buffer.from(authorization ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return this.renewals.sendDueNotices();
  }
}

/** La web pregunta aquí qué sitio va en un dominio propio. Público: solo devuelve la etiqueta del sitio. */
@Controller('public/domains')
export class PublicDomainsController {
  constructor(private readonly publishing: PublishingService) {}

  @Get(':host')
  async resolve(@Param('host') host: string) {
    const found = await this.publishing.resolveHost(host);
    if (!found) throw new NotFoundException('Dominio sin sitio');
    return found;
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
  private readonly visitKey: string;

  constructor(
    private readonly publishing: PublishingService,
    private readonly analytics: AnalyticsService,
    config: ConfigService,
  ) {
    this.visitKey = config.get<string>('CRON_SECRET') ?? '';
  }

  @Get(':label')
  root(@Param('label') label: string, @Req() req: Request, @Res() res: Response) {
    return this.send(label, '', req, res);
  }

  @Get(':label/*path')
  page(@Param('label') label: string, @Param('path') path: string | string[], @Req() req: Request, @Res() res: Response) {
    return this.send(label, Array.isArray(path) ? path.join('/') : path, req, res);
  }

  /**
   * Datos del visitante para la analítica. La web los reenvía firmados con CRON_SECRET (si no, cualquiera podría
   * inflar las visitas llamando a la API). Sin CRON_SECRET configurado (desarrollo), se aceptan tal cual.
   */
  private visit(req: Request): VisitInfo | null {
    const h = (name: string) => String(req.headers[name] ?? '').slice(0, 1000);
    if (req.headers['purpose'] === 'prefetch' || req.headers['sec-purpose']?.toString().includes('prefetch')) return null;
    if (this.visitKey) {
      const given = Buffer.from(h('x-3r-visit'));
      const expected = Buffer.from(this.visitKey);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    }
    return { ua: h('x-3r-ua'), referer: h('x-3r-referer'), ip: h('x-3r-ip'), query: h('x-3r-query'), host: h('x-3r-host') };
  }

  /** El formulario de contacto de un sitio publicado postea aquí (ver render.ts, caso 'form'). */
  @Post(':label/contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  contact(@Param('label') label: string, @Body() dto: ContactFormDto) {
    return this.publishing.submitContact(label, dto);
  }

  private async send(label: string, path: string, req: Request, res: Response) {
    const file = await this.publishing.serve(label, path);
    res.status(file.status).set({ ...PUBLIC_HEADERS, 'Content-Type': file.contentType });
    if (file.status !== 200) res.set('Cache-Control', 'no-store');
    if (file.page) {
      // Las páginas no se guardan en la caché compartida: así cada visita llega y se cuenta.
      res.set('Cache-Control', 'public, max-age=0, no-cache');
      const visit = this.visit(req);
      if (visit) void this.analytics.record(file.page, visit);
    }
    res.send(file.body);
  }
}
