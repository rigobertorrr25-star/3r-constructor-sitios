import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { renderCertificate } from './certificate-pdf.js';
import type { QuizDto, SaveCourseDto } from './dto/training.dto.js';
import { TRAINING_MODULE } from './training.constants.js';

type Min = 'employee' | 'supervisor' | 'hr';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const name = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const todayBogota = () => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())}T00:00:00Z`);
const longDate = (d: Date) => {
  const local = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)}T00:00:00Z`);
  return `${local.getUTCDate()} de ${MONTHS[local.getUTCMonth()]} de ${local.getUTCFullYear()}`;
};
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 50);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const courseSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  required: true,
  dueAt: true,
  passScore: true,
  publishedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  lessons: { orderBy: { position: 'asc' }, select: { id: true, position: true, title: true, videoUrl: true } },
  questions: { orderBy: { position: 'asc' }, select: { id: true, position: true, text: true, options: true, correct: true } },
} as const satisfies Prisma.CourseSelect;
type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;
type ProgressRow = { lessonsDone: unknown; attempts: number; score: number | null; completedAt: Date | null; startedAt: Date };

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly alerts: AlertsService,
  ) {}

  /** Todos toman cursos; ver el avance del equipo es de supervisor y crear o editar, de RR. HH. en adelante. */
  private async access(userId: string, companyId: string, min: Min = 'employee') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, TRAINING_MODULE);
    return me;
  }

  /** Avance contado sobre las lecciones que el curso tiene hoy. */
  private mine(c: { lessons: { id: string }[] }, p: ProgressRow | null | undefined) {
    if (!p) return null;
    const done = new Set(ids(p.lessonsDone));
    return {
      done: c.lessons.filter((l) => done.has(l.id)).length,
      lessonsDone: c.lessons.filter((l) => done.has(l.id)).map((l) => l.id),
      attempts: p.attempts,
      score: p.score,
      completedAt: p.completedAt,
      startedAt: p.startedAt,
    };
  }

  private overdue(c: { dueAt: Date | null }, completed: boolean) {
    return !!c.dueAt && !completed && c.dueAt < todayBogota();
  }

  private visibleTo(memberId: string): Prisma.CourseWhereInput {
    // El equipo ve los publicados y los archivados que ya terminó (por su certificado).
    return { OR: [{ status: 'published' }, { status: 'archived', progress: { some: { memberId, completedAt: { not: null } } } }] };
  }

  async list(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'hr');
    const seeTeam = atLeast(me.role, 'supervisor');
    const rows = await this.prisma.course.findMany({
      where: { companyId, ...(manage ? {} : this.visibleTo(me.id)) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      select: {
        ...courseSelect,
        progress: { where: { memberId: me.id }, select: { lessonsDone: true, attempts: true, score: true, completedAt: true, startedAt: true } },
      },
    });
    let members = 0;
    const completed = new Map<string, number>();
    const started = new Map<string, number>();
    if (seeTeam && rows.length) {
      members = await this.prisma.companyMember.count({ where: { companyId, status: 'active' } });
      const grouped = await this.prisma.courseProgress.findMany({
        where: { courseId: { in: rows.map((r) => r.id) }, member: { status: 'active' } },
        select: { courseId: true, completedAt: true },
      });
      for (const g of grouped) {
        started.set(g.courseId, (started.get(g.courseId) ?? 0) + 1);
        if (g.completedAt) completed.set(g.courseId, (completed.get(g.courseId) ?? 0) + 1);
      }
    }
    return {
      manage,
      seeTeam,
      courses: rows.map(({ progress, lessons, questions, createdById, ...c }) => {
        const m = this.mine({ lessons }, progress[0]);
        return {
          ...c,
          lessons: lessons.length,
          questions: questions.length,
          mine: m,
          overdue: c.status === 'published' && c.required && this.overdue(c, !!m?.completedAt),
          stats: seeTeam && c.status !== 'draft' ? { members, started: started.get(c.id) ?? 0, completed: completed.get(c.id) ?? 0 } : undefined,
        };
      }),
    };
  }

  /** Para el tablero: los obligatorios que me faltan. */
  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const pending = await this.prisma.course.findMany({
      where: { companyId, status: 'published', required: true, progress: { none: { memberId: me.id, completedAt: { not: null } } } },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'asc' }],
      select: { id: true, title: true, dueAt: true },
    });
    return { pending: pending.length, courses: pending.map((c) => ({ ...c, overdue: this.overdue(c, false) })) };
  }

  /** Limpia lecciones y preguntas; cada pregunta necesita opciones distintas y una correcta. */
  private clean(dto: SaveCourseDto) {
    const questions = (dto.questions ?? []).map((q, position) => {
      const options = q.options.map((o) => o.trim());
      if (options.some((o) => !o) || new Set(options).size !== options.length)
        throw new BadRequestException(`La pregunta «${q.text}» tiene opciones vacías o repetidas`);
      if (q.correct >= options.length) throw new BadRequestException(`Marca la respuesta correcta de «${q.text}»`);
      return { position, text: q.text, options, correct: q.correct };
    });
    return {
      data: {
        title: dto.title,
        description: dto.description || null,
        required: dto.required ?? false,
        dueAt: dto.dueAt ? new Date(`${dto.dueAt.slice(0, 10)}T00:00:00Z`) : null,
        passScore: dto.passScore ?? 70,
      },
      lessons: dto.lessons.map((l, position) => ({ id: l.id, position, title: l.title, body: l.body, videoUrl: l.videoUrl || null })),
      questions,
    };
  }

  async create(userId: string, companyId: string, dto: SaveCourseDto) {
    await this.access(userId, companyId, 'hr');
    const { data, lessons, questions } = this.clean(dto);
    return this.prisma.course.create({
      data: {
        ...data,
        companyId,
        createdById: userId,
        lessons: { create: lessons.map(({ id: _id, ...l }) => l) },
        questions: { create: questions },
      },
      select: { id: true },
    });
  }

  private async find(companyId: string, courseId: string) {
    const c = await this.prisma.course.findFirst({ where: { id: courseId, companyId }, select: courseSelect });
    if (!c) throw new NotFoundException('Curso no encontrado');
    return c;
  }

  async update(userId: string, companyId: string, courseId: string, dto: SaveCourseDto) {
    await this.access(userId, companyId, 'hr');
    const c = await this.find(companyId, courseId);
    const { data, lessons, questions } = this.clean(dto);
    const existing = new Set(c.lessons.map((l) => l.id));
    const keep = lessons.filter((l) => l.id && existing.has(l.id));
    // Las lecciones que siguen conservan su id: quien ya las vio no pierde el avance.
    await this.prisma.$transaction([
      this.prisma.courseLesson.deleteMany({ where: { courseId, id: { notIn: keep.map((l) => l.id!) } } }),
      ...keep.map(({ id, ...l }) => this.prisma.courseLesson.update({ where: { id }, data: l })),
      this.prisma.courseLesson.createMany({
        data: lessons.filter((l) => !l.id || !existing.has(l.id)).map(({ id: _id, ...l }) => ({ ...l, courseId })),
      }),
      this.prisma.courseQuestion.deleteMany({ where: { courseId } }),
      this.prisma.courseQuestion.createMany({ data: questions.map((q) => ({ ...q, courseId })) }),
      this.prisma.course.update({ where: { id: courseId }, data }),
    ]);
    return { id: courseId };
  }

  /** Publicarlo: la primera vez le avisa a todo el equipo. */
  async publish(userId: string, companyId: string, courseId: string) {
    const me = await this.access(userId, companyId, 'hr');
    const c = await this.find(companyId, courseId);
    await this.prisma.course.update({ where: { id: c.id }, data: { status: 'published', publishedAt: c.publishedAt ?? new Date() } });
    if (!c.publishedAt) {
      const team = await this.prisma.companyMember.findMany({ where: { companyId, status: 'active', id: { not: me.id } }, select: { id: true } });
      await this.alerts.notify(
        companyId,
        team.map((m) => m.id),
        {
          kind: 'training',
          title: `${c.required ? 'Curso obligatorio' : 'Curso nuevo'}: ${c.title}`,
          body: c.dueAt ? `Termínalo antes del ${longDate(c.dueAt)}.` : `${c.lessons.length} ${c.lessons.length === 1 ? 'lección' : 'lecciones'}.`,
          href: `capacitaciones/${c.id}`,
          dedupeKey: `course:${c.id}`,
        },
      );
    }
    return { ok: true };
  }

  async archive(userId: string, companyId: string, courseId: string) {
    await this.access(userId, companyId, 'hr');
    const c = await this.find(companyId, courseId);
    await this.prisma.course.update({ where: { id: c.id }, data: { status: 'archived' } });
    return { ok: true };
  }

  async remove(userId: string, companyId: string, courseId: string) {
    await this.access(userId, companyId, 'hr');
    const { count } = await this.prisma.course.deleteMany({ where: { id: courseId, companyId } });
    if (!count) throw new NotFoundException('Curso no encontrado');
  }

  /** El curso con sus lecciones (y, para quien lo toma, sin las respuestas correctas). */
  async get(userId: string, companyId: string, courseId: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'hr');
    const c = await this.prisma.course.findFirst({
      where: { id: courseId, companyId, ...(manage ? {} : this.visibleTo(me.id)) },
      select: {
        ...courseSelect,
        lessons: { orderBy: { position: 'asc' }, select: { id: true, position: true, title: true, videoUrl: true, body: true } },
        progress: { where: { memberId: me.id }, select: { lessonsDone: true, attempts: true, score: true, completedAt: true, startedAt: true } },
      },
    });
    if (!c) throw new NotFoundException('Curso no encontrado');
    const { progress, createdById, questions, ...rest } = c;
    const mine = this.mine(c, progress[0]);
    return {
      ...rest,
      questions: questions.map((q) => (manage ? q : { id: q.id, position: q.position, text: q.text, options: q.options })),
      mine,
      overdue: c.status === 'published' && c.required && this.overdue(c, !!mine?.completedAt),
      can: { manage, seeTeam: atLeast(me.role, 'supervisor') },
    };
  }

  private async published(companyId: string, courseId: string) {
    const c = await this.find(companyId, courseId);
    if (c.status !== 'published') throw new BadRequestException('Este curso no está disponible');
    return c;
  }

  private async finish(companyId: string, c: CourseRow, userId: string) {
    // Aviso a quien creó el curso, si sigue en la empresa (y no es quien lo terminó).
    if (!c.createdById || c.createdById === userId) return;
    const memberName = name(
      await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
    );
    const author = await this.prisma.companyMember.findFirst({ where: { companyId, userId: c.createdById, status: 'active' }, select: { id: true } });
    if (author) {
      await this.alerts.notify(companyId, [author.id], {
        kind: 'training',
        title: `${memberName} terminó «${c.title}»`,
        href: `capacitaciones/${c.id}/equipo`,
      });
    }
  }

  /** Marca una lección como vista. Sin quiz, ver la última termina el curso. */
  async lessonDone(userId: string, companyId: string, courseId: string, lessonId: string) {
    const me = await this.access(userId, companyId);
    const c = await this.published(companyId, courseId);
    if (!c.lessons.some((l) => l.id === lessonId)) throw new NotFoundException('Lección no encontrada');
    const prev = await this.prisma.courseProgress.findUnique({ where: { courseId_memberId: { courseId, memberId: me.id } } });
    const done = [...new Set([...ids(prev?.lessonsDone), lessonId])];
    const all = c.lessons.every((l) => done.includes(l.id));
    const completes = all && c.questions.length === 0 && !prev?.completedAt;
    const p = await this.prisma.courseProgress.upsert({
      where: { courseId_memberId: { courseId, memberId: me.id } },
      create: { courseId, memberId: me.id, lessonsDone: done, completedAt: completes ? new Date() : null },
      update: { lessonsDone: done, ...(completes ? { completedAt: new Date() } : {}) },
    });
    if (completes) await this.finish(companyId, c, userId);
    return this.mine(c, p);
  }

  /** Califica el quiz. Se puede repetir; queda el mejor puntaje. */
  async quiz(userId: string, companyId: string, courseId: string, dto: QuizDto) {
    const me = await this.access(userId, companyId);
    const c = await this.published(companyId, courseId);
    if (!c.questions.length) throw new BadRequestException('Este curso no tiene evaluación');
    const prev = await this.prisma.courseProgress.findUnique({ where: { courseId_memberId: { courseId, memberId: me.id } } });
    const done = new Set(ids(prev?.lessonsDone));
    if (!prev || !c.lessons.every((l) => done.has(l.id))) throw new BadRequestException('Primero ve todas las lecciones');
    const wrong: string[] = [];
    for (const q of c.questions) {
      const v = dto.answers?.[q.id];
      if (v === undefined || v === null || v === '') throw new BadRequestException(`Responde: «${q.text}»`);
      if (Number(v) !== q.correct) wrong.push(q.id);
    }
    const score = Math.round(((c.questions.length - wrong.length) / c.questions.length) * 100);
    const passed = score >= c.passScore;
    const completes = passed && !prev.completedAt;
    const p = await this.prisma.courseProgress.update({
      where: { id: prev.id },
      data: { attempts: { increment: 1 }, score: Math.max(score, prev.score ?? 0), ...(completes ? { completedAt: new Date() } : {}) },
    });
    if (completes) await this.finish(companyId, c, userId);
    return { score, passed, passScore: c.passScore, wrong, mine: this.mine(c, p) };
  }

  /** Avance de cada persona del equipo en un curso. */
  async team(userId: string, companyId: string, courseId: string) {
    await this.access(userId, companyId, 'supervisor');
    const c = await this.find(companyId, courseId);
    const members = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        jobTitle: true,
        area: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        courseProgress: { where: { courseId: c.id }, select: { lessonsDone: true, attempts: true, score: true, completedAt: true, startedAt: true } },
      },
    });
    const order = { completed: 2, in_progress: 1, pending: 0 } as const;
    const people = members
      .map((m) => {
        const mine = this.mine(c, m.courseProgress[0]);
        const status = mine?.completedAt ? 'completed' : mine ? 'in_progress' : 'pending';
        return {
          memberId: m.id,
          name: name(m.user),
          jobTitle: m.jobTitle,
          area: m.area,
          status,
          done: mine?.done ?? 0,
          attempts: mine?.attempts ?? 0,
          score: mine?.score ?? null,
          completedAt: mine?.completedAt ?? null,
          overdue: c.required && c.status === 'published' && this.overdue(c, status === 'completed'),
        };
      })
      .sort((a, b) => order[a.status as keyof typeof order] - order[b.status as keyof typeof order] || a.name.localeCompare(b.name, 'es'));
    const { createdById, questions, ...course } = c;
    return { course: { ...course, lessons: c.lessons.length, questions: questions.length }, people };
  }

  /** Certificado en PDF: el propio, o el de alguien del equipo (supervisor en adelante). */
  async certificate(userId: string, companyId: string, courseId: string, memberId?: string) {
    const me = await this.access(userId, companyId);
    const target = memberId && memberId !== me.id ? memberId : me.id;
    if (target !== me.id && !atLeast(me.role, 'supervisor')) throw new NotFoundException('Certificado no encontrado');
    const p = await this.prisma.courseProgress.findFirst({
      where: { courseId, memberId: target, completedAt: { not: null }, course: { companyId } },
      select: {
        id: true,
        score: true,
        completedAt: true,
        member: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        course: { select: { title: true, _count: { select: { lessons: true, questions: true } }, company: { select: { name: true } } } },
      },
    });
    if (!p) throw new NotFoundException('Certificado no encontrado');
    const person = name(p.member.user);
    const pdf = await renderCertificate({
      companyName: p.course.company.name,
      personName: person,
      courseTitle: p.course.title,
      lessons: p.course._count.lessons,
      score: p.course._count.questions ? p.score : null,
      dateText: longDate(p.completedAt!),
      code: p.id.slice(0, 8).toUpperCase(),
    });
    return { pdf: Buffer.from(pdf), fileName: `certificado-${slug(p.course.title)}-${slug(person)}.pdf` };
  }
}
