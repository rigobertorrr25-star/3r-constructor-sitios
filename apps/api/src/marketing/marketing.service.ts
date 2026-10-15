import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SaveCampaignDto, SegmentDto, SubscribeDto } from './dto/marketing.dto.js';
import { DAILY_CAP, MARKETING_MODULE, TEST_CAP } from './marketing.constants.js';

type Segment = { stages: string[]; sources: string[]; tags: string[] };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const DAY = 24 * 60 * 60 * 1000;
const token = () => randomBytes(18).toString('base64url');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const delayMs = () => {
  const n = Number(process.env.MARKETING_SEND_DELAY_MS ?? 600);
  return Number.isFinite(n) && n >= 0 ? n : 600;
};

const campaignSelect = {
  id: true,
  name: true,
  subject: true,
  body: true,
  segment: true,
  status: true,
  recipientCount: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.CampaignSelect;

function segmentOf(raw: unknown): Segment {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Segment>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { stages: list(s.stages), sources: list(s.sources), tags: list(s.tags) };
}

function cleanSegment(dto: SegmentDto | undefined): Segment {
  const uniq = (v: string[] | undefined) => [...new Set((v ?? []).map((x) => x.trim()).filter(Boolean))];
  return { stages: uniq(dto?.stages), sources: uniq(dto?.sources), tags: uniq(dto?.tags).map((t) => t.toLowerCase()) };
}

/** Quien puede recibir campañas: tiene correo, aceptó y no se ha dado de baja. */
function audienceWhere(companyId: string, s: Segment): Prisma.CrmContactWhereInput {
  return {
    companyId,
    email: { not: null },
    marketingOptIn: true,
    unsubscribedAt: null,
    ...(s.stages.length ? { stage: { in: s.stages } } : {}),
    ...(s.sources.length ? { source: { in: s.sources } } : {}),
    ...(s.tags.length ? { tags: { hasSome: s.tags } } : {}),
  };
}

/** "laura@ejemplo.com" → "la***@ejemplo.com" (la página de baja no muestra el correo completo). */
const mask = (email: string) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain ?? ''}`;
};

@Injectable()
export class MarketingService implements OnModuleInit {
  private readonly logger = new Logger(MarketingService.name);
  /** Campañas que se están mandando en este proceso (para no mandarlas dos veces). */
  private readonly running = new Set<string>();
  /** Pruebas por empresa en las últimas 24 horas (en memoria: es solo un freno). */
  private readonly tests = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly email: EmailService,
  ) {}

  /** Si el servidor se reinició a mitad de un envío, sigue con los que faltaban. */
  async onModuleInit() {
    const pending = await this.prisma.campaign.findMany({ where: { status: 'sending' }, select: { id: true } });
    for (const c of pending) void this.process(c.id);
  }

  /** Ver y preparar campañas: supervisor en adelante. Enviar y el enlace público: administrador. */
  private async access(userId: string, companyId: string, min: 'supervisor' | 'admin' = 'supervisor') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, MARKETING_MODULE);
    return me;
  }

  private async sentToday(companyId: string) {
    return this.prisma.campaignRecipient.count({ where: { campaign: { companyId }, createdAt: { gt: new Date(Date.now() - DAY) } } });
  }

  private async tags(companyId: string) {
    const rows = await this.prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest(tags) AS tag FROM crm_contacts WHERE company_id = ${companyId}::uuid ORDER BY tag`;
    return rows.map((r) => r.tag);
  }

  async overview(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const [company, campaigns, eligible, withEmail, unsubscribed, sentToday, tags] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { newsletterToken: true } }),
      this.prisma.campaign.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 100, select: campaignSelect }),
      this.prisma.crmContact.count({ where: audienceWhere(companyId, cleanSegment(undefined)) }),
      this.prisma.crmContact.count({ where: { companyId, email: { not: null } } }),
      this.prisma.crmContact.count({ where: { companyId, unsubscribedAt: { not: null } } }),
      this.sentToday(companyId),
      this.tags(companyId),
    ]);
    const stats = await this.statsFor(campaigns.map((c) => c.id));
    return {
      canSend: ['owner', 'admin'].includes(me.role),
      newsletterToken: company.newsletterToken,
      audience: { eligible, withEmail, unsubscribed },
      dailyCap: DAILY_CAP,
      remainingToday: Math.max(0, DAILY_CAP - sentToday),
      tags,
      campaigns: campaigns.map(({ body, ...c }) => ({ ...c, segment: segmentOf(c.segment), stats: stats(c.id), excerpt: body.slice(0, 160) })),
    };
  }

  /** Conteos por campaña: enviados, fallidos, pendientes, omitidos y bajas. */
  private async statsFor(ids: string[]) {
    const rows = ids.length
      ? await this.prisma.campaignRecipient.groupBy({ by: ['campaignId', 'status'], where: { campaignId: { in: ids } }, _count: { _all: true } })
      : [];
    const unsub = ids.length
      ? await this.prisma.campaignRecipient.groupBy({
          by: ['campaignId'],
          where: { campaignId: { in: ids }, unsubscribedAt: { not: null } },
          _count: { _all: true },
        })
      : [];
    return (id: string) => {
      const by = (status: string) => rows.find((r) => r.campaignId === id && r.status === status)?._count._all ?? 0;
      return {
        sent: by('sent'),
        failed: by('failed'),
        pending: by('pending'),
        skipped: by('skipped'),
        unsubscribed: unsub.find((r) => r.campaignId === id)?._count._all ?? 0,
      };
    };
  }

  private async find(companyId: string, campaignId: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id: campaignId, companyId }, select: campaignSelect });
    if (!c) throw new NotFoundException('Campaña no encontrada');
    return c;
  }

  async get(userId: string, companyId: string, campaignId: string) {
    const me = await this.access(userId, companyId);
    const c = await this.find(companyId, campaignId);
    const segment = segmentOf(c.segment);
    const [stats, audience, sentToday] = await Promise.all([
      this.statsFor([c.id]),
      c.status === 'draft' ? this.prisma.crmContact.count({ where: audienceWhere(companyId, segment) }) : Promise.resolve(c.recipientCount),
      this.sentToday(companyId),
    ]);
    return {
      ...c,
      segment,
      audience,
      stats: stats(c.id),
      canSend: ['owner', 'admin'].includes(me.role),
      remainingToday: Math.max(0, DAILY_CAP - sentToday),
    };
  }

  /** Cuántos recibirían un correo con ese grupo (para el editor, antes de guardar). */
  async audienceCount(userId: string, companyId: string, dto: SegmentDto) {
    await this.access(userId, companyId);
    return { count: await this.prisma.crmContact.count({ where: audienceWhere(companyId, cleanSegment(dto)) }) };
  }

  async create(userId: string, companyId: string, dto: SaveCampaignDto) {
    await this.access(userId, companyId);
    return this.prisma.campaign.create({
      data: { companyId, name: dto.name, subject: dto.subject, body: dto.body, segment: cleanSegment(dto.segment), createdById: userId },
      select: campaignSelect,
    });
  }

  async update(userId: string, companyId: string, campaignId: string, dto: SaveCampaignDto) {
    await this.access(userId, companyId);
    const c = await this.find(companyId, campaignId);
    if (c.status !== 'draft') throw new ConflictException('Esta campaña ya se envió: no se puede cambiar');
    return this.prisma.campaign.update({
      where: { id: c.id },
      data: { name: dto.name, subject: dto.subject, body: dto.body, segment: cleanSegment(dto.segment) },
      select: campaignSelect,
    });
  }

  async remove(userId: string, companyId: string, campaignId: string) {
    await this.access(userId, companyId);
    const c = await this.find(companyId, campaignId);
    // Las enviadas se quedan: el enlace de baja de esos correos tiene que seguir sirviendo.
    if (c.status !== 'draft') throw new ConflictException('Una campaña enviada no se puede borrar');
    await this.prisma.campaign.delete({ where: { id: c.id } });
  }

  private async sender(companyId: string, userId: string) {
    const [company, user] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true, city: true, phone: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    return { companyName: company.name, companyLine: [company.city, company.phone].filter(Boolean).join(' · '), replyTo: user?.email ?? null };
  }

  /** Manda la campaña solo a quien la prepara, para ver cómo se ve. */
  async test(userId: string, companyId: string, campaignId: string) {
    await this.access(userId, companyId);
    const c = await this.find(companyId, campaignId);
    const now = Date.now();
    const recent = (this.tests.get(companyId) ?? []).filter((t) => t > now - DAY);
    if (recent.length >= TEST_CAP) throw new BadRequestException('Ya mandaste muchas pruebas hoy. Intenta mañana.');
    this.tests.set(companyId, [...recent, now]);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const from = await this.sender(companyId, userId);
    const ok = await this.email.sendMarketing(user.email, { ...from, subject: `[Prueba] ${c.subject}`, body: c.body, token: 'prueba' });
    if (!ok) throw new BadRequestException('No se pudo mandar la prueba. Intenta de nuevo en un rato.');
    return { sentTo: user.email };
  }

  /** Arma la lista de destinatarios y empieza a mandar en segundo plano. */
  async send(userId: string, companyId: string, campaignId: string) {
    await this.access(userId, companyId, 'admin');
    const c = await this.find(companyId, campaignId);
    if (c.status !== 'draft') throw new ConflictException('Esta campaña ya se envió');
    const contacts = await this.prisma.crmContact.findMany({
      where: audienceWhere(companyId, segmentOf(c.segment)),
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    });
    // Un correo por dirección, aunque esté repetida en el CRM.
    const seen = new Set<string>();
    const list = contacts.filter((p) => {
      const key = p.email!.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!list.length) throw new BadRequestException('Nadie en ese grupo ha aceptado recibir promociones');
    const remaining = DAILY_CAP - (await this.sentToday(companyId));
    if (list.length > remaining) {
      throw new BadRequestException(
        remaining > 0
          ? `Hoy puedes mandar ${remaining} correos más y esta campaña tiene ${list.length}. Elige un grupo más pequeño o envíala mañana.`
          : `Ya mandaste ${DAILY_CAP} correos hoy, el máximo diario. Envíala mañana.`,
      );
    }
    const claimed = await this.prisma.$transaction(async (tx) => {
      const r = await tx.campaign.updateMany({ where: { id: c.id, status: 'draft' }, data: { status: 'sending', recipientCount: list.length } });
      if (!r.count) return false;
      await tx.campaignRecipient.createMany({
        data: list.map((p) => ({ campaignId: c.id, contactId: p.id, email: p.email!.trim(), name: p.name, token: token() })),
      });
      return true;
    });
    if (!claimed) throw new ConflictException('Esta campaña ya se envió');
    void this.process(c.id, userId);
    return { status: 'sending', recipientCount: list.length };
  }

  /** Manda los pendientes uno por uno, con una pausa entre correos. */
  async process(campaignId: string, userId?: string) {
    if (this.running.has(campaignId)) return;
    this.running.add(campaignId);
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { companyId: true, subject: true, body: true, createdById: true },
      });
      if (!campaign) return;
      const from = await this.sender(campaign.companyId, userId ?? campaign.createdById ?? '');
      for (;;) {
        const batch = await this.prisma.campaignRecipient.findMany({
          where: { campaignId, status: 'pending' },
          take: 50,
          select: { id: true, email: true, contactId: true, token: true },
        });
        if (!batch.length) break;
        // Si alguien se dio de baja mientras tanto, no le llega.
        const ids = batch.map((r) => r.contactId).filter((x): x is string => !!x);
        const stillIn = new Set(
          (
            await this.prisma.crmContact.findMany({ where: { id: { in: ids }, marketingOptIn: true, unsubscribedAt: null }, select: { id: true } })
          ).map((x) => x.id),
        );
        for (const r of batch) {
          if (r.contactId && !stillIn.has(r.contactId)) {
            await this.prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: 'skipped' } });
            continue;
          }
          const ok = await this.email.sendMarketing(r.email, { ...from, subject: campaign.subject, body: campaign.body, token: r.token });
          await this.prisma.campaignRecipient.update({
            where: { id: r.id },
            data: ok ? { status: 'sent', sentAt: new Date() } : { status: 'failed' },
          });
          const wait = delayMs();
          if (wait) await sleep(wait);
        }
      }
      await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'sent', sentAt: new Date() } });
    } catch (error) {
      this.logger.error(`La campaña ${campaignId} se detuvo: ${(error as Error).message}`);
    } finally {
      this.running.delete(campaignId);
    }
  }

  // ───────── enlace público para suscribirse ─────────

  async enableNewsletter(userId: string, companyId: string) {
    await this.access(userId, companyId, 'admin');
    const newsletterToken = randomBytes(12).toString('base64url');
    await this.prisma.company.update({ where: { id: companyId }, data: { newsletterToken } });
    return { newsletterToken };
  }

  async disableNewsletter(userId: string, companyId: string) {
    await this.access(userId, companyId, 'admin');
    await this.prisma.company.update({ where: { id: companyId }, data: { newsletterToken: null } });
  }

  private async byNewsletter(t: string) {
    if (!TOKEN.test(t)) throw new NotFoundException('Página no encontrada');
    const c = await this.prisma.company.findUnique({
      where: { newsletterToken: t },
      select: { id: true, name: true, city: true, status: true, modules: { where: { key: MARKETING_MODULE }, select: { key: true } } },
    });
    if (!c || c.status !== 'active' || !c.modules.length) throw new NotFoundException('Página no encontrada');
    return c;
  }

  async publicNewsletter(t: string) {
    const c = await this.byNewsletter(t);
    return { companyName: c.name, city: c.city };
  }

  /** Guarda (o actualiza) al contacto en el CRM con su permiso y la fecha. */
  async subscribe(t: string, dto: SubscribeDto) {
    const c = await this.byNewsletter(t);
    const now = new Date();
    const existing = await this.prisma.crmContact.findFirst({
      where: { companyId: c.id, email: { equals: dto.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.crmContact.update({
        where: { id: existing.id },
        data: { marketingOptIn: true, marketingOptInAt: now, unsubscribedAt: null },
      });
    } else {
      await this.prisma.crmContact.create({
        data: { companyId: c.id, name: dto.name, email: dto.email, source: 'web', stage: 'lead', marketingOptIn: true, marketingOptInAt: now },
      });
    }
    return { companyName: c.name };
  }

  // ───────── darse de baja ─────────

  private async recipient(t: string) {
    if (!TOKEN.test(t)) throw new NotFoundException('Enlace no válido');
    const r = await this.prisma.campaignRecipient.findUnique({
      where: { token: t },
      select: {
        id: true,
        email: true,
        contactId: true,
        unsubscribedAt: true,
        campaign: { select: { companyId: true, company: { select: { name: true } } } },
      },
    });
    if (!r) throw new NotFoundException('Enlace no válido');
    return r;
  }

  async publicUnsubscribe(t: string) {
    if (t === 'prueba') return { test: true, companyName: null, email: null, done: false };
    const r = await this.recipient(t);
    return { test: false, companyName: r.campaign.company.name, email: mask(r.email), done: !!r.unsubscribedAt };
  }

  async unsubscribe(t: string) {
    if (t === 'prueba') return { test: true, companyName: null };
    const r = await this.recipient(t);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.campaignRecipient.updateMany({ where: { id: r.id, unsubscribedAt: null }, data: { unsubscribedAt: now } }),
      // Todos los contactos de esa empresa con ese correo (puede estar repetido).
      this.prisma.crmContact.updateMany({
        where: {
          companyId: r.campaign.companyId,
          OR: [...(r.contactId ? [{ id: r.contactId }] : []), { email: { equals: r.email, mode: 'insensitive' as const } }],
        },
        data: { marketingOptIn: false, unsubscribedAt: now },
      }),
    ]);
    return { test: false, companyName: r.campaign.company.name };
  }
}
