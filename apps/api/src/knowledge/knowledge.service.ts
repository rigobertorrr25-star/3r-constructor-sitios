import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { atLeast } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SaveArticleDto } from './dto/knowledge.dto.js';
import { KNOWLEDGE_MODULE } from './knowledge.constants.js';

const name = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
/** Resumen en texto plano (sin las marcas de títulos y listas). */
const excerpt = (body: string, max = 200) => {
  const plain = body
    .split('\n')
    .map((l) => l.replace(/^#{1,3}\s+|^[-*•]\s+/, '').trim())
    .filter(Boolean)
    .map((l) => (/[.!?:;,…]$/.test(l) ? l : `${l}.`))
    .join(' ');
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
};
/** Minúsculas y sin tildes. */
const fold = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const listSelect = {
  id: true,
  title: true,
  body: true,
  category: true,
  audience: true,
  status: true,
  pinned: true,
  views: true,
  updatedAt: true,
} as const;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  /** Todos leen; escribir es de supervisor en adelante y el enlace público, de administradores. */
  private async access(userId: string, companyId: string, min: 'employee' | 'supervisor' | 'admin' = 'employee') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, KNOWLEDGE_MODULE);
    return me;
  }

  /** Busca sin importar mayúsculas ni tildes ("datafono" encuentra "Datáfono"). */
  private search(q?: string): Prisma.KnowledgeArticleWhereInput {
    const text = fold(q?.trim().slice(0, 100) ?? '');
    return text ? { searchText: { contains: text } } : {};
  }

  private async votes(articleIds: string[]) {
    const rows = articleIds.length
      ? await this.prisma.knowledgeVote.groupBy({ by: ['articleId', 'helpful'], where: { articleId: { in: articleIds } }, _count: { _all: true } })
      : [];
    const map = new Map<string, { helpful: number; notHelpful: number }>();
    for (const r of rows) {
      const v = map.get(r.articleId) ?? { helpful: 0, notHelpful: 0 };
      if (r.helpful) v.helpful += r._count._all;
      else v.notHelpful += r._count._all;
      map.set(r.articleId, v);
    }
    return (id: string) => map.get(id) ?? { helpful: 0, notHelpful: 0 };
  }

  private async categories(where: Prisma.KnowledgeArticleWhereInput) {
    const rows = await this.prisma.knowledgeArticle.groupBy({
      by: ['category'],
      where: { ...where, category: { not: null } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ name: r.category!, count: r._count._all })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async list(userId: string, companyId: string, q?: string, category?: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'supervisor');
    const visible: Prisma.KnowledgeArticleWhereInput = { companyId, ...(manage ? {} : { status: 'published' }) };
    const rows = await this.prisma.knowledgeArticle.findMany({
      where: { ...visible, ...this.search(q), ...(category ? { category } : {}) },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 300,
      select: listSelect,
    });
    const v = await this.votes(rows.map((r) => r.id));
    const company = manage ? await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { helpToken: true } }) : null;
    return {
      manage,
      canShare: atLeast(me.role, 'admin'),
      helpToken: company?.helpToken ?? null,
      categories: await this.categories(visible),
      articles: rows.map(({ body, ...a }) => ({ ...a, excerpt: excerpt(body), ...(manage ? v(a.id) : {}) })),
    };
  }

  private data(dto: SaveArticleDto) {
    return {
      title: dto.title,
      body: dto.body,
      category: dto.category || null,
      audience: dto.audience,
      status: dto.status,
      pinned: dto.pinned ?? false,
      searchText: fold(`${dto.title}\n${dto.category ?? ''}\n${dto.body}`),
    };
  }

  async create(userId: string, companyId: string, dto: SaveArticleDto) {
    await this.access(userId, companyId, 'supervisor');
    return this.prisma.knowledgeArticle.create({
      data: { ...this.data(dto), companyId, authorId: userId, updatedById: userId },
      select: { id: true },
    });
  }

  async update(userId: string, companyId: string, articleId: string, dto: SaveArticleDto) {
    await this.access(userId, companyId, 'supervisor');
    const { count } = await this.prisma.knowledgeArticle.updateMany({
      where: { id: articleId, companyId },
      data: { ...this.data(dto), updatedById: userId },
    });
    if (!count) throw new NotFoundException('Artículo no encontrado');
    return { id: articleId };
  }

  async remove(userId: string, companyId: string, articleId: string) {
    await this.access(userId, companyId, 'supervisor');
    const { count } = await this.prisma.knowledgeArticle.deleteMany({ where: { id: articleId, companyId } });
    if (!count) throw new NotFoundException('Artículo no encontrado');
  }

  async get(userId: string, companyId: string, articleId: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'supervisor');
    const a = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, companyId, ...(manage ? {} : { status: 'published' }) },
      select: { ...listSelect, authorId: true, updatedById: true, createdAt: true, votes: { where: { memberId: me.id }, select: { helpful: true } } },
    });
    if (!a) throw new NotFoundException('Artículo no encontrado');
    if (a.status === 'published' && a.authorId !== userId) {
      await this.prisma.knowledgeArticle.update({ where: { id: a.id }, data: { views: { increment: 1 } } });
    }
    const people = await this.prisma.user.findMany({
      where: { id: { in: [a.authorId, a.updatedById].filter((x): x is string => !!x) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const who = (id: string | null) => (id ? (people.find((p) => p.id === id) ? name(people.find((p) => p.id === id)!) : null) : null);
    const related = a.category
      ? await this.prisma.knowledgeArticle.findMany({
          where: { companyId, category: a.category, id: { not: a.id }, ...(manage ? {} : { status: 'published' }) },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, title: true },
        })
      : [];
    const { votes, authorId, updatedById, ...rest } = a;
    return {
      ...rest,
      author: who(authorId),
      updatedBy: who(updatedById),
      myVote: votes[0]?.helpful ?? null,
      related,
      manage,
      ...(manage ? (await this.votes([a.id]))(a.id) : {}),
    };
  }

  async vote(userId: string, companyId: string, articleId: string, helpful: boolean) {
    const me = await this.access(userId, companyId);
    const a = await this.prisma.knowledgeArticle.findFirst({ where: { id: articleId, companyId, status: 'published' }, select: { id: true } });
    if (!a) throw new NotFoundException('Artículo no encontrado');
    await this.prisma.knowledgeVote.upsert({
      where: { articleId_memberId: { articleId: a.id, memberId: me.id } },
      create: { articleId: a.id, memberId: me.id, helpful },
      update: { helpful },
    });
    return { ok: true };
  }

  /** Prender (o renovar) el enlace público del centro de ayuda. */
  async enablePublic(userId: string, companyId: string) {
    await this.access(userId, companyId, 'admin');
    const helpToken = randomBytes(12).toString('base64url');
    await this.prisma.company.update({ where: { id: companyId }, data: { helpToken } });
    return { helpToken };
  }

  async disablePublic(userId: string, companyId: string) {
    await this.access(userId, companyId, 'admin');
    await this.prisma.company.update({ where: { id: companyId }, data: { helpToken: null } });
  }

  // ───────── centro de ayuda público ─────────

  private async byToken(token: string) {
    if (!TOKEN.test(token)) throw new NotFoundException('Página no encontrada');
    const c = await this.prisma.company.findUnique({
      where: { helpToken: token },
      select: { id: true, name: true, status: true, phone: true, modules: { where: { key: KNOWLEDGE_MODULE }, select: { key: true } } },
    });
    if (!c || c.status !== 'active' || !c.modules.length) throw new NotFoundException('Página no encontrada');
    return c;
  }

  async publicList(token: string, q?: string, category?: string) {
    const c = await this.byToken(token);
    const visible: Prisma.KnowledgeArticleWhereInput = { companyId: c.id, status: 'published', audience: 'public' };
    const rows = await this.prisma.knowledgeArticle.findMany({
      where: { ...visible, ...this.search(q), ...(category ? { category } : {}) },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 300,
      select: { id: true, title: true, body: true, category: true, pinned: true, updatedAt: true },
    });
    return {
      company: { name: c.name, phone: c.phone },
      categories: await this.categories(visible),
      articles: rows.map(({ body, ...a }) => ({ ...a, excerpt: excerpt(body) })),
    };
  }

  private async publicArticle(token: string, articleId: string) {
    const c = await this.byToken(token);
    if (!/^[0-9a-f-]{36}$/i.test(articleId)) throw new NotFoundException('Artículo no encontrado');
    const a = await this.prisma.knowledgeArticle.findFirst({
      where: { id: articleId, companyId: c.id, status: 'published', audience: 'public' },
      select: { id: true, title: true, body: true, category: true, updatedAt: true },
    });
    if (!a) throw new NotFoundException('Artículo no encontrado');
    return { c, a };
  }

  async publicGet(token: string, articleId: string) {
    const { c, a } = await this.publicArticle(token, articleId);
    await this.prisma.knowledgeArticle.update({ where: { id: a.id }, data: { views: { increment: 1 } } });
    const related = a.category
      ? await this.prisma.knowledgeArticle.findMany({
          where: { companyId: c.id, status: 'published', audience: 'public', category: a.category, id: { not: a.id } },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, title: true },
        })
      : [];
    return { company: { name: c.name, phone: c.phone }, ...a, related };
  }

  async publicVote(token: string, articleId: string, helpful: boolean) {
    const { a } = await this.publicArticle(token, articleId);
    await this.prisma.knowledgeVote.create({ data: { articleId: a.id, helpful } });
    return { ok: true };
  }
}
