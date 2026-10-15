import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsDailyService } from './alerts-daily.service.js';
import { ALERTS_MODULE } from './alerts.service.js';

const select = { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true } as const;

/** La campanita: mis avisos en esta empresa. */
@Controller('companies/:companyId/alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  private async me(userId: string, companyId: string) {
    const member = await this.companies.requireMember(userId, companyId);
    await this.companies.requireModule(companyId, ALERTS_MODULE);
    return member;
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    const me = await this.me(user.id, companyId);
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { memberId: me.id }, orderBy: { createdAt: 'desc' }, take: 100, select }),
      this.prisma.notification.count({ where: { memberId: me.id, readAt: null } }),
    ]);
    return { unread, items };
  }

  @Get('count')
  async count(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    const me = await this.me(user.id, companyId);
    return { unread: await this.prisma.notification.count({ where: { memberId: me.id, readAt: null } }) };
  }

  /** Marca como leído y devuelve a dónde lleva. */
  @Post(':alertId/read')
  @HttpCode(200)
  async read(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('alertId', ParseUUIDPipe) alertId: string) {
    const me = await this.me(user.id, companyId);
    const n = await this.prisma.notification.findFirst({ where: { id: alertId, memberId: me.id }, select });
    if (!n) throw new NotFoundException('Aviso no encontrado');
    if (!n.readAt) await this.prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
    return { href: n.href };
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    const me = await this.me(user.id, companyId);
    const { count } = await this.prisma.notification.updateMany({ where: { memberId: me.id, readAt: null }, data: { readAt: new Date() } });
    return { marked: count };
  }
}

/** Revisión diaria de alertas. La llama el cron de Vercel con `Authorization: Bearer <CRON_SECRET>`. */
@Controller('internal/alerts')
@SkipThrottle()
export class InternalAlertsController {
  private readonly secret: string;

  constructor(
    private readonly daily: AlertsDailyService,
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
    return this.daily.run();
  }
}
