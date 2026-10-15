import { Injectable, Logger } from '@nestjs/common';
import { roleRank } from '../companies/companies.constants.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ALERTS_MODULE, AlertsService } from './alerts.service.js';

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
/** Avisos a 30, 7 y 0 días de un vencimiento, y uno si ya venció. */
const THRESHOLDS = [30, 7, 0];

/**
 * Revisión diaria (cron de Vercel, junto con la de dominios): vencimientos, cumpleaños, solicitudes sin responder y
 * tickets urgentes sin responsable; luego un resumen por correo a cada persona con sus avisos nuevos.
 */
@Injectable()
export class AlertsDailyService {
  private readonly logger = new Logger(AlertsDailyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly email: EmailService,
  ) {}

  async run(now = new Date()) {
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now);
    const today = new Date(`${todayIso}T00:00:00Z`);
    const companies = await this.prisma.company.findMany({
      where: { status: 'active', modules: { some: { key: ALERTS_MODULE } } },
      select: { id: true, name: true, modules: { select: { key: true } } },
    });
    let created = 0;
    for (const company of companies) {
      try {
        created += await this.checkCompany(company.id, new Set(company.modules.map((m) => m.key)), today, now);
      } catch (error) {
        this.logger.error(`Revisión de alertas de ${company.name} falló: ${(error as Error).message}`);
      }
    }
    const emailed = await this.sendDigests(now);
    return { companies: companies.length, created, emailed };
  }

  private async checkCompany(companyId: string, modules: Set<string>, today: Date, now: Date) {
    const todayIso = day(today);
    const mmdd = todayIso.slice(5);
    let n = 0;
    const members = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      select: { id: true, role: true, user: { select: { firstName: true, lastName: true, email: true } }, profile: { select: { birthDate: true, contractEnd: true } } },
    });
    // RR. HH. en adelante que están por encima de `role` (quien debe enterarse de vencimientos de esa persona).
    const hrAbove = (role?: string) =>
      members.filter((m) => roleRank(m.role) >= roleRank('hr') && (!role || m.role === 'owner' || roleRank(m.role) > roleRank(role))).map((m) => m.id);
    const daysUntil = (d: Date) => Math.round((+d - +today) / DAY);

    if (modules.has('employees')) {
      for (const p of members) {
        const birth = p.profile?.birthDate;
        if (birth && (day(birth).slice(5) === mmdd || (day(birth).slice(5) === '02-29' && mmdd === '02-28' && new Date(Date.UTC(today.getUTCFullYear(), 1, 29)).getUTCMonth() !== 1))) {
          n += await this.alerts.notify(
            companyId,
            members.filter((m) => m.id !== p.id).map((m) => m.id),
            { kind: 'birthday', title: `Hoy cumple años ${name(p.user)}`, body: '¡No olvides felicitarle!', href: 'personal', dedupeKey: `birthday:${p.id}:${todayIso}` },
          );
        }
        const end = p.profile?.contractEnd;
        if (end) {
          const left = daysUntil(end);
          if (THRESHOLDS.includes(left)) {
            n += await this.alerts.notify(companyId, hrAbove(p.role), {
              kind: 'contract',
              title: left === 0 ? `Hoy vence el contrato de ${name(p.user)}` : `El contrato de ${name(p.user)} vence en ${left} días`,
              body: 'Decide si se renueva y avísale a tiempo.',
              href: `personal/${p.id}`,
              dedupeKey: `contract:${p.id}:${day(end)}:${left}`,
            });
          }
        }
      }
    }

    if (modules.has('documents')) {
      const docs = await this.prisma.companyDocument.findMany({
        where: { companyId, status: 'ready', expiresOn: { gte: new Date(+today - DAY), lte: new Date(+today + 30 * DAY) } },
        select: { id: true, title: true, expiresOn: true, memberId: true, member: { select: { role: true } } },
      });
      for (const d of docs) {
        const left = daysUntil(d.expiresOn!);
        if (![...THRESHOLDS, -1].includes(left)) continue;
        n += await this.alerts.notify(companyId, hrAbove(d.member?.role), {
          kind: 'document',
          title: left < 0 ? `Venció ayer: ${d.title}` : left === 0 ? `Vence hoy: ${d.title}` : `${d.title} vence en ${left} días`,
          href: `documentos${d.memberId ? `?member=${d.memberId}` : ''}`,
          dedupeKey: `document:${d.id}:${left}`,
        });
      }
    }

    if (modules.has('requests')) {
      // Solicitudes que llevan más de 2 días esperando a alguien.
      const stale = await this.prisma.leaveRequest.findMany({
        where: { companyId, status: { in: ['pending', 'supervisor_ok'] }, updatedAt: { lt: new Date(+now - 2 * DAY) } },
        select: { id: true, status: true, type: true, memberId: true, member: { select: { role: true, user: { select: { firstName: true, lastName: true, email: true } } } } },
      });
      for (const r of stale) {
        const deciders = await this.alerts.membersAbove(companyId, r.status === 'pending' ? 'supervisor' : 'hr', r.member.role, r.memberId);
        n += await this.alerts.notify(companyId, deciders, {
          kind: 'request',
          title: `La solicitud de ${name(r.member.user)} lleva más de 2 días sin respuesta`,
          href: `solicitudes/${r.id}`,
          dedupeKey: `request-stale:${r.id}:${r.status}`,
        });
      }
    }

    if (modules.has('tickets')) {
      const urgent = await this.prisma.ticket.findMany({
        where: { companyId, status: 'open', assigneeMemberId: null, priority: { in: ['urgent', 'high'] }, createdAt: { lt: new Date(+now - DAY) } },
        select: { id: true, number: true, title: true },
      });
      if (urgent.length) {
        const staff = await this.alerts.membersAbove(companyId, 'supervisor');
        for (const t of urgent) {
          n += await this.alerts.notify(companyId, staff, {
            kind: 'ticket',
            title: `El ticket #${t.number} lleva más de un día sin responsable`,
            body: t.title,
            href: `tickets/${t.id}`,
            dedupeKey: `ticket-stale:${t.id}`,
          });
        }
      }
    }
    return n;
  }

  /** Un correo por persona con sus avisos sin leer de las últimas 24 horas que no se le hayan mandado. */
  private async sendDigests(now: Date) {
    const pending = await this.prisma.notification.findMany({
      where: { readAt: null, emailedAt: null, createdAt: { gte: new Date(+now - DAY) }, member: { status: 'active' } },
      orderBy: { createdAt: 'asc' },
      take: 5000,
      select: { id: true, title: true, body: true, href: true, companyId: true, memberId: true, company: { select: { name: true } }, member: { select: { user: { select: { email: true, firstName: true } } } } },
    });
    const byMember = new Map<string, typeof pending>();
    for (const p of pending) byMember.set(p.memberId, [...(byMember.get(p.memberId) ?? []), p]);
    let sent = 0;
    for (const [, items] of byMember) {
      const first = items[0];
      await this.email.sendAlertsDigest(first.member.user.email, {
        firstName: first.member.user.firstName,
        companyName: first.company.name,
        companyId: first.companyId,
        items: items.slice(0, 20).map((i) => ({ title: i.title, body: i.body, href: i.href })),
        more: Math.max(0, items.length - 20),
      });
      await this.prisma.notification.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { emailedAt: now } });
      sent++;
    }
    return sent;
  }
}
