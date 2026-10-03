import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../alerts/alerts.service.js';
import { AuditService } from '../audit/audit.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConnectWhatsappDto, StartConversationDto, UpdateConversationDto } from './dto/whatsapp.dto.js';
import { decrypt, encrypt } from './token-crypto.js';
import { WHATSAPP_CLIENT, type WaAccount, type WhatsappClient } from './whatsapp-client.js';
import { WHATSAPP_MODULE, WINDOW_MS } from './whatsapp.constants.js';

/** "300 123 4567" → "573001234567" (si son 10 dígitos que empiezan por 3, es un celular de Colombia). */
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
}
const lastTen = (phone: string) => phone.replace(/\D/g, '').slice(-10);

const conversationSelect = {
  id: true,
  waId: true,
  name: true,
  contactId: true,
  lastMessageAt: true,
  lastInboundAt: true,
  unread: true,
  assignedMemberId: true,
  status: true,
} as const;
const messageSelect = { id: true, direction: true, type: true, body: true, status: true, error: true, sentById: true, createdAt: true } as const;

type InboundValue = {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: {
    from: string;
    id: string;
    timestamp?: string;
    type: string;
    text?: { body?: string };
    image?: { caption?: string };
    video?: { caption?: string };
    document?: { caption?: string; filename?: string };
    location?: { latitude?: number; longitude?: number; name?: string };
    button?: { text?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  }[];
  statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
};

/** Lo que se ve de un mensaje que no es texto. */
function bodyOf(m: NonNullable<InboundValue['messages']>[number]) {
  switch (m.type) {
    case 'text':
      return m.text?.body ?? '';
    case 'image':
      return `📷 Foto${m.image?.caption ? `: ${m.image.caption}` : ''}`;
    case 'video':
      return `🎬 Video${m.video?.caption ? `: ${m.video.caption}` : ''}`;
    case 'audio':
      return '🎤 Nota de voz';
    case 'document':
      return `📄 Documento${m.document?.filename ? `: ${m.document.filename}` : ''}`;
    case 'location':
      return `📍 Ubicación${m.location?.name ? `: ${m.location.name}` : ''} (${m.location?.latitude ?? ''}, ${m.location?.longitude ?? ''})`;
    case 'button':
      return m.button?.text ?? 'Botón';
    case 'interactive':
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? 'Respuesta';
    case 'sticker':
      return 'Sticker';
    default:
      return 'Mensaje que no se puede mostrar aquí (ábrelo en el celular)';
  }
}
const typeOf = (t: string) => (['text', 'image', 'audio', 'document', 'location'].includes(t) ? t : 'other');

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly alerts: AlertsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(WHATSAPP_CLIENT) private readonly client: WhatsappClient,
  ) {}

  /** La bandeja la ven supervisores en adelante; conectar y traer plantillas, administradores. */
  private async access(userId: string, companyId: string, min: 'supervisor' | 'admin' = 'supervisor') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, WHATSAPP_MODULE);
    return me;
  }

  private async account(companyId: string): Promise<WaAccount> {
    const a = await this.prisma.whatsappAccount.findUnique({
      where: { companyId },
      select: { phoneNumberId: true, wabaId: true, tokenEnc: true, status: true },
    });
    if (!a) throw new ConflictException('La empresa todavía no tiene WhatsApp conectado. Escríbele al equipo de 3R.');
    if (a.status !== 'active') throw new ConflictException('El WhatsApp de la empresa está en pausa.');
    return { phoneNumberId: a.phoneNumberId, wabaId: a.wabaId, token: decrypt(a.tokenEnc) };
  }

  // ───────── equipo de 3R ─────────

  async adminGet(companyId: string) {
    const a = await this.prisma.whatsappAccount.findUnique({
      where: { companyId },
      select: { phoneNumberId: true, wabaId: true, displayPhone: true, status: true, updatedAt: true },
    });
    return { account: a, webhookPath: '/api/v1/webhooks/whatsapp' };
  }

  async adminConnect(adminId: string, companyId: string, dto: ConnectWhatsappDto, ip?: string) {
    if (!(await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })))
      throw new NotFoundException('Empresa no encontrada');
    const existing = await this.prisma.whatsappAccount.findUnique({ where: { companyId }, select: { id: true } });
    if (!existing && !dto.accessToken) throw new BadRequestException('Pega el token de acceso de Meta');
    const other = await this.prisma.whatsappAccount.findUnique({ where: { phoneNumberId: dto.phoneNumberId }, select: { companyId: true } });
    if (other && other.companyId !== companyId) throw new ConflictException('Ese número ya está conectado a otra empresa');
    const data = {
      phoneNumberId: dto.phoneNumberId,
      wabaId: dto.wabaId,
      displayPhone: dto.displayPhone,
      status: dto.status ?? 'active',
      ...(dto.accessToken ? { tokenEnc: encrypt(dto.accessToken) } : {}),
    };
    if (existing) await this.prisma.whatsappAccount.update({ where: { companyId }, data });
    else await this.prisma.whatsappAccount.create({ data: { companyId, ...data, tokenEnc: encrypt(dto.accessToken!) } });
    await this.audit.log({
      action: 'COMPANY_WHATSAPP_CONNECTED',
      userId: adminId,
      entityType: 'company',
      entityId: companyId,
      metadata: { phoneNumberId: dto.phoneNumberId },
      ipAddress: ip,
    });
    return this.adminGet(companyId);
  }

  async adminDisconnect(adminId: string, companyId: string, ip?: string) {
    await this.prisma.whatsappAccount.deleteMany({ where: { companyId } });
    await this.audit.log({ action: 'COMPANY_WHATSAPP_DISCONNECTED', userId: adminId, entityType: 'company', entityId: companyId, ipAddress: ip });
  }

  // ───────── bandeja de la empresa ─────────

  async overview(userId: string, companyId: string, filter?: string) {
    const me = await this.access(userId, companyId);
    const [account, conversations, templates, members] = await Promise.all([
      this.prisma.whatsappAccount.findUnique({ where: { companyId }, select: { displayPhone: true, status: true } }),
      this.prisma.whatsappConversation.findMany({
        where: {
          companyId,
          ...(filter === 'closed' ? { status: 'closed' } : filter === 'mine' ? { assignedMemberId: me.id, status: 'open' } : { status: 'open' }),
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 100,
        select: { ...conversationSelect, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, direction: true } } },
      }),
      this.prisma.whatsappTemplate.findMany({
        where: { companyId, status: 'APPROVED' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, language: true, body: true, params: true },
      }),
      this.prisma.companyMember.findMany({
        where: { companyId, status: 'active', role: { in: ['owner', 'admin', 'hr', 'supervisor'] } },
        select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ]);
    return {
      connected: !!account,
      account,
      canManage: atLeast(me.role, 'admin'),
      meId: me.id,
      conversations: conversations.map(({ messages, ...c }) => ({ ...c, last: messages[0] ?? null, canReply: this.inWindow(c.lastInboundAt) })),
      templates,
      members: members.map((m) => ({ id: m.id, name: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.email })),
    };
  }

  private inWindow(lastInboundAt: Date | null) {
    return !!lastInboundAt && Date.now() - lastInboundAt.getTime() < WINDOW_MS;
  }

  private async conversation(companyId: string, conversationId: string) {
    const c = await this.prisma.whatsappConversation.findFirst({ where: { id: conversationId, companyId }, select: conversationSelect });
    if (!c) throw new NotFoundException('Conversación no encontrada');
    return c;
  }

  async get(userId: string, companyId: string, conversationId: string) {
    await this.access(userId, companyId);
    const c = await this.conversation(companyId, conversationId);
    const messages = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: c.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: messageSelect,
    });
    if (c.unread) {
      await this.prisma.whatsappConversation.update({ where: { id: c.id }, data: { unread: 0 } });
      // Los dos chulitos azules del lado del cliente (si falla, no importa).
      const last = await this.prisma.whatsappMessage.findFirst({
        where: { conversationId: c.id, direction: 'in' },
        orderBy: { createdAt: 'desc' },
        select: { waMessageId: true },
      });
      if (last?.waMessageId)
        void this.account(companyId)
          .then((a) => this.client.markRead(a, last.waMessageId!))
          .catch(() => undefined);
    }
    return { ...c, unread: 0, canReply: this.inWindow(c.lastInboundAt), messages: messages.reverse() };
  }

  private async record(conversationId: string, data: { type: string; body: string; sentById: string }, send: () => Promise<string>) {
    try {
      const waMessageId = await send();
      const m = await this.prisma.whatsappMessage.create({
        data: { conversationId, direction: 'out', status: 'sent', waMessageId, ...data },
        select: messageSelect,
      });
      await this.prisma.whatsappConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      return m;
    } catch (error) {
      this.logger.warn(`WhatsApp no salió: ${(error as Error).message}`);
      await this.prisma.whatsappMessage.create({
        data: { conversationId, direction: 'out', status: 'failed', error: (error as Error).message.slice(0, 300), ...data },
      });
      throw new ServiceUnavailableException('WhatsApp no aceptó el mensaje. Intenta de nuevo en un rato.');
    }
  }

  async sendText(userId: string, companyId: string, conversationId: string, body: string) {
    const me = await this.access(userId, companyId);
    const c = await this.conversation(companyId, conversationId);
    if (!this.inWindow(c.lastInboundAt)) {
      throw new ConflictException('Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp solo deja mandarle una plantilla aprobada.');
    }
    const account = await this.account(companyId);
    return this.record(c.id, { type: 'text', body, sentById: me.id }, () => this.client.sendText(account, c.waId, body));
  }

  private async template(companyId: string, templateId: string, params: string[] = []) {
    const t = await this.prisma.whatsappTemplate.findFirst({
      where: { id: templateId, companyId, status: 'APPROVED' },
      select: { name: true, language: true, body: true, params: true },
    });
    if (!t) throw new NotFoundException('Plantilla no encontrada o no aprobada');
    const clean = params.map((p) => p.trim());
    if (clean.length < t.params || clean.slice(0, t.params).some((p) => !p))
      throw new BadRequestException(`Esta plantilla necesita ${t.params} datos`);
    const used = clean.slice(0, t.params);
    const preview = t.body.replace(/\{\{(\d+)\}\}/g, (_, n) => used[Number(n) - 1] ?? '');
    return { ...t, used, preview };
  }

  async sendTemplate(userId: string, companyId: string, conversationId: string, templateId: string, params?: string[]) {
    const me = await this.access(userId, companyId);
    const c = await this.conversation(companyId, conversationId);
    const t = await this.template(companyId, templateId, params);
    const account = await this.account(companyId);
    return this.record(c.id, { type: 'template', body: t.preview, sentById: me.id }, () =>
      this.client.sendTemplate(account, c.waId, t.name, t.language, t.used),
    );
  }

  /** Escribirle primero a un cliente (siempre con plantilla, como pide WhatsApp). */
  async start(userId: string, companyId: string, dto: StartConversationDto) {
    const me = await this.access(userId, companyId);
    const waId = normalizePhone(dto.phone);
    if (waId.length < 10 || waId.length > 15)
      throw new BadRequestException('Revisa el celular: escríbelo con indicativo (por ejemplo 57 300 123 4567)');
    const t = await this.template(companyId, dto.templateId, dto.params);
    const account = await this.account(companyId);
    const c = await this.prisma.whatsappConversation.upsert({
      where: { companyId_waId: { companyId, waId } },
      create: { companyId, waId, name: dto.name || `+${waId}`, assignedMemberId: me.id },
      update: { status: 'open' },
      select: { id: true },
    });
    await this.record(c.id, { type: 'template', body: t.preview, sentById: me.id }, () =>
      this.client.sendTemplate(account, waId, t.name, t.language, t.used),
    );
    return { conversationId: c.id };
  }

  async update(userId: string, companyId: string, conversationId: string, dto: UpdateConversationDto) {
    await this.access(userId, companyId);
    const c = await this.conversation(companyId, conversationId);
    if (dto.assignedMemberId) {
      const m = await this.prisma.companyMember.findFirst({ where: { id: dto.assignedMemberId, companyId, status: 'active' }, select: { id: true } });
      if (!m) throw new BadRequestException('Esa persona no está en la empresa');
    }
    return this.prisma.whatsappConversation.update({
      where: { id: c.id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.assignedMemberId !== undefined ? { assignedMemberId: dto.assignedMemberId } : {}),
      },
      select: conversationSelect,
    });
  }

  /** Trae de Meta las plantillas de la cuenta (las crea y aprueba Meta, en el administrador de WhatsApp). */
  async syncTemplates(userId: string, companyId: string) {
    await this.access(userId, companyId, 'admin');
    const account = await this.account(companyId);
    let list;
    try {
      list = await this.client.templates(account);
    } catch (error) {
      throw new ServiceUnavailableException(`No se pudieron traer las plantillas de Meta: ${(error as Error).message}`);
    }
    const now = new Date();
    await this.prisma.$transaction([
      ...list.map((t) => {
        const params = new Set([...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
        const data = { category: t.category.slice(0, 20), status: t.status.slice(0, 20), body: t.body, params, syncedAt: now };
        return this.prisma.whatsappTemplate.upsert({
          where: { companyId_name_language: { companyId, name: t.name, language: t.language } },
          create: { companyId, name: t.name, language: t.language, ...data },
          update: data,
        });
      }),
      this.prisma.whatsappTemplate.deleteMany({ where: { companyId, syncedAt: { lt: now } } }),
    ]);
    return { count: list.length };
  }

  // ───────── avisos de Meta ─────────

  verifySubscription(mode?: string, token?: string, challenge?: string) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected && challenge) return challenge;
    return null;
  }

  /** La firma `X-Hub-Signature-256` de Meta. Sin `WHATSAPP_APP_SECRET` solo se acepta fuera de producción. */
  validSignature(raw: Buffer | undefined, signature?: string) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) return this.config.get<string>('NODE_ENV') !== 'production';
    if (!raw || !signature?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'), 'hex');
    const given = Buffer.from(signature.slice(7), 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async handleEvent(payload: { entry?: { changes?: { value?: InboundValue }[] }[] }) {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.value) await this.handleValue(change.value).catch((e) => this.logger.error(`Aviso de WhatsApp: ${(e as Error).message}`));
      }
    }
  }

  private async handleValue(value: InboundValue) {
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) return;
    const account = await this.prisma.whatsappAccount.findUnique({ where: { phoneNumberId }, select: { companyId: true } });
    if (!account) return;
    const companyId = account.companyId;

    for (const s of value.statuses ?? []) {
      const status = ['sent', 'delivered', 'read', 'failed'].includes(s.status) ? s.status : null;
      if (!status) continue;
      const error = status === 'failed' ? (s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? 'No se entregó').slice(0, 300) : undefined;
      // No se "devuelve" un estado: leído no pasa a entregado si los avisos llegan en desorden.
      const order = ['sent', 'delivered', 'read'];
      const allowed = status === 'failed' ? ['sent', 'delivered', 'read', 'failed'] : order.slice(0, order.indexOf(status));
      await this.prisma.whatsappMessage.updateMany({
        where: { waMessageId: s.id, direction: 'out', status: { in: allowed } },
        data: { status, ...(error ? { error } : {}) },
      });
    }

    for (const m of value.messages ?? []) {
      const waId = m.from.replace(/\D/g, '');
      if (!waId) continue;
      if (await this.prisma.whatsappMessage.findUnique({ where: { waMessageId: m.id }, select: { id: true } })) continue;
      const profile = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name?.slice(0, 150);
      const at = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
      const existing = await this.prisma.whatsappConversation.findUnique({
        where: { companyId_waId: { companyId, waId } },
        select: { id: true, contactId: true, assignedMemberId: true },
      });
      const conversation = existing
        ? await this.prisma.whatsappConversation.update({
            where: { id: existing.id },
            data: { lastMessageAt: at, lastInboundAt: at, unread: { increment: 1 }, status: 'open', ...(profile ? { name: profile } : {}) },
            select: { id: true, contactId: true, assignedMemberId: true, name: true },
          })
        : await this.prisma.whatsappConversation.create({
            data: { companyId, waId, name: profile || `+${waId}`, lastMessageAt: at, lastInboundAt: at, unread: 1 },
            select: { id: true, contactId: true, assignedMemberId: true, name: true },
          });
      const body = bodyOf(m);
      await this.prisma.whatsappMessage.create({
        data: { conversationId: conversation.id, direction: 'in', waMessageId: m.id, type: typeOf(m.type), body, status: 'received', createdAt: at },
      });
      if (!conversation.contactId) await this.linkContact(companyId, conversation.id, waId, profile);
      const to = conversation.assignedMemberId ? [conversation.assignedMemberId] : await this.alerts.membersAbove(companyId, 'supervisor');
      await this.alerts.notify(companyId, to, {
        kind: 'whatsapp',
        title: `WhatsApp de ${conversation.name}`,
        body: body.slice(0, 200),
        href: `/empresa/${companyId}/whatsapp/${conversation.id}`,
        // Un aviso por conversación por hora, aunque escriba muchos mensajes seguidos.
        dedupeKey: `wa:${conversation.id}:${Math.floor(Date.now() / 3_600_000)}`,
      });
    }
  }

  /** Busca al cliente en el CRM por los últimos 10 dígitos del celular; si no está y la empresa tiene CRM, lo crea. */
  private async linkContact(companyId: string, conversationId: string, waId: string, name?: string) {
    const ten = lastTen(waId);
    const candidates = await this.prisma.crmContact.findMany({
      where: { companyId, phone: { not: null } },
      select: { id: true, phone: true },
      take: 5000,
    });
    let contactId = candidates.find((c) => lastTen(c.phone!) === ten)?.id;
    if (!contactId) {
      const crm = await this.prisma.companyModule.findUnique({ where: { companyId_key: { companyId, key: 'crm' } }, select: { key: true } });
      if (!crm) return;
      contactId = (
        await this.prisma.crmContact.create({
          data: { companyId, name: name || `+${waId}`, phone: `+${waId}`, source: 'whatsapp', stage: 'lead' },
          select: { id: true },
        })
      ).id;
    }
    await this.prisma.whatsappConversation.update({ where: { id: conversationId }, data: { contactId } });
  }
}
