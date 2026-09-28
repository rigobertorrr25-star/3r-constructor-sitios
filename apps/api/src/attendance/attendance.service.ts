import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { slugify, uniqueSlug } from '../common/slug.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bogotaDayStart, currentCode, isValidCode, newKioskSecret, pinHash, CODE_WINDOW_MS } from './codes.js';
import type {
  CreateBusinessDto,
  CreateEmployeeDto,
  RecordsQueryDto,
  UpdateBusinessDto,
  UpdateEmployeeDto,
  UpdateRecordDto,
} from './dto/attendance.dto.js';

const MINUTE = 60_000;
/** Dos marcaciones seguidas en menos de esto son un doble escaneo, no una entrada y una salida. */
const DOUBLE_SCAN_MS = 2 * MINUTE;
/** Una entrada sin salida más vieja que esto se da por olvidada: la próxima marcación abre otra jornada. */
const FORGOTTEN_MS = 16 * 60 * MINUTE;
const MAX_SHIFT_MS = 24 * 60 * MINUTE;
const MAX_RANGE_DAYS = 62;

const employeeSelect = { id: true, name: true, shiftStart: true, shiftEnd: true, isActive: true } as const;
const recordSelect = {
  id: true,
  employeeId: true,
  clockIn: true,
  clockOut: true,
  editedAt: true,
  employee: { select: { name: true, shiftStart: true, shiftEnd: true } },
} as const;

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const pinTaken = () => new ConflictException({ message: 'Ese PIN ya lo tiene otro empleado de este negocio.', code: 'PIN_TAKEN' });

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────── público: tablet y celular del empleado ─────────

  /** Lo que muestra la tablet de la entrada: el código vigente y cuánto le queda. */
  async kiosk(secret: string) {
    const business = await this.prisma.attendanceBusiness.findFirst({
      where: { kioskSecret: secret, isActive: true },
      select: { name: true, slug: true, kioskSecret: true },
    });
    if (!business) throw new NotFoundException('Enlace de tablet no válido');
    return { name: business.name, slug: business.slug, windowMs: CODE_WINDOW_MS, ...currentCode(business.kioskSecret, business.slug) };
  }

  async publicBusiness(slug: string) {
    const business = await this.prisma.attendanceBusiness.findFirst({ where: { slug, isActive: true }, select: { name: true } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return business;
  }

  /** Marca entrada o salida: si el empleado tiene una jornada abierta, la cierra; si no, abre una. */
  async punch(slug: string, code: string, pin: string, now = new Date()) {
    const business = await this.prisma.attendanceBusiness.findFirst({
      where: { slug, isActive: true },
      select: { id: true, slug: true, kioskSecret: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    if (!isValidCode(business.kioskSecret, business.slug, code, now.getTime())) {
      throw new BadRequestException({ message: 'El código ya venció. Escanea otra vez el QR de la entrada.', code: 'CODE_EXPIRED' });
    }
    const employee = await this.prisma.attendanceEmployee.findFirst({
      where: { businessId: business.id, pinHash: pinHash(business.id, pin), isActive: true },
      select: { id: true, name: true },
    });
    if (!employee) throw new BadRequestException({ message: 'PIN incorrecto. Revísalo e intenta de nuevo.', code: 'PIN_INVALID' });

    const last = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id },
      orderBy: { clockIn: 'desc' },
      select: { id: true, clockIn: true, clockOut: true },
    });
    const elapsed = (from: Date) => now.getTime() - from.getTime();

    if (last && !last.clockOut && elapsed(last.clockIn) < FORGOTTEN_MS) {
      if (elapsed(last.clockIn) < DOUBLE_SCAN_MS) {
        throw new ConflictException({ message: 'Ya marcaste tu entrada hace un momento.', code: 'DOUBLE_SCAN' });
      }
      await this.prisma.attendanceRecord.update({ where: { id: last.id }, data: { clockOut: now } });
      return { employeeName: employee.name, type: 'out' as const, at: now, workedMinutes: Math.round(elapsed(last.clockIn) / MINUTE) };
    }
    if (last?.clockOut && elapsed(last.clockOut) < DOUBLE_SCAN_MS) {
      throw new ConflictException({ message: 'Ya marcaste tu salida hace un momento.', code: 'DOUBLE_SCAN' });
    }
    await this.prisma.attendanceRecord.create({ data: { businessId: business.id, employeeId: employee.id, clockIn: now } });
    return { employeeName: employee.name, type: 'in' as const, at: now, workedMinutes: null };
  }

  // ───────── equipo de 3R ─────────

  listBusinesses() {
    return this.prisma.attendanceBusiness.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, isActive: true, _count: { select: { employees: { where: { isActive: true } } } } },
    });
  }

  async getBusiness(id: string) {
    const business = await this.prisma.attendanceBusiness.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        kioskSecret: true,
        isActive: true,
        employees: { orderBy: [{ isActive: 'desc' }, { name: 'asc' }], select: employeeSelect },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return business;
  }

  async createBusiness(adminId: string, dto: CreateBusinessDto, ip?: string) {
    const slug = await uniqueSlug(slugify(dto.name, 'negocio'), async (candidate) =>
      Boolean(await this.prisma.attendanceBusiness.findUnique({ where: { slug: candidate }, select: { id: true } })),
    );
    const business = await this.prisma.attendanceBusiness.create({
      data: { name: dto.name.trim(), slug, kioskSecret: newKioskSecret() },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    await this.audit.log({ action: 'ATTENDANCE_BUSINESS_CREATED', userId: adminId, entityType: 'attendance_business', entityId: business.id, ipAddress: ip });
    return business;
  }

  async updateBusiness(adminId: string, id: string, dto: UpdateBusinessDto, ip?: string) {
    await this.ensureBusiness(id);
    await this.prisma.attendanceBusiness.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.rotateKiosk ? { kioskSecret: newKioskSecret() } : {}),
      },
    });
    await this.audit.log({
      action: dto.rotateKiosk ? 'ATTENDANCE_KIOSK_ROTATED' : 'ATTENDANCE_BUSINESS_UPDATED',
      userId: adminId,
      entityType: 'attendance_business',
      entityId: id,
      ipAddress: ip,
    });
    return this.getBusiness(id);
  }

  async createEmployee(adminId: string, businessId: string, dto: CreateEmployeeDto, ip?: string) {
    await this.ensureBusiness(businessId);
    try {
      const employee = await this.prisma.attendanceEmployee.create({
        data: {
          businessId,
          name: dto.name.trim(),
          pinHash: pinHash(businessId, dto.pin),
          shiftStart: dto.shiftStart || null,
          shiftEnd: dto.shiftEnd || null,
        },
        select: employeeSelect,
      });
      await this.audit.log({ action: 'ATTENDANCE_EMPLOYEE_CREATED', userId: adminId, entityType: 'attendance_employee', entityId: employee.id, ipAddress: ip });
      return employee;
    } catch (error) {
      if (isUniqueViolation(error)) throw pinTaken();
      throw error;
    }
  }

  async updateEmployee(adminId: string, businessId: string, employeeId: string, dto: UpdateEmployeeDto, ip?: string) {
    const exists = await this.prisma.attendanceEmployee.findFirst({ where: { id: employeeId, businessId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Empleado no encontrado');
    try {
      const employee = await this.prisma.attendanceEmployee.update({
        where: { id: employeeId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.pin ? { pinHash: pinHash(businessId, dto.pin) } : {}),
          ...(dto.shiftStart !== undefined ? { shiftStart: dto.shiftStart || null } : {}),
          ...(dto.shiftEnd !== undefined ? { shiftEnd: dto.shiftEnd || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: employeeSelect,
      });
      await this.audit.log({ action: 'ATTENDANCE_EMPLOYEE_UPDATED', userId: adminId, entityType: 'attendance_employee', entityId: employeeId, ipAddress: ip });
      return employee;
    } catch (error) {
      if (isUniqueViolation(error)) throw pinTaken();
      throw error;
    }
  }

  /** Jornadas que empezaron entre dos días (hora de Colombia), ambos incluidos. */
  async listRecords(businessId: string, query: RecordsQueryDto) {
    await this.ensureBusiness(businessId);
    const from = bogotaDayStart(query.from);
    const to = new Date(bogotaDayStart(query.to).getTime() + 24 * 60 * MINUTE);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new BadRequestException('Rango de fechas inválido.');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * MINUTE) {
      throw new BadRequestException(`El rango no puede pasar de ${MAX_RANGE_DAYS} días.`);
    }
    return this.prisma.attendanceRecord.findMany({
      where: { businessId, clockIn: { gte: from, lt: to } },
      orderBy: { clockIn: 'asc' },
      select: recordSelect,
    });
  }

  /** Corrección a mano: una salida olvidada o una hora mal marcada. */
  async updateRecord(adminId: string, businessId: string, recordId: string, dto: UpdateRecordDto, ip?: string) {
    const record = await this.prisma.attendanceRecord.findFirst({ where: { id: recordId, businessId }, select: { clockIn: true, clockOut: true } });
    if (!record) throw new NotFoundException('Registro no encontrado');
    const clockIn = dto.clockIn !== undefined ? new Date(dto.clockIn) : record.clockIn;
    const clockOut = dto.clockOut === undefined ? record.clockOut : dto.clockOut === null ? null : new Date(dto.clockOut);
    if (clockOut && clockOut <= clockIn) throw new BadRequestException('La salida debe ser después de la entrada.');
    if (clockOut && clockOut.getTime() - clockIn.getTime() > MAX_SHIFT_MS) throw new BadRequestException('Una jornada no puede pasar de 24 horas.');
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { clockIn, clockOut, editedAt: new Date() },
      select: recordSelect,
    });
    await this.audit.log({
      action: 'ATTENDANCE_RECORD_EDITED',
      userId: adminId,
      entityType: 'attendance_record',
      entityId: recordId,
      metadata: { before: { clockIn: record.clockIn.toISOString(), clockOut: record.clockOut?.toISOString() ?? null } },
      ipAddress: ip,
    });
    return updated;
  }

  async deleteRecord(adminId: string, businessId: string, recordId: string, ip?: string) {
    const record = await this.prisma.attendanceRecord.findFirst({ where: { id: recordId, businessId }, select: { clockIn: true, clockOut: true, employeeId: true } });
    if (!record) throw new NotFoundException('Registro no encontrado');
    await this.prisma.attendanceRecord.delete({ where: { id: recordId } });
    await this.audit.log({
      action: 'ATTENDANCE_RECORD_DELETED',
      userId: adminId,
      entityType: 'attendance_record',
      entityId: recordId,
      metadata: { employeeId: record.employeeId, clockIn: record.clockIn.toISOString(), clockOut: record.clockOut?.toISOString() ?? null },
      ipAddress: ip,
    });
  }

  private async ensureBusiness(id: string) {
    const exists = await this.prisma.attendanceBusiness.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Negocio no encontrado');
  }
}
