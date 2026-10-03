import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnswerDto, SaveSurveyDto } from './dto/surveys.dto.js';
import { SURVEYS_MODULE } from './surveys.constants.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;
type Question = { id: string; position: number; kind: string; text: string; options: unknown; required: boolean };

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const questionSelect = { id: true, position: true, kind: true, text: true, options: true, required: true } as const;
const surveySelect = {
  id: true,
  title: true,
  description: true,
  audience: true,
  anonymous: true,
  status: true,
  closesAt: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
  questions: { orderBy: { position: 'asc' }, select: questionSelect },
  _count: { select: { responses: true } },
} as const satisfies Prisma.SurveySelect;

const opts = (q: Question) => (Array.isArray(q.options) ? (q.options as string[]) : []);
/** Abierta y sin pasar la fecha de cierre. */
const isOpen = (s: { status: string; closesAt: Date | null }) => s.status === 'open' && (!s.closesAt || s.closesAt > new Date());

@Injectable()
export class SurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly alerts: AlertsService,
  ) {}

  /** Todos responden; crear, abrir, cerrar y ver resultados es de supervisor en adelante. */
  private async access(userId: string, companyId: string, min: 'employee' | 'supervisor' = 'employee') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, SURVEYS_MODULE);
    return me;
  }

  private respondentKey(surveyId: string, memberId: string) {
    return sha256(`survey:${surveyId}:member:${memberId}`);
  }

  /** Limpia las preguntas: las de opciones necesitan al menos 2 opciones distintas. */
  private questions(dto: SaveSurveyDto) {
    return dto.questions.map((q, position) => {
      const options = [...new Set((q.options ?? []).map((o) => o.trim()).filter(Boolean))];
      if ((q.kind === 'choice' || q.kind === 'multi') && options.length < 2) throw new BadRequestException(`La pregunta «${q.text}» necesita al menos 2 opciones`);
      return { position, kind: q.kind, text: q.text, options: q.kind === 'choice' || q.kind === 'multi' ? options : undefined, required: q.required ?? true };
    });
  }

  private shape(s: Prisma.SurveyGetPayload<{ select: typeof surveySelect }>) {
    const { _count, ...rest } = s;
    return { ...rest, responses: _count.responses, open: isOpen(s) };
  }

  async list(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'supervisor');
    const rows = await this.prisma.survey.findMany({
      where: { companyId, ...(manage ? {} : { audience: 'team', status: { in: ['open', 'closed'] } }) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: surveySelect,
    });
    // ¿Ya respondí? (las del equipo).
    const keys = rows.filter((s) => s.audience === 'team').map((s) => this.respondentKey(s.id, me.id));
    const answered = new Set(
      (await this.prisma.surveyResponse.findMany({ where: { respondentKey: { in: keys } }, select: { surveyId: true } })).map((r) => r.surveyId),
    );
    return { manage, surveys: rows.map((s) => ({ ...this.shape(s), answered: answered.has(s.id), publicToken: manage ? s.publicToken : null })) };
  }

  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const open = await this.prisma.survey.findMany({
      where: { companyId, audience: 'team', status: 'open', OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
      select: { id: true, title: true },
    });
    const done = new Set(
      (await this.prisma.surveyResponse.findMany({ where: { respondentKey: { in: open.map((s) => this.respondentKey(s.id, me.id)) } }, select: { surveyId: true } })).map(
        (r) => r.surveyId,
      ),
    );
    const pending = open.filter((s) => !done.has(s.id));
    return { pendingToAnswer: pending.length, pending };
  }

  async create(userId: string, companyId: string, dto: SaveSurveyDto) {
    await this.access(userId, companyId, 'supervisor');
    const s = await this.prisma.survey.create({
      data: {
        companyId,
        title: dto.title,
        description: dto.description || null,
        audience: dto.audience,
        anonymous: dto.audience === 'team' ? (dto.anonymous ?? false) : false,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
        createdById: userId,
        questions: { create: this.questions(dto) },
      },
      select: surveySelect,
    });
    return this.shape(s);
  }

  private async find(companyId: string, surveyId: string) {
    const s = await this.prisma.survey.findFirst({ where: { id: surveyId, companyId }, select: surveySelect });
    if (!s) throw new NotFoundException('Encuesta no encontrada');
    return s;
  }

  async update(userId: string, companyId: string, surveyId: string, dto: SaveSurveyDto) {
    await this.access(userId, companyId, 'supervisor');
    const s = await this.find(companyId, surveyId);
    // Con respuestas ya no se cambian las preguntas (los resultados dejarían de cuadrar).
    if (s._count.responses > 0) throw new BadRequestException('Esta encuesta ya tiene respuestas: no se pueden cambiar las preguntas. Crea una nueva.');
    const [, updated] = await this.prisma.$transaction([
      this.prisma.surveyQuestion.deleteMany({ where: { surveyId } }),
      this.prisma.survey.update({
        where: { id: surveyId },
        data: {
          title: dto.title,
          description: dto.description || null,
          audience: dto.audience,
          anonymous: dto.audience === 'team' ? (dto.anonymous ?? false) : false,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
          questions: { create: this.questions(dto) },
        },
        select: surveySelect,
      }),
    ]);
    return this.shape(updated);
  }

  /** Abrirla: las del equipo avisan a todos; las de clientes generan su enlace. */
  async open(userId: string, companyId: string, surveyId: string) {
    const me = await this.access(userId, companyId, 'supervisor');
    const s = await this.find(companyId, surveyId);
    if (s.closesAt && s.closesAt <= new Date()) throw new BadRequestException('La fecha de cierre ya pasó. Cámbiala para abrirla.');
    const updated = await this.prisma.survey.update({
      where: { id: s.id },
      data: { status: 'open', publicToken: s.audience === 'public' ? (s.publicToken ?? randomBytes(18).toString('base64url')) : null },
      select: surveySelect,
    });
    if (s.audience === 'team' && s.status === 'draft') {
      const team = await this.prisma.companyMember.findMany({ where: { companyId, status: 'active', id: { not: me.id } }, select: { id: true } });
      await this.alerts.notify(
        companyId,
        team.map((m) => m.id),
        {
          kind: 'survey',
          title: `Nueva encuesta: ${s.title}`,
          body: s.anonymous ? 'Es anónima: nadie sabrá qué respondiste.' : null,
          href: `encuestas/${s.id}`,
          dedupeKey: `survey:${s.id}`,
        },
      );
    }
    return this.shape(updated);
  }

  async close(userId: string, companyId: string, surveyId: string) {
    await this.access(userId, companyId, 'supervisor');
    const s = await this.find(companyId, surveyId);
    return this.shape(await this.prisma.survey.update({ where: { id: s.id }, data: { status: 'closed' }, select: surveySelect }));
  }

  async remove(userId: string, companyId: string, surveyId: string) {
    await this.access(userId, companyId, 'supervisor');
    const { count } = await this.prisma.survey.deleteMany({ where: { id: surveyId, companyId } });
    if (!count) throw new NotFoundException('Encuesta no encontrada');
  }

  /** Para responder (o, para quien gestiona, también para editar). */
  async get(userId: string, companyId: string, surveyId: string) {
    const me = await this.access(userId, companyId);
    const s = await this.find(companyId, surveyId);
    const manage = atLeast(me.role, 'supervisor');
    if (!manage && (s.audience !== 'team' || s.status === 'draft')) throw new NotFoundException('Encuesta no encontrada');
    const answered = s.audience === 'team' ? !!(await this.prisma.surveyResponse.findUnique({ where: { surveyId_respondentKey: { surveyId: s.id, respondentKey: this.respondentKey(s.id, me.id) } }, select: { id: true } })) : false;
    return { ...this.shape(s), answered, manage, publicToken: manage ? s.publicToken : null };
  }

  /** Revisa las respuestas contra las preguntas; devuelve solo lo válido. */
  private validate(questions: Question[], raw: Record<string, unknown>) {
    const clean: Record<string, number | string | string[]> = {};
    for (const q of questions) {
      const v = raw[q.id];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) {
        if (q.required) throw new BadRequestException(`Responde: «${q.text}»`);
        continue;
      }
      const bad = () => new BadRequestException(`Respuesta no válida en «${q.text}»`);
      if (q.kind === 'rating' || q.kind === 'nps') {
        const n = Number(v);
        const [min, max] = q.kind === 'rating' ? [1, 5] : [0, 10];
        if (!Number.isInteger(n) || n < min || n > max) throw bad();
        clean[q.id] = n;
      } else if (q.kind === 'choice') {
        if (typeof v !== 'string' || !opts(q).includes(v)) throw bad();
        clean[q.id] = v;
      } else if (q.kind === 'multi') {
        const list = Array.isArray(v) ? v : [v];
        if (!list.every((x) => typeof x === 'string' && opts(q).includes(x))) throw bad();
        clean[q.id] = [...new Set(list as string[])];
      } else {
        if (typeof v !== 'string') throw bad();
        clean[q.id] = v.trim().slice(0, 2000);
        if (!clean[q.id] && q.required) throw new BadRequestException(`Responde: «${q.text}»`);
      }
    }
    return clean;
  }

  async answer(userId: string, companyId: string, surveyId: string, dto: AnswerDto) {
    const me = await this.access(userId, companyId);
    const s = await this.find(companyId, surveyId);
    if (s.audience !== 'team') throw new NotFoundException('Encuesta no encontrada');
    if (!isOpen(s)) throw new BadRequestException('Esta encuesta ya está cerrada');
    const answers = this.validate(s.questions, dto.answers ?? {});
    try {
      await this.prisma.surveyResponse.create({
        data: { surveyId: s.id, memberId: s.anonymous ? null : me.id, respondentKey: this.respondentKey(s.id, me.id), answers },
      });
    } catch {
      throw new BadRequestException('Ya respondiste esta encuesta');
    }
    return { ok: true };
  }

  // ───────── resultados ─────────

  async results(userId: string, companyId: string, surveyId: string) {
    await this.access(userId, companyId, 'supervisor');
    const s = await this.find(companyId, surveyId);
    const responses = await this.prisma.surveyResponse.findMany({
      where: { surveyId: s.id },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: { answers: true, memberId: true, name: true, createdAt: true },
    });
    const rows = responses.map((r) => r.answers as Record<string, unknown>);
    const questions = s.questions.map((q) => {
      const values = rows.map((a) => a[q.id]).filter((v) => v !== undefined);
      if (q.kind === 'rating' || q.kind === 'nps') {
        const nums = values.map(Number);
        const max = q.kind === 'rating' ? 5 : 10;
        const min = q.kind === 'rating' ? 1 : 0;
        const distribution = Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, count: nums.filter((n) => n === min + i).length }));
        const average = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
        // NPS: % promotores (9–10) − % detractores (0–6).
        const nps = q.kind === 'nps' && nums.length ? Math.round(((nums.filter((n) => n >= 9).length - nums.filter((n) => n <= 6).length) / nums.length) * 100) : undefined;
        return { ...q, answers: nums.length, average, distribution, nps };
      }
      if (q.kind === 'choice' || q.kind === 'multi') {
        const flat = values.flatMap((v) => (Array.isArray(v) ? v : [v])) as string[];
        return { ...q, answers: values.length, counts: opts(q).map((o) => ({ option: o, count: flat.filter((x) => x === o).length })) };
      }
      return { ...q, answers: values.length, texts: (values as string[]).filter(Boolean).slice(0, 200) };
    });
    let participation: { members: number; responded: number; pending?: string[] } | undefined;
    if (s.audience === 'team') {
      const members = await this.prisma.companyMember.findMany({
        where: { companyId, status: 'active' },
        select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
      });
      participation = { members: members.length, responded: responses.length };
      // Quién falta solo si no es anónima.
      if (!s.anonymous) {
        const done = new Set(responses.map((r) => r.memberId));
        participation.pending = members.filter((m) => !done.has(m.id)).map((m) => name(m.user));
      }
    }
    return { survey: this.shape(s), total: responses.length, questions, participation };
  }

  // ───────── enlace público (clientes) ─────────

  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new NotFoundException('Encuesta no encontrada');
    const s = await this.prisma.survey.findUnique({
      where: { publicToken: token },
      select: { ...surveySelect, company: { select: { name: true, status: true } } },
    });
    if (!s || s.audience !== 'public' || s.status === 'draft' || s.company.status !== 'active') throw new NotFoundException('Encuesta no encontrada');
    return s;
  }

  async publicView(token: string) {
    const s = await this.byToken(token);
    return { title: s.title, description: s.description, company: s.company.name, open: isOpen(s), questions: s.questions };
  }

  async publicAnswer(token: string, dto: AnswerDto) {
    const s = await this.byToken(token);
    if (!isOpen(s)) throw new BadRequestException('Esta encuesta ya está cerrada. ¡Gracias de todas formas!');
    const answers = this.validate(s.questions, dto.answers ?? {});
    await this.prisma.surveyResponse.create({ data: { surveyId: s.id, name: dto.name || null, answers } });
    return { ok: true };
  }

}
