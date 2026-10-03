import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { AuditService } from '../audit/audit.service.js';
import { roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import { DOCUMENT_STORAGE, type DocumentStorage } from '../documents/document-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CONTRACT_PHRASE, DOCUMENT_LABEL, DOC_GENERATOR_MODULE, TEMPLATE_LABEL } from './doc-generator.constants.js';
import type { GenerateDocumentDto } from './dto/doc-generator.dto.js';
import { renderLetter } from './pdf.js';
import { pesosText } from './spanish-number.js';

type Member = Awaited<ReturnType<CompaniesService['requireMember']>>;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Date (UTC, solo fecha) → "15 de octubre de 2025". */
const longDate = (d: Date) => `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const todayBogota = () => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())}T00:00:00Z`);
const name = (u: { firstName: string | null; lastName: string | null; email: string }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);

@Injectable()
export class DocGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly audit: AuditService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly alerts: AlertsService,
  ) {}

  /** RR. HH. en adelante genera documentos de quienes tienen menor rango (el dueño, de todos y el suyo). */
  private async access(userId: string, companyId: string) {
    const me = await this.companies.requireMember(userId, companyId, 'hr');
    await this.companies.requireModule(companyId, DOC_GENERATOR_MODULE);
    return me;
  }

  private canGenerateFor(me: Member, target: { id: string; role: string }) {
    return me.role === 'owner' || roleRank(me.role) > roleRank(target.role);
  }

  private async load(me: Member, companyId: string, memberId: string) {
    const t = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      select: {
        id: true,
        role: true,
        status: true,
        jobTitle: true,
        area: true,
        hiredAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        profile: { select: { documentType: true, documentNumber: true, contractType: true, salary: true } },
      },
    });
    if (!t || !this.canGenerateFor(me, t)) throw new NotFoundException('Esa persona no está en la empresa');
    return t;
  }

  /** Personas para las que puedo generar, con lo que les falta para el certificado laboral. */
  async people(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const members = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        jobTitle: true,
        hiredAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        profile: { select: { documentNumber: true, salary: true } },
        leaveRequests: {
          where: { type: 'vacation', status: 'approved' },
          orderBy: { startDate: 'desc' },
          take: 10,
          select: { id: true, startDate: true, endDate: true, days: true },
        },
      },
    });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { taxId: true, city: true } });
    const signer = await this.prisma.companyMember.findUniqueOrThrow({ where: { id: me.id }, select: { jobTitle: true, user: { select: { firstName: true, lastName: true, email: true } } } });
    return {
      company: { missing: [!company.taxId ? 'NIT' : null, !company.city ? 'ciudad' : null].filter(Boolean) },
      signer: { name: name(signer.user), title: signer.jobTitle ?? '' },
      people: members
        .filter((m) => this.canGenerateFor(me, m))
        .map((m) => ({
          id: m.id,
          name: name(m.user),
          jobTitle: m.jobTitle,
          missing: [
            !m.profile?.documentNumber ? 'documento' : null,
            !m.jobTitle ? 'cargo' : null,
            !m.hiredAt ? 'fecha de ingreso' : null,
          ].filter((x): x is string => !!x),
          hasSalary: m.profile?.salary != null,
          vacations: m.leaveRequests.map((r) => ({
            id: r.id,
            startDate: r.startDate?.toISOString().slice(0, 10) ?? null,
            endDate: r.endDate?.toISOString().slice(0, 10) ?? null,
            days: r.days,
          })),
        })),
    };
  }

  async generate(userId: string, companyId: string, dto: GenerateDocumentDto) {
    const me = await this.access(userId, companyId);
    const t = await this.load(me, companyId, dto.memberId);
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, taxId: true, city: true, phone: true, modules: { where: { key: 'documents' }, select: { key: true } } },
    });
    const person = name(t.user);
    const doc = t.profile?.documentNumber ? `${DOCUMENT_LABEL[t.profile.documentType ?? 'CC'] ?? 'documento'} número ${t.profile.documentNumber}` : null;
    const today = todayBogota();
    const city = company.city ?? 'Colombia';
    const companyWithNit = `${company.name}${company.taxId ? `, identificada con NIT ${company.taxId},` : ''}`;
    const missing = (fields: [string, unknown][]) => {
      const lacking = fields.filter(([, v]) => v == null || v === '').map(([f]) => f);
      if (lacking.length) throw new BadRequestException(`Falta en la ficha de ${person}: ${lacking.join(', ')}. Complétalo en el Portal del empleado o en Equipo.`);
    };

    let title = TEMPLATE_LABEL[dto.template];
    let paragraphs: string[];
    if (dto.template === 'employment_certificate') {
      missing([
        ['documento', doc],
        ['cargo', t.jobTitle],
        ['fecha de ingreso', t.hiredAt],
        ...(dto.includeSalary ? ([['salario', t.profile?.salary]] as [string, unknown][]) : []),
      ]);
      if (t.status !== 'active') throw new BadRequestException(`${person} ya no está activo en la empresa`);
      const contract = t.profile?.contractType ? `, ${CONTRACT_PHRASE[t.profile.contractType]}` : '';
      paragraphs = [
        `${companyWithNit} certifica que ${person}, con ${doc}, trabaja en esta empresa desde el ${longDate(t.hiredAt!)}, en el cargo de ${t.jobTitle}${t.area ? ` (área de ${t.area})` : ''}${contract}.`,
        ...(dto.includeSalary ? [`Devenga un salario mensual de ${pesosText(t.profile!.salary!)}.`] : []),
        `La presente certificación se expide a solicitud de la persona interesada, en ${city}, a los ${today.getUTCDate()} días del mes de ${MONTHS[today.getUTCMonth()]} de ${today.getUTCFullYear()}.`,
      ];
    } else if (dto.template === 'vacation_record') {
      if (!dto.requestId) throw new BadRequestException('Elige las vacaciones aprobadas');
      const r = await this.prisma.leaveRequest.findFirst({
        where: { id: dto.requestId, companyId, memberId: t.id, type: 'vacation', status: 'approved' },
        select: { startDate: true, endDate: true, days: true, hrAt: true },
      });
      if (!r || !r.startDate || !r.endDate) throw new BadRequestException('Esas vacaciones no están aprobadas');
      const past = r.endDate < today;
      paragraphs = [
        `${companyWithNit} hace constar que ${person}${doc ? `, con ${doc},` : ''} ${past ? 'disfrutó' : 'disfrutará'} de sus vacaciones entre el ${longDate(r.startDate)} y el ${longDate(r.endDate)}, para un total de ${r.days} ${r.days === 1 ? 'día' : 'días'} (sin contar domingos).`,
        `Las vacaciones fueron aprobadas${r.hrAt ? ` el ${longDate(new Date(`${r.hrAt.toISOString().slice(0, 10)}T00:00:00Z`))}` : ''} por la empresa.`,
        `Se expide en ${city}, el ${longDate(today)}.`,
      ];
    } else {
      if (!dto.subject || !dto.body) throw new BadRequestException('Escribe el asunto y el texto de la carta');
      title = dto.subject;
      const values: Record<string, string> = {
        nombre: person,
        documento: doc ?? '',
        cargo: t.jobTitle ?? '',
        area: t.area ?? '',
        fecha_ingreso: t.hiredAt ? longDate(t.hiredAt) : '',
        empresa: company.name,
        nit: company.taxId ?? '',
        ciudad: city,
        salario: t.profile?.salary != null ? pesosText(t.profile.salary) : '',
        fecha: longDate(today),
      };
      const unknown = [...dto.body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((k) => !(k in values));
      if (unknown.length) throw new BadRequestException(`No conozco estos campos: ${[...new Set(unknown)].map((k) => `{${k}}`).join(', ')}`);
      const empty = [...dto.body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((k) => !values[k]);
      if (empty.length) throw new BadRequestException(`Falta en la ficha de ${person}: ${[...new Set(empty)].join(', ')}`);
      paragraphs = dto.body
        .replace(/\{([a-z_]+)\}/g, (_, k: string) => values[k])
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    }

    const pdf = await renderLetter({
      companyName: company.name,
      companyLines: [[company.taxId ? `NIT ${company.taxId}` : null, company.city, company.phone].filter(Boolean).join(' · ')].filter(Boolean),
      placeAndDate: `${city}, ${longDate(today)}`,
      title: title.toUpperCase(),
      addressee: dto.template === 'custom_letter' ? dto.addressee || undefined : dto.addressee || 'A quien pueda interesar:',
      paragraphs,
      signerName: dto.signerName,
      signerTitle: dto.signerTitle,
      footer: `Documento generado con 3R el ${longDate(today)}.`,
    });
    const fileName = `${slug(title)}-${slug(person)}-${today.toISOString().slice(0, 10)}.pdf`;

    // Copia en la carpeta del empleado, si la empresa tiene Documentos.
    let savedDocumentId: string | null = null;
    if (dto.saveToFolder && company.modules.length) {
      const key = `${randomUUID()}.pdf`;
      await this.storage.save(key, Buffer.from(pdf), 'application/pdf');
      const saved = await this.prisma.companyDocument.create({
        data: {
          companyId,
          memberId: t.id,
          category: 'certificate',
          title: `${title} — ${longDate(today)}`,
          fileName,
          contentType: 'application/pdf',
          size: pdf.length,
          storageKey: key,
          status: 'ready',
          uploadedById: userId,
        },
        select: { id: true },
      });
      savedDocumentId = saved.id;
      if (t.id !== me.id) {
        await this.alerts.notify(companyId, [t.id], { kind: 'document', title: `Tienes un documento nuevo: ${title}`, href: `documentos?member=${t.id}` });
      }
    }
    await this.audit.log({
      action: 'COMPANY_DOCUMENT_GENERATED',
      userId,
      entityType: 'company',
      entityId: companyId,
      metadata: { template: dto.template, memberId: t.id, includeSalary: !!dto.includeSalary, savedDocumentId },
    });
    return { pdf: Buffer.from(pdf), fileName, savedDocumentId };
  }
}
