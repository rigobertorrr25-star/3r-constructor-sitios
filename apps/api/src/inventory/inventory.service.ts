import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast, roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssetStatusDto, AssignDto, MovementDto, SaveAssetDto, SaveItemDto } from './dto/inventory.dto.js';
import { INVENTORY_MODULE } from './inventory.constants.js';

type Min = 'employee' | 'supervisor';
type Dec = { toString(): string } | null;

const name = (u: { firstName: string | null; lastName: string | null; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
/** Cantidades en milésimas (enteros) para no arrastrar errores de decimales. */
const milli = (d: Dec | number) => (d == null ? 0 : Math.round(Number(d.toString()) * 1000));
const fromMilli = (m: number) => (m / 1000).toFixed(3);
/** 1500 milésimas → "1,5". */
const qtyText = (m: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(m / 1000);
const num = (d: Dec) => (d == null ? null : Number(d.toString()));
const pesos = (c: bigint | null) => (c == null ? null : Number(c / 100n));
const cents = (p: number | null | undefined) => (p === undefined ? undefined : p === null ? null : BigInt(p) * 100n);
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

const itemSelect = {
  id: true,
  name: true,
  sku: true,
  category: true,
  unit: true,
  stock: true,
  minStock: true,
  costCents: true,
  location: true,
  notes: true,
  active: true,
  updatedAt: true,
} as const satisfies Prisma.InventoryItemSelect;
type ItemRow = Prisma.InventoryItemGetPayload<{ select: typeof itemSelect }>;

const assetSelect = {
  id: true,
  name: true,
  code: true,
  category: true,
  serial: true,
  status: true,
  assignedMemberId: true,
  assignedAt: true,
  valueCents: true,
  purchasedAt: true,
  notes: true,
  updatedAt: true,
  assignedMember: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
} as const satisfies Prisma.CompanyAssetSelect;
type AssetRow = Prisma.CompanyAssetGetPayload<{ select: typeof assetSelect }>;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly alerts: AlertsService,
  ) {}

  /** Inventario y activos los maneja supervisor en adelante; cada persona ve los equipos que tiene a cargo. */
  private async access(userId: string, companyId: string, min: Min = 'employee') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, INVENTORY_MODULE);
    return me;
  }

  private item(i: ItemRow) {
    const stock = num(i.stock)!;
    const minStock = num(i.minStock);
    return {
      ...i,
      stock,
      minStock,
      costCents: undefined,
      cost: pesos(i.costCents),
      low: minStock != null && stock < minStock,
    };
  }

  private asset(a: AssetRow) {
    const { assignedMember, valueCents, ...rest } = a;
    return { ...rest, value: pesos(valueCents), assignedTo: assignedMember ? name(assignedMember.user) : null };
  }

  async summary(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const myAssets = await this.prisma.companyAsset.count({ where: { companyId, assignedMemberId: me.id, status: 'assigned' } });
    if (!atLeast(me.role, 'supervisor')) return { manage: false, myAssets };
    const low = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM inventory_items
      WHERE company_id = ${companyId}::uuid AND active AND min_stock IS NOT NULL AND stock < min_stock`;
    return { manage: true, myAssets, lowStock: Number(low[0]?.n ?? 0) };
  }

  // ───────── productos e insumos ─────────

  async listItems(userId: string, companyId: string, q?: string, filter?: string) {
    await this.access(userId, companyId, 'supervisor');
    const text = q?.trim().slice(0, 100);
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        companyId,
        ...(filter === 'inactive' ? { active: false } : { active: true }),
        ...(text
          ? {
              OR: [
                { name: { contains: text, mode: 'insensitive' } },
                { sku: { contains: text, mode: 'insensitive' } },
                { category: { contains: text, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      take: 1000,
      select: itemSelect,
    });
    const items = rows.map((r) => this.item(r)).filter((i) => filter !== 'low' || i.low);
    const valueCents = rows.reduce((sum, r) => sum + (r.costCents != null ? (r.costCents * BigInt(milli(r.stock))) / 1000n : 0n), 0n);
    return { items, totals: { count: items.length, low: items.filter((i) => i.low).length, value: pesos(valueCents) } };
  }

  private itemData(dto: SaveItemDto) {
    return {
      name: dto.name,
      sku: dto.sku || null,
      category: dto.category || null,
      unit: dto.unit,
      minStock: dto.minStock == null ? null : fromMilli(milli(dto.minStock)),
      costCents: cents(dto.cost ?? null),
      location: dto.location || null,
      notes: dto.notes || null,
      ...(dto.active === undefined ? {} : { active: dto.active }),
    };
  }

  async createItem(userId: string, companyId: string, dto: SaveItemDto) {
    await this.access(userId, companyId, 'supervisor');
    const initial = milli(dto.initialStock ?? 0);
    return this.prisma.inventoryItem.create({
      data: {
        ...this.itemData(dto),
        companyId,
        stock: fromMilli(initial),
        movements: initial
          ? { create: { type: 'in', quantity: fromMilli(initial), stockAfter: fromMilli(initial), note: 'Inventario inicial', userId } }
          : undefined,
      },
      select: { id: true },
    });
  }

  async updateItem(userId: string, companyId: string, itemId: string, dto: SaveItemDto) {
    await this.access(userId, companyId, 'supervisor');
    const { count } = await this.prisma.inventoryItem.updateMany({ where: { id: itemId, companyId }, data: this.itemData(dto) });
    if (!count) throw new NotFoundException('Producto no encontrado');
    return { id: itemId };
  }

  async removeItem(userId: string, companyId: string, itemId: string) {
    await this.access(userId, companyId, 'supervisor');
    const { count } = await this.prisma.inventoryItem.deleteMany({ where: { id: itemId, companyId } });
    if (!count) throw new NotFoundException('Producto no encontrado');
  }

  async getItem(userId: string, companyId: string, itemId: string) {
    await this.access(userId, companyId, 'supervisor');
    const i = await this.prisma.inventoryItem.findFirst({ where: { id: itemId, companyId }, select: itemSelect });
    if (!i) throw new NotFoundException('Producto no encontrado');
    const moves = await this.prisma.inventoryMovement.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, type: true, quantity: true, stockAfter: true, note: true, userId: true, createdAt: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(moves.map((m) => m.userId).filter((x): x is string => !!x))] } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const who = new Map(users.map((u) => [u.id, name(u)]));
    return {
      ...this.item(i),
      movements: moves.map(({ userId: uid, quantity, stockAfter, ...m }) => ({
        ...m,
        quantity: num(quantity),
        stockAfter: num(stockAfter),
        by: uid ? (who.get(uid) ?? null) : null,
      })),
    };
  }

  /** Entrada, salida o conteo. La salida no deja el inventario en negativo. */
  async move(userId: string, companyId: string, itemId: string, dto: MovementDto) {
    await this.access(userId, companyId, 'supervisor');
    const q = milli(dto.quantity);
    if (dto.type !== 'count' && q <= 0) throw new BadRequestException('La cantidad debe ser mayor que cero');
    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ stock: Dec; min_stock: Dec; name: string; unit: string; active: boolean }[]>`
        SELECT stock, min_stock, name, unit, active FROM inventory_items WHERE id = ${itemId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundException('Producto no encontrado');
      const before = milli(row.stock);
      const after = dto.type === 'in' ? before + q : dto.type === 'out' ? before - q : q;
      if (after < 0) throw new BadRequestException(`No alcanza: hay ${qtyText(before)} ${row.unit}`);
      await tx.inventoryItem.update({ where: { id: itemId }, data: { stock: fromMilli(after) } });
      const movement = await tx.inventoryMovement.create({
        data: { itemId, type: dto.type, quantity: fromMilli(q), stockAfter: fromMilli(after), note: dto.note || null, userId },
        select: { id: true },
      });
      return { movementId: movement.id, before, after, min: row.min_stock == null ? null : milli(row.min_stock), name: row.name };
    });
    // Aviso cuando cruza por debajo del mínimo (una vez al día por producto).
    if (result.min != null && result.after < result.min && result.before >= result.min) {
      const bosses = await this.prisma.companyMember.findMany({ where: { companyId, status: 'active' }, select: { id: true, role: true } });
      await this.alerts.notify(
        companyId,
        bosses.filter((b) => roleRank(b.role) >= roleRank('supervisor')).map((b) => b.id),
        {
          kind: 'inventory',
          title: `Queda poco: ${result.name}`,
          body: `Quedan ${qtyText(result.after)}; el mínimo es ${qtyText(result.min)}.`,
          href: `inventario/${itemId}`,
          dedupeKey: `lowstock:${itemId}:${todayBogota()}`,
        },
      );
    }
    return { stock: result.after / 1000, low: result.min != null && result.after < result.min };
  }

  // ───────── activos (equipos entregados) ─────────

  async listAssets(userId: string, companyId: string, status?: string, q?: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'supervisor');
    const text = q?.trim().slice(0, 100);
    const rows = await this.prisma.companyAsset.findMany({
      where: {
        companyId,
        ...(manage
          ? status && ['available', 'assigned', 'repair', 'retired'].includes(status)
            ? { status }
            : { status: { not: 'retired' } }
          : { assignedMemberId: me.id, status: 'assigned' }),
        ...(text && manage
          ? {
              OR: [
                { name: { contains: text, mode: 'insensitive' } },
                { code: { contains: text, mode: 'insensitive' } },
                { serial: { contains: text, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 1000,
      select: assetSelect,
    });
    const counts = manage ? await this.prisma.companyAsset.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }) : [];
    return { manage, assets: rows.map((a) => this.asset(a)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  private async uniqueCode(companyId: string, code: string | undefined, except?: string) {
    if (!code) return;
    const dup = await this.prisma.companyAsset.findFirst({
      where: { companyId, code, ...(except ? { id: { not: except } } : {}) },
      select: { name: true },
    });
    if (dup) throw new BadRequestException(`El código ${code} ya lo tiene «${dup.name}»`);
  }

  private assetData(dto: SaveAssetDto) {
    return {
      name: dto.name,
      code: dto.code || null,
      category: dto.category || null,
      serial: dto.serial || null,
      valueCents: cents(dto.value ?? null),
      purchasedAt: dto.purchasedAt ? new Date(`${dto.purchasedAt.slice(0, 10)}T00:00:00Z`) : null,
      notes: dto.notes || null,
    };
  }

  async createAsset(userId: string, companyId: string, dto: SaveAssetDto) {
    await this.access(userId, companyId, 'supervisor');
    await this.uniqueCode(companyId, dto.code);
    return this.prisma.companyAsset.create({
      data: { ...this.assetData(dto), companyId, events: { create: { kind: 'created', userId } } },
      select: { id: true },
    });
  }

  async updateAsset(userId: string, companyId: string, assetId: string, dto: SaveAssetDto) {
    await this.access(userId, companyId, 'supervisor');
    await this.uniqueCode(companyId, dto.code, assetId);
    const { count } = await this.prisma.companyAsset.updateMany({ where: { id: assetId, companyId }, data: this.assetData(dto) });
    if (!count) throw new NotFoundException('Equipo no encontrado');
    return { id: assetId };
  }

  async removeAsset(userId: string, companyId: string, assetId: string) {
    await this.access(userId, companyId, 'supervisor');
    const { count } = await this.prisma.companyAsset.deleteMany({ where: { id: assetId, companyId } });
    if (!count) throw new NotFoundException('Equipo no encontrado');
  }

  private async findAsset(companyId: string, assetId: string) {
    const a = await this.prisma.companyAsset.findFirst({ where: { id: assetId, companyId }, select: assetSelect });
    if (!a) throw new NotFoundException('Equipo no encontrado');
    return a;
  }

  async getAsset(userId: string, companyId: string, assetId: string) {
    const me = await this.access(userId, companyId);
    const manage = atLeast(me.role, 'supervisor');
    const a = await this.findAsset(companyId, assetId);
    if (!manage && a.assignedMemberId !== me.id) throw new NotFoundException('Equipo no encontrado');
    const events = await this.prisma.companyAssetEvent.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, kind: true, person: true, note: true, userId: true, createdAt: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(events.map((e) => e.userId).filter((x): x is string => !!x))] } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const who = new Map(users.map((u) => [u.id, name(u)]));
    return { ...this.asset(a), manage, events: events.map(({ userId: uid, ...e }) => ({ ...e, by: uid ? (who.get(uid) ?? null) : null })) };
  }

  /** Entregárselo a alguien del equipo (si lo tenía otra persona, queda como devuelto por ella). */
  async assign(userId: string, companyId: string, assetId: string, dto: AssignDto) {
    await this.access(userId, companyId, 'supervisor');
    const a = await this.findAsset(companyId, assetId);
    if (a.status === 'retired') throw new BadRequestException('Este equipo está dado de baja');
    if (a.assignedMemberId === dto.memberId) throw new BadRequestException('Ya lo tiene esa persona');
    const target = await this.prisma.companyMember.findFirst({
      where: { id: dto.memberId, companyId, status: 'active' },
      select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!target) throw new BadRequestException('Esa persona no está en la empresa');
    const person = name(target.user);
    await this.prisma.$transaction([
      ...(a.assignedMemberId
        ? [
            this.prisma.companyAssetEvent.create({
              data: { assetId, kind: 'returned', memberId: a.assignedMemberId, person: this.asset(a).assignedTo, userId },
            }),
          ]
        : []),
      this.prisma.companyAsset.update({ where: { id: assetId }, data: { status: 'assigned', assignedMemberId: target.id, assignedAt: new Date() } }),
      this.prisma.companyAssetEvent.create({ data: { assetId, kind: 'assigned', memberId: target.id, person, note: dto.note || null, userId } }),
    ]);
    await this.alerts.notify(companyId, [target.id], {
      kind: 'asset',
      title: `Quedó a tu cargo: ${a.name}${a.code ? ` (${a.code})` : ''}`,
      body: dto.note || null,
      href: `inventario/activos/${assetId}`,
    });
    return { ok: true };
  }

  /** Devolverlo (queda disponible), mandarlo a reparación o darlo de baja. */
  async setStatus(userId: string, companyId: string, assetId: string, dto: AssetStatusDto) {
    await this.access(userId, companyId, 'supervisor');
    const a = await this.findAsset(companyId, assetId);
    if (a.status === dto.status) throw new BadRequestException('Ya está en ese estado');
    const holder = this.asset(a).assignedTo;
    await this.prisma.$transaction([
      ...(a.assignedMemberId
        ? [this.prisma.companyAssetEvent.create({ data: { assetId, kind: 'returned', memberId: a.assignedMemberId, person: holder, userId } })]
        : []),
      this.prisma.companyAsset.update({ where: { id: assetId }, data: { status: dto.status, assignedMemberId: null, assignedAt: null } }),
      ...(dto.status !== 'available' || !a.assignedMemberId || dto.note
        ? [this.prisma.companyAssetEvent.create({ data: { assetId, kind: dto.status, note: dto.note || null, userId } })]
        : []),
    ]);
    return { ok: true };
  }

  /** Equipos a cargo de una persona (para su ficha y para el paz y salvo). */
  async memberAssets(userId: string, companyId: string, memberId: string) {
    const me = await this.access(userId, companyId);
    if (memberId !== me.id && !atLeast(me.role, 'supervisor')) throw new NotFoundException('Persona no encontrada');
    const rows = await this.prisma.companyAsset.findMany({
      where: { companyId, assignedMemberId: memberId, status: 'assigned' },
      orderBy: { name: 'asc' },
      select: assetSelect,
    });
    return rows.map((a) => this.asset(a));
  }
}
