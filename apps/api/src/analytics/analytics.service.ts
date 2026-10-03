import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { deviceOf, isBot, sourceOf, visitorOf } from './visit.js';

/** Clave del módulo en el catálogo de la plataforma. */
export const ANALYTICS_MODULE = 'analytics';
export const RANGES = [7, 30, 90] as const;

export type VisitInfo = { ua: string; referer: string; ip: string; query: string; host: string };

const dayBogota = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0);

@Injectable()
export class AnalyticsService {
  private readonly salt: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    config: ConfigService,
  ) {
    this.salt = config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-salt';
  }

  /** Cuenta una visita a una página publicada. Nunca falla hacia el visitante. */
  async record(page: { siteId: string; path: string }, v: VisitInfo) {
    if (isBot(v.ua)) return;
    const day = dayBogota();
    const source = sourceOf(v.referer, v.query, v.host) ?? 'internal';
    await this.prisma.pageView
      .create({
        data: {
          siteId: page.siteId,
          day: new Date(`${day}T00:00:00Z`),
          path: page.path.slice(0, 200),
          source,
          device: deviceOf(v.ua),
          visitor: visitorOf(day, v.ip, v.ua, this.salt),
        },
      })
      .catch(() => undefined);
  }

  /** Informe de la página de la empresa (y de su tienda, si la tiene) en los últimos `days` días. */
  async report(userId: string, companyId: string, rawDays: number) {
    await this.companies.requireMember(userId, companyId, 'supervisor');
    await this.companies.requireModule(companyId, ANALYTICS_MODULE);
    const days = (RANGES as readonly number[]).includes(rawDays) ? rawDays : 30;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { siteId: true, site: { select: { name: true } }, modules: { where: { key: 'store' }, select: { key: true } } },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const today = dayBogota();
    const from = addDays(today, -(days - 1));
    const prevFrom = addDays(from, -days);
    const fromDate = new Date(`${from}T00:00:00Z`);
    const prevDate = new Date(`${prevFrom}T00:00:00Z`);

    let web = null;
    if (company.siteId) {
      const siteId = company.siteId;
      const [totals, prev, daily, pages, sources, devices, contacts] = await Promise.all([
        this.prisma.$queryRaw<{ views: bigint; visitors: bigint }[]>`
          SELECT count(*) AS views, count(DISTINCT (day, visitor)) AS visitors FROM page_views WHERE site_id = ${siteId}::uuid AND day >= ${fromDate}`,
        this.prisma.$queryRaw<{ views: bigint; visitors: bigint }[]>`
          SELECT count(*) AS views, count(DISTINCT (day, visitor)) AS visitors FROM page_views WHERE site_id = ${siteId}::uuid AND day >= ${prevDate} AND day < ${fromDate}`,
        this.prisma.$queryRaw<{ day: Date; views: bigint; visitors: bigint }[]>`
          SELECT day, count(*) AS views, count(DISTINCT visitor) AS visitors FROM page_views WHERE site_id = ${siteId}::uuid AND day >= ${fromDate} GROUP BY day`,
        this.prisma.$queryRaw<{ path: string; views: bigint }[]>`
          SELECT path, count(*) AS views FROM page_views WHERE site_id = ${siteId}::uuid AND day >= ${fromDate} GROUP BY path ORDER BY views DESC LIMIT 10`,
        this.prisma.$queryRaw<{ source: string; visitors: bigint }[]>`
          SELECT source, count(DISTINCT (day, visitor)) AS visitors FROM page_views
          WHERE site_id = ${siteId}::uuid AND day >= ${fromDate} AND source <> 'internal' GROUP BY source ORDER BY visitors DESC LIMIT 10`,
        this.prisma.$queryRaw<{ device: string; visitors: bigint }[]>`
          SELECT device, count(DISTINCT (day, visitor)) AS visitors FROM page_views WHERE site_id = ${siteId}::uuid AND day >= ${fromDate} GROUP BY device`,
        this.prisma.formSubmission.count({ where: { siteId, createdAt: { gte: fromDate } } }),
      ]);
      const byDay = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), d]));
      web = {
        siteName: company.site?.name ?? null,
        views: num(totals[0]?.views),
        visitors: num(totals[0]?.visitors),
        previous: { views: num(prev[0]?.views), visitors: num(prev[0]?.visitors) },
        contacts,
        daily: Array.from({ length: days }, (_, i) => {
          const day = addDays(from, i);
          const d = byDay.get(day);
          return { day, views: num(d?.views), visitors: num(d?.visitors) };
        }),
        pages: pages.map((p) => ({ path: p.path, views: num(p.views) })),
        sources: sources.map((s) => ({ source: s.source, visitors: num(s.visitors) })),
        devices: Object.fromEntries(devices.map((d) => [d.device, num(d.visitors)])) as Record<string, number>,
      };
    }

    let store = null;
    if (company.modules.length) {
      const [cur, before] = await Promise.all(
        [
          [fromDate, undefined],
          [prevDate, fromDate],
        ].map(([gte, lt]) =>
          this.prisma.storeOrder.aggregate({
            where: { companyId, status: { not: 'cancelled' }, createdAt: { gte: gte as Date, ...(lt ? { lt: lt as Date } : {}) } },
            _count: { _all: true },
            _sum: { totalCents: true },
          }),
        ),
      );
      store = {
        orders: cur._count._all,
        sales: Number((cur._sum.totalCents ?? 0n) / 100n),
        previous: { orders: before._count._all, sales: Number((before._sum.totalCents ?? 0n) / 100n) },
      };
    }
    return { days, from, to: today, web, store };
  }
}
