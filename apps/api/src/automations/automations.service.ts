import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTOMATIONS_MODULE, MAX_AUTOMATIONS, MAX_EMAILS_PER_DAY, NOTIFY_TO, TRIGGERS, type TriggerKey } from './automations.constants.js';
import type { ActionDto, SaveAutomationDto } from './dto/automations.dto.js';

type Action = {
  type: 'notify' | 'email' | 'crm_contact' | 'ticket';
  to?: string;
  title?: string;
  body?: string;
  priority?: string;
  assigneeMemberId?: string | null;
};
type Result = { type: string; ok: boolean; message: string };

/** Lo que trae un evento: datos para los mensajes, valor (para la condición), resumen y la persona (para el CRM). */
export type AutomationEvent = {
  vars: Record<string, string | number | null | undefined>;
  amountPesos?: number;
  summary: string;
  /** Ruta dentro de /empresa/[id] para la alerta y el correo. */
  href?: string;
  contact?: { name: string; email?: string | null; phone?: string | null };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pesos = (c: bigint | null) => (c == null ? null : Number(c / 100n));
const name = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

/** Cambia {campo} por su valor; lo que no se conoce queda tal cual. */
export const fill = (template: string | undefined, vars: AutomationEvent['vars']) =>
  (template ?? '').replace(/\{([a-z_]+)\}/g, (all, k: string) => (vars[k] === undefined || vars[k] === null ? all : String(vars[k])));

const automationSelect = {
  id: true,
  name: true,
  trigger: true,
  minAmountCents: true,
  actions: true,
  active: true,
  runCount: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.AutomationSelect;

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly alerts: AlertsService,
    private readonly email: EmailService,
  ) {}

  /** Las automatizaciones las arman y ven los administradores de la empresa. */
  private async access(userId: string, companyId: string) {
    const me = await this.companies.requireMember(userId, companyId, 'admin');
    await this.companies.requireModule(companyId, AUTOMATIONS_MODULE);
    return me;
  }

  private shape(a: Prisma.AutomationGetPayload<{ select: typeof automationSelect }>) {
    const { minAmountCents, ...rest } = a;
    return { ...rest, minAmount: pesos(minAmountCents) };
  }

  async list(userId: string, companyId: string) {
    await this.access(userId, companyId);
    const [rows, runs, members, modules] = await Promise.all([
      this.prisma.automation.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' }, select: automationSelect }),
      this.prisma.automationRun.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, status: true, summary: true, results: true, createdAt: true, automation: { select: { id: true, name: true } } },
      }),
      this.prisma.companyMember.findMany({
        where: { companyId, status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.companyModule.findMany({ where: { companyId }, select: { key: true } }),
    ]);
    return {
      automations: rows.map((a) => this.shape(a)),
      runs,
      triggers: Object.entries(TRIGGERS).map(([key, t]) => ({ key, ...t })),
      members: members.map((m) => ({ id: m.id, name: name(m.user), role: m.role })),
      modules: modules.map((m) => m.key),
    };
  }

  private async clean(companyId: string, dto: SaveAutomationDto) {
    const actions: Action[] = [];
    for (const a of dto.actions as ActionDto[]) {
      if (a.type === 'notify') {
        if (
          !a.to ||
          (!(NOTIFY_TO as readonly string[]).includes(a.to) &&
            !(await this.prisma.companyMember.findFirst({ where: { id: a.to, companyId, status: 'active' }, select: { id: true } })))
        ) {
          throw new BadRequestException('Elige a quién avisar');
        }
        actions.push({ type: 'notify', to: a.to, title: a.title, body: a.body || undefined });
      } else if (a.type === 'email') {
        if (!a.to || !EMAIL.test(a.to)) throw new BadRequestException('Escribe un correo válido para el aviso');
        actions.push({ type: 'email', to: a.to.toLowerCase(), title: a.title, body: a.body || undefined });
      } else if (a.type === 'crm_contact') {
        if (!['store_order', 'site_contact', 'quote_accepted', 'quote_rejected'].includes(dto.trigger))
          throw new BadRequestException('Guardar en el CRM solo sirve cuando el evento trae a una persona (pedidos, formulario, cotizaciones)');
        actions.push({ type: 'crm_contact' });
      } else {
        if (
          a.assigneeMemberId &&
          !(await this.prisma.companyMember.findFirst({ where: { id: a.assigneeMemberId, companyId, status: 'active' }, select: { id: true } }))
        ) {
          throw new BadRequestException('Esa persona no está en la empresa');
        }
        actions.push({
          type: 'ticket',
          title: a.title,
          body: a.body || undefined,
          priority: a.priority ?? 'medium',
          assigneeMemberId: a.assigneeMemberId || null,
        });
      }
    }
    const t = TRIGGERS[dto.trigger as TriggerKey];
    return {
      name: dto.name,
      trigger: dto.trigger,
      minAmountCents: t.amount && dto.minAmount ? BigInt(dto.minAmount) * 100n : null,
      actions: actions as unknown as Prisma.InputJsonValue,
      active: dto.active ?? true,
    };
  }

  async create(userId: string, companyId: string, dto: SaveAutomationDto) {
    await this.access(userId, companyId);
    if ((await this.prisma.automation.count({ where: { companyId } })) >= MAX_AUTOMATIONS)
      throw new BadRequestException(`Máximo ${MAX_AUTOMATIONS} automatizaciones por empresa`);
    return this.shape(
      await this.prisma.automation.create({
        data: { ...(await this.clean(companyId, dto)), companyId, createdById: userId },
        select: automationSelect,
      }),
    );
  }

  async update(userId: string, companyId: string, automationId: string, dto: SaveAutomationDto) {
    await this.access(userId, companyId);
    const data = await this.clean(companyId, dto);
    const { count } = await this.prisma.automation.updateMany({ where: { id: automationId, companyId }, data });
    if (!count) throw new NotFoundException('Automatización no encontrada');
    return this.shape(await this.prisma.automation.findUniqueOrThrow({ where: { id: automationId }, select: automationSelect }));
  }

  async toggle(userId: string, companyId: string, automationId: string, active: boolean) {
    await this.access(userId, companyId);
    const { count } = await this.prisma.automation.updateMany({ where: { id: automationId, companyId }, data: { active } });
    if (!count) throw new NotFoundException('Automatización no encontrada');
    return { ok: true };
  }

  async remove(userId: string, companyId: string, automationId: string) {
    await this.access(userId, companyId);
    const { count } = await this.prisma.automation.deleteMany({ where: { id: automationId, companyId } });
    if (!count) throw new NotFoundException('Automatización no encontrada');
  }

  // ───────── ejecutar ─────────

  /**
   * Avisa que pasó algo. Corre las automatizaciones activas de la empresa para ese disparador. Nunca lanza:
   * lo que lo llamó (un pedido, un formulario…) no se puede caer por una automatización.
   */
  async emit(companyId: string, trigger: TriggerKey, event: AutomationEvent) {
    try {
      const enabled = await this.prisma.companyModule.findUnique({
        where: { companyId_key: { companyId, key: AUTOMATIONS_MODULE } },
        select: { key: true },
      });
      if (!enabled) return;
      const list = await this.prisma.automation.findMany({
        where: { companyId, trigger, active: true },
        select: { id: true, minAmountCents: true, actions: true },
      });
      for (const a of list) await this.run(companyId, trigger, a, event);
    } catch (e) {
      this.logger.error(`Automatizaciones de ${companyId} (${trigger}): ${(e as Error).message}`);
    }
  }

  private async run(
    companyId: string,
    trigger: TriggerKey,
    a: { id: string; minAmountCents: bigint | null; actions: unknown },
    event: AutomationEvent,
  ) {
    if (a.minAmountCents != null && (event.amountPesos ?? 0) * 100 < Number(a.minAmountCents)) return;
    const results: Result[] = [];
    for (const action of (a.actions as Action[]) ?? []) {
      try {
        results.push(await this.act(companyId, trigger, action, event));
      } catch (e) {
        results.push({ type: action.type, ok: false, message: (e as Error).message.slice(0, 200) });
      }
    }
    const status = results.every((r) => r.ok) ? 'ok' : 'error';
    await this.prisma.$transaction([
      this.prisma.automationRun.create({
        data: { automationId: a.id, companyId, status, summary: event.summary.slice(0, 300), results: results as unknown as Prisma.InputJsonValue },
      }),
      this.prisma.automation.update({ where: { id: a.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }),
    ]);
  }

  private async act(companyId: string, trigger: TriggerKey, action: Action, event: AutomationEvent): Promise<Result> {
    const v = event.vars;
    if (action.type === 'notify') {
      const team = await this.prisma.companyMember.findMany({ where: { companyId, status: 'active' }, select: { id: true, role: true } });
      const min = action.to === 'admins' ? 'admin' : action.to === 'supervisors' ? 'supervisor' : null;
      const ids =
        action.to === 'everyone'
          ? team.map((m) => m.id)
          : min
            ? team.filter((m) => roleRank(m.role) >= roleRank(min)).map((m) => m.id)
            : team.filter((m) => m.id === action.to).map((m) => m.id);
      const sent = await this.alerts.notify(companyId, ids, {
        kind: 'automation',
        title: fill(action.title, v).slice(0, 200),
        body: action.body ? fill(action.body, v).slice(0, 500) : event.summary,
        href: event.href,
      });
      return sent
        ? { type: 'notify', ok: true, message: `Aviso a ${sent} ${sent === 1 ? 'persona' : 'personas'}` }
        : { type: 'notify', ok: false, message: 'Nadie recibió el aviso (¿la empresa tiene el módulo Alertas?)' };
    }
    if (action.type === 'email') {
      const [{ n }] = await this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM automation_runs r, jsonb_array_elements(r.results) x
        WHERE r.company_id = ${companyId}::uuid AND r.created_at > now() - interval '1 day' AND x->>'type' = 'email' AND x->>'ok' = 'true'`;
      if (Number(n) >= MAX_EMAILS_PER_DAY) return { type: 'email', ok: false, message: `Se llegó al tope de ${MAX_EMAILS_PER_DAY} correos por día` };
      const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } });
      await this.email.sendAutomation(action.to!, {
        companyName: company.name,
        subject: fill(action.title, v),
        body: action.body ? fill(action.body, v) : event.summary,
        path: event.href ? `/empresa/${companyId}/${event.href}` : null,
      });
      return { type: 'email', ok: true, message: `Correo a ${action.to}` };
    }
    if (action.type === 'crm_contact') {
      const c = event.contact;
      if (!c?.name) return { type: 'crm_contact', ok: false, message: 'El evento no trae a una persona' };
      const email = c.email?.trim().toLowerCase() || null;
      const digits = (c.phone ?? '').replace(/\D/g, '');
      const existing = await this.prisma.crmContact.findFirst({
        where: {
          companyId,
          OR: [...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []), ...(c.phone ? [{ phone: c.phone.trim() }] : [])],
        },
        select: { id: true, name: true },
      });
      const note = `${TRIGGERS[trigger].label}: ${event.summary}`.slice(0, 4000);
      if (existing && (email || digits)) {
        await this.prisma.$transaction([
          this.prisma.crmActivity.create({ data: { companyId, contactId: existing.id, kind: 'note', body: note } }),
          this.prisma.crmContact.update({ where: { id: existing.id }, data: { lastContactAt: new Date() } }),
        ]);
        return { type: 'crm_contact', ok: true, message: `Nota en el cliente ${existing.name}` };
      }
      const created = await this.prisma.crmContact.create({
        data: {
          companyId,
          name: c.name.slice(0, 150),
          email,
          phone: c.phone?.slice(0, 50) || null,
          source: 'web',
          stage: trigger === 'quote_accepted' ? 'won' : 'lead',
          lastContactAt: new Date(),
          activities: { create: { companyId, kind: 'note', body: note } },
        },
        select: { name: true },
      });
      return { type: 'crm_contact', ok: true, message: `Cliente nuevo en el CRM: ${created.name}` };
    }
    // ticket
    const assignee = action.assigneeMemberId
      ? await this.prisma.companyMember.findFirst({ where: { id: action.assigneeMemberId, companyId, status: 'active' }, select: { id: true } })
      : null;
    const ticket = await this.prisma.$transaction(async (tx) => {
      const { ticketSeq } = await tx.company.update({ where: { id: companyId }, data: { ticketSeq: { increment: 1 } }, select: { ticketSeq: true } });
      return tx.ticket.create({
        data: {
          companyId,
          number: ticketSeq,
          title: fill(action.title, v).slice(0, 150) || 'Ticket automático',
          description: (action.body ? fill(action.body, v) : event.summary).slice(0, 8000),
          category: 'other',
          priority: action.priority ?? 'medium',
          status: assignee ? 'assigned' : 'open',
          assigneeMemberId: assignee?.id ?? null,
        },
        select: { id: true, number: true },
      });
    });
    if (assignee)
      await this.alerts.notify(companyId, [assignee.id], {
        kind: 'ticket',
        title: `Ticket #${ticket.number} a tu cargo: ${fill(action.title, v).slice(0, 120)}`,
        href: `tickets/${ticket.id}`,
      });
    return { type: 'ticket', ok: true, message: `Ticket #${ticket.number}` };
  }
}
