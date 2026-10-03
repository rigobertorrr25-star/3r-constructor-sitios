import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service.js';
import { atLeast, roleRank } from '../companies/companies.constants.js';
import { CompaniesService } from '../companies/companies.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MEDIA_STORAGE, MEDIA_TYPES, type MediaStorage } from '../media/media-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PlaceOrderDto, QuoteCartDto, SaveCouponDto, SaveProductDto, StoreSettingsDto, UpdateOrderDto } from './dto/store.dto.js';
import { priceLines, totals, type PricedLine, type PricedProduct } from './pricing.js';
import { SLUG, STORE_MODULE } from './store.constants.js';
import { AutomationsService } from '../automations/automations.service.js';

type Min = 'employee' | 'supervisor' | 'admin';

const pesos = (c: bigint | null | undefined) => (c == null ? null : Number(c / 100n));
const cents = (p: number | null | undefined) => (p == null ? null : BigInt(p) * 100n);
const money = (c: bigint) => `$${new Intl.NumberFormat('es-CO').format(Number(c / 100n))}`;
/** Celular colombiano para wa.me: 3001234567 → 573001234567. */
export const waNumber = (raw: string | null | undefined) => {
  const d = (raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  return d.length === 10 && d.startsWith('3') ? `57${d}` : d;
};
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

const productSelect = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  compareAtCents: true,
  imageUrl: true,
  category: true,
  trackStock: true,
  stock: true,
  active: true,
  featured: true,
  position: true,
  updatedAt: true,
  variants: { orderBy: { position: 'asc' }, select: { id: true, name: true, priceCents: true, stock: true, active: true } },
} as const satisfies Prisma.StoreProductSelect;
type ProductRow = Prisma.StoreProductGetPayload<{ select: typeof productSelect }>;

const orderSelect = {
  id: true,
  number: true,
  publicToken: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  delivery: true,
  address: true,
  notes: true,
  items: true,
  subtotalCents: true,
  discountCents: true,
  shippingCents: true,
  totalCents: true,
  couponCode: true,
  status: true,
  paid: true,
  staffNote: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.StoreOrderSelect;
type OrderRow = Prisma.StoreOrderGetPayload<{ select: typeof orderSelect }>;
type StoredLine = Omit<PricedLine, 'unitCents' | 'lineCents' | 'stockFrom'> & {
  unitCents: string;
  lineCents: string;
  stockFrom: PricedLine['stockFrom'];
};

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly alerts: AlertsService,
    @Inject(MEDIA_STORAGE) private readonly media: MediaStorage,
    private readonly automations: AutomationsService,
  ) {}

  /** Productos, cupones y pedidos: supervisor en adelante. Los ajustes de la tienda: administradores. */
  private async access(userId: string, companyId: string, min: Min = 'supervisor') {
    const me = await this.companies.requireMember(userId, companyId, min);
    await this.companies.requireModule(companyId, STORE_MODULE);
    return me;
  }

  // ───────── formas de salida ─────────

  private product(p: ProductRow) {
    const { priceCents, compareAtCents, variants, ...rest } = p;
    return {
      ...rest,
      price: pesos(priceCents)!,
      compareAt: pesos(compareAtCents),
      variants: variants.map(({ priceCents: vp, ...v }) => ({ ...v, price: pesos(vp) })),
    };
  }

  private order(o: OrderRow) {
    const { subtotalCents, discountCents, shippingCents, totalCents, items, ...rest } = o;
    return {
      ...rest,
      items: (items as StoredLine[]).map(({ unitCents, lineCents, stockFrom: _s, ...l }) => ({
        ...l,
        unit: pesos(BigInt(unitCents)),
        line: pesos(BigInt(lineCents)),
      })),
      subtotal: pesos(subtotalCents),
      discount: pesos(discountCents),
      shipping: pesos(shippingCents),
      total: pesos(totalCents),
    };
  }

  private settings(s: Prisma.StoreSettingsGetPayload<object>) {
    const { deliveryFeeCents, freeFromCents, companyId: _c, orderSeq: _o, ...rest } = s;
    return { ...rest, deliveryFee: pesos(deliveryFeeCents), freeFrom: pesos(freeFromCents) };
  }

  // ───────── ajustes ─────────

  async getSettings(userId: string, companyId: string) {
    const me = await this.access(userId, companyId);
    const s = await this.prisma.storeSettings.findUnique({ where: { companyId } });
    return { canEdit: atLeast(me.role, 'admin'), settings: s ? this.settings(s) : null, suggestedSlug: slugify(me.company.name) };
  }

  async saveSettings(userId: string, companyId: string, dto: StoreSettingsDto) {
    await this.access(userId, companyId, 'admin');
    if (!SLUG.test(dto.slug)) throw new BadRequestException('Esa dirección no sirve');
    const taken = await this.prisma.storeSettings.findFirst({
      where: { slug: dto.slug, companyId: { not: companyId } },
      select: { companyId: true },
    });
    if (taken) throw new BadRequestException('Esa dirección ya la usa otra tienda. Prueba con otra.');
    if (!dto.pickupEnabled && !dto.deliveryEnabled)
      throw new BadRequestException('Activa al menos una forma de entrega: recoger en el local o domicilio');
    const data = {
      slug: dto.slug,
      name: dto.name,
      tagline: dto.tagline || null,
      whatsapp: dto.whatsapp || null,
      open: dto.open ?? true,
      pickupEnabled: dto.pickupEnabled,
      pickupNote: dto.pickupNote || null,
      deliveryEnabled: dto.deliveryEnabled,
      deliveryFeeCents: cents(dto.deliveryFee ?? 0)!,
      freeFromCents: cents(dto.freeFrom ?? null),
      deliveryNote: dto.deliveryNote || null,
      paymentNote: dto.paymentNote || null,
    };
    const s = await this.prisma.storeSettings.upsert({ where: { companyId }, create: { ...data, companyId }, update: data });
    return this.settings(s);
  }

  // ───────── productos ─────────

  async listProducts(userId: string, companyId: string) {
    await this.access(userId, companyId);
    const rows = await this.prisma.storeProduct.findMany({
      where: { companyId },
      orderBy: [{ active: 'desc' }, { featured: 'desc' }, { category: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      take: 1000,
      select: productSelect,
    });
    return rows.map((p) => this.product(p));
  }

  async getProduct(userId: string, companyId: string, productId: string) {
    await this.access(userId, companyId);
    const p = await this.prisma.storeProduct.findFirst({ where: { id: productId, companyId }, select: productSelect });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return this.product(p);
  }

  private productData(dto: SaveProductDto) {
    const variants = (dto.variants ?? []).map((v, position) => ({ ...v, position }));
    const names = variants.map((v) => v.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new BadRequestException('Hay opciones con el mismo nombre');
    const track = dto.trackStock ?? false;
    return {
      data: {
        name: dto.name,
        description: dto.description || null,
        priceCents: cents(dto.price)!,
        compareAtCents: dto.compareAt && dto.compareAt > dto.price ? cents(dto.compareAt) : null,
        imageUrl: dto.imageUrl || null,
        category: dto.category || null,
        trackStock: track,
        // Con opciones, las existencias van en cada opción.
        stock: track && !variants.length ? (dto.stock ?? 0) : null,
        active: dto.active ?? true,
        featured: dto.featured ?? false,
      },
      variants: variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceCents: cents(v.price ?? null),
        stock: track ? (v.stock ?? 0) : null,
        active: v.active ?? true,
        position: v.position,
      })),
    };
  }

  async createProduct(userId: string, companyId: string, dto: SaveProductDto) {
    await this.access(userId, companyId);
    const { data, variants } = this.productData(dto);
    return this.prisma.storeProduct.create({
      data: { ...data, companyId, variants: { create: variants.map(({ id: _id, ...v }) => v) } },
      select: { id: true },
    });
  }

  async updateProduct(userId: string, companyId: string, productId: string, dto: SaveProductDto) {
    await this.access(userId, companyId);
    const p = await this.prisma.storeProduct.findFirst({ where: { id: productId, companyId }, select: { variants: { select: { id: true } } } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    const { data, variants } = this.productData(dto);
    const existing = new Set(p.variants.map((v) => v.id));
    const keep = variants.filter((v) => v.id && existing.has(v.id));
    // Las opciones que siguen conservan su id (los carritos abiertos no se rompen).
    await this.prisma.$transaction([
      this.prisma.storeVariant.deleteMany({ where: { productId, id: { notIn: keep.map((v) => v.id!) } } }),
      ...keep.map(({ id, ...v }) => this.prisma.storeVariant.update({ where: { id }, data: v })),
      this.prisma.storeVariant.createMany({
        data: variants.filter((v) => !v.id || !existing.has(v.id)).map(({ id: _id, ...v }) => ({ ...v, productId })),
      }),
      this.prisma.storeProduct.update({ where: { id: productId }, data }),
    ]);
    return { id: productId };
  }

  async removeProduct(userId: string, companyId: string, productId: string) {
    await this.access(userId, companyId);
    const { count } = await this.prisma.storeProduct.deleteMany({ where: { id: productId, companyId } });
    if (!count) throw new NotFoundException('Producto no encontrado');
  }

  /** Permiso para subir la foto de un producto directo al almacenamiento público. */
  async presignImage(userId: string, companyId: string, contentType: string, origin: string) {
    await this.access(userId, companyId);
    return this.media.presignUpload(`store-${companyId}-${randomUUID()}.${MEDIA_TYPES[contentType]}`, contentType, origin);
  }

  // ───────── cupones ─────────

  private coupon(c: Prisma.StoreCouponGetPayload<object>) {
    const { amountCents, minOrderCents, companyId: _c, ...rest } = c;
    return { ...rest, amount: pesos(amountCents), minOrder: pesos(minOrderCents) };
  }

  async listCoupons(userId: string, companyId: string) {
    await this.access(userId, companyId);
    const rows = await this.prisma.storeCoupon.findMany({ where: { companyId }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] });
    return rows.map((c) => this.coupon(c));
  }

  private couponData(dto: SaveCouponDto) {
    if ((dto.percent == null) === (dto.amount == null)) throw new BadRequestException('Elige un porcentaje o un valor fijo de descuento');
    return {
      code: dto.code,
      percent: dto.percent ?? null,
      amountCents: cents(dto.amount ?? null),
      minOrderCents: cents(dto.minOrder ?? null),
      maxUses: dto.maxUses ?? null,
      expiresAt: dto.expiresAt ? new Date(`${dto.expiresAt.slice(0, 10)}T00:00:00Z`) : null,
      active: dto.active ?? true,
    };
  }

  async createCoupon(userId: string, companyId: string, dto: SaveCouponDto) {
    await this.access(userId, companyId);
    try {
      return this.coupon(await this.prisma.storeCoupon.create({ data: { ...this.couponData(dto), companyId } }));
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new BadRequestException(`Ya hay un cupón ${dto.code}`);
      throw e;
    }
  }

  async updateCoupon(userId: string, companyId: string, couponId: string, dto: SaveCouponDto) {
    await this.access(userId, companyId);
    try {
      const { count } = await this.prisma.storeCoupon.updateMany({ where: { id: couponId, companyId }, data: this.couponData(dto) });
      if (!count) throw new NotFoundException('Cupón no encontrado');
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new BadRequestException(`Ya hay un cupón ${dto.code}`);
      throw e;
    }
    return { id: couponId };
  }

  async removeCoupon(userId: string, companyId: string, couponId: string) {
    await this.access(userId, companyId);
    const { count } = await this.prisma.storeCoupon.deleteMany({ where: { id: couponId, companyId } });
    if (!count) throw new NotFoundException('Cupón no encontrado');
  }

  // ───────── pedidos (la empresa) ─────────

  async summary(userId: string, companyId: string) {
    await this.access(userId, companyId);
    const [fresh, open] = await Promise.all([
      this.prisma.storeOrder.count({ where: { companyId, status: 'new' } }),
      this.prisma.storeOrder.count({ where: { companyId, status: { in: ['confirmed', 'preparing', 'ready', 'on_way'] } } }),
    ]);
    return { newOrders: fresh, inProgress: open };
  }

  async listOrders(userId: string, companyId: string, status?: string) {
    await this.access(userId, companyId);
    const where: Prisma.StoreOrderWhereInput = {
      companyId,
      ...(status === 'open' || !status
        ? { status: { in: ['new', 'confirmed', 'preparing', 'ready', 'on_way'] } }
        : status === 'all'
          ? {}
          : { status }),
    };
    const [rows, counts] = await Promise.all([
      this.prisma.storeOrder.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, select: orderSelect }),
      this.prisma.storeOrder.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
    ]);
    return { orders: rows.map((o) => this.order(o)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  async getOrder(userId: string, companyId: string, orderId: string) {
    await this.access(userId, companyId);
    const o = await this.prisma.storeOrder.findFirst({ where: { id: orderId, companyId }, select: orderSelect });
    if (!o) throw new NotFoundException('Pedido no encontrado');
    const s = await this.prisma.storeSettings.findUnique({ where: { companyId }, select: { slug: true } });
    return { ...this.order(o), slug: s?.slug ?? null };
  }

  /** Cambiar estado, marcar pagado o anotar. Cancelar devuelve las existencias; un pedido cancelado ya no cambia. */
  async updateOrder(userId: string, companyId: string, orderId: string, dto: UpdateOrderDto) {
    await this.access(userId, companyId);
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string; items: unknown; coupon_code: string | null }[]>`
        SELECT status, items, coupon_code FROM store_orders WHERE id = ${orderId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const o = rows[0];
      if (!o) throw new NotFoundException('Pedido no encontrado');
      if (o.status === 'cancelled') throw new BadRequestException('Este pedido está cancelado');
      if (dto.status === 'cancelled') {
        for (const l of o.items as StoredLine[]) {
          if (l.stockFrom === 'variant' && l.variantId)
            await tx.storeVariant.updateMany({ where: { id: l.variantId }, data: { stock: { increment: l.qty } } });
          if (l.stockFrom === 'product')
            await tx.storeProduct.updateMany({ where: { id: l.productId, trackStock: true }, data: { stock: { increment: l.qty } } });
        }
        if (o.coupon_code)
          await tx.storeCoupon.updateMany({ where: { companyId, code: o.coupon_code, used: { gt: 0 } }, data: { used: { decrement: 1 } } });
      }
      await tx.storeOrder.update({
        where: { id: orderId },
        data: { status: dto.status, paid: dto.paid, staffNote: dto.staffNote === undefined ? undefined : dto.staffNote || null },
      });
    });
    return { ok: true };
  }

  // ───────── tienda pública ─────────

  private async storeBySlug(slug: string) {
    if (!SLUG.test(slug)) throw new NotFoundException('Tienda no encontrada');
    const s = await this.prisma.storeSettings.findUnique({
      where: { slug },
      include: { company: { select: { status: true, phone: true, modules: { where: { key: STORE_MODULE }, select: { key: true } } } } },
    });
    if (!s || s.company.status !== 'active' || !s.company.modules.length) throw new NotFoundException('Tienda no encontrada');
    return s;
  }

  private publicStore(s: Awaited<ReturnType<StoreService['storeBySlug']>>) {
    return {
      slug: s.slug,
      name: s.name,
      tagline: s.tagline,
      whatsapp: waNumber(s.whatsapp ?? s.company.phone),
      open: s.open,
      pickupEnabled: s.pickupEnabled,
      pickupNote: s.pickupNote,
      deliveryEnabled: s.deliveryEnabled,
      deliveryFee: pesos(s.deliveryFeeCents),
      freeFrom: pesos(s.freeFromCents),
      deliveryNote: s.deliveryNote,
      paymentNote: s.paymentNote,
    };
  }

  private publicProduct(p: ProductRow) {
    const variants = p.variants.filter((v) => v.active);
    const has = (stock: number | null) => !p.trackStock || (stock ?? 0) > 0;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: pesos(p.priceCents)!,
      compareAt: pesos(p.compareAtCents),
      imageUrl: p.imageUrl,
      category: p.category,
      featured: p.featured,
      available: variants.length ? variants.some((v) => has(v.stock)) : has(p.stock),
      variants: variants.map((v) => ({ id: v.id, name: v.name, price: pesos(v.priceCents ?? p.priceCents)!, available: has(v.stock) })),
    };
  }

  async publicCatalog(slug: string) {
    const s = await this.storeBySlug(slug);
    const rows = await this.prisma.storeProduct.findMany({
      where: { companyId: s.companyId, active: true },
      orderBy: [{ featured: 'desc' }, { category: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      take: 1000,
      select: productSelect,
    });
    return { store: this.publicStore(s), products: rows.map((p) => this.publicProduct(p)) };
  }

  async publicProductView(slug: string, productId: string) {
    const s = await this.storeBySlug(slug);
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new NotFoundException('Producto no encontrado');
    const p = await this.prisma.storeProduct.findFirst({ where: { id: productId, companyId: s.companyId, active: true }, select: productSelect });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return { store: this.publicStore(s), product: this.publicProduct(p) };
  }

  private async catalogFor(companyId: string, ids: string[], db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const rows = await db.storeProduct.findMany({
      where: { companyId, active: true, id: { in: [...new Set(ids)] } },
      select: {
        id: true,
        name: true,
        priceCents: true,
        trackStock: true,
        stock: true,
        variants: { where: { active: true }, select: { id: true, name: true, priceCents: true, stock: true } },
      },
    });
    return new Map<string, PricedProduct>(rows.map((r) => [r.id, r]));
  }

  private async findCoupon(companyId: string, code: string | undefined, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    if (!code) return undefined;
    return db.storeCoupon.findUnique({ where: { companyId_code: { companyId, code } } });
  }

  /** Precios del carrito (para mostrar los totales y probar un cupón antes de pedir). */
  async publicQuote(slug: string, dto: QuoteCartDto) {
    const s = await this.storeBySlug(slug);
    const lines = priceLines(
      await this.catalogFor(
        s.companyId,
        dto.items.map((i) => i.productId),
      ),
      dto.items,
    );
    const t = totals(lines, await this.findCoupon(s.companyId, dto.coupon), s, dto.delivery);
    return {
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        name: l.name,
        variant: l.variant,
        qty: l.qty,
        unit: pesos(l.unitCents),
        line: pesos(l.lineCents),
      })),
      subtotal: pesos(t.subtotalCents),
      discount: pesos(t.discountCents),
      shipping: pesos(t.shippingCents),
      total: pesos(t.totalCents),
      coupon: dto.coupon || null,
    };
  }

  /** Crea el pedido: revisa precios, descuenta existencias y usa el cupón, todo o nada. */
  async placeOrder(slug: string, dto: PlaceOrderDto) {
    const s = await this.storeBySlug(slug);
    if (!s.open) throw new BadRequestException('La tienda no está recibiendo pedidos en este momento');
    if (dto.delivery === 'delivery' && !dto.address) throw new BadRequestException('Escribe la dirección para el domicilio');
    const order = await this.prisma.$transaction(async (tx) => {
      const lines = priceLines(
        await this.catalogFor(
          s.companyId,
          dto.items.map((i) => i.productId),
          tx,
        ),
        dto.items,
      );
      const coupon = await this.findCoupon(s.companyId, dto.coupon, tx);
      const t = totals(lines, coupon, s, dto.delivery);
      for (const l of lines) {
        const label = l.variant ? `${l.name} (${l.variant})` : l.name;
        const ok =
          l.stockFrom === 'variant'
            ? await tx.storeVariant.updateMany({ where: { id: l.variantId!, stock: { gte: l.qty } }, data: { stock: { decrement: l.qty } } })
            : l.stockFrom === 'product'
              ? await tx.storeProduct.updateMany({ where: { id: l.productId, stock: { gte: l.qty } }, data: { stock: { decrement: l.qty } } })
              : { count: 1 };
        if (!ok.count) throw new BadRequestException(`Se acaba de agotar ${label}`);
      }
      if (coupon) {
        const used = await tx.storeCoupon.updateMany({
          where: { id: coupon.id, ...(coupon.maxUses != null ? { used: { lt: coupon.maxUses } } : {}) },
          data: { used: { increment: 1 } },
        });
        if (!used.count) throw new BadRequestException('Ese cupón ya se agotó');
      }
      const { orderSeq } = await tx.storeSettings.update({
        where: { companyId: s.companyId },
        data: { orderSeq: { increment: 1 } },
        select: { orderSeq: true },
      });
      return tx.storeOrder.create({
        data: {
          companyId: s.companyId,
          number: orderSeq,
          publicToken: randomBytes(18).toString('base64url'),
          customerName: dto.name,
          customerPhone: dto.phone,
          customerEmail: dto.email || null,
          delivery: dto.delivery,
          address: dto.delivery === 'delivery' ? dto.address || null : null,
          notes: dto.notes || null,
          items: lines.map((l) => ({ ...l, unitCents: l.unitCents.toString(), lineCents: l.lineCents.toString() })),
          subtotalCents: t.subtotalCents,
          discountCents: t.discountCents,
          shippingCents: t.shippingCents,
          totalCents: t.totalCents,
          couponCode: coupon ? coupon.code : null,
        },
        select: orderSelect,
      });
    });
    const team = await this.prisma.companyMember.findMany({ where: { companyId: s.companyId, status: 'active' }, select: { id: true, role: true } });
    await this.alerts.notify(
      s.companyId,
      team.filter((m) => roleRank(m.role) >= roleRank('supervisor')).map((m) => m.id),
      {
        kind: 'store',
        title: `Pedido nuevo #${order.number}: ${money(order.totalCents)}`,
        body: `${order.customerName} · ${order.delivery === 'delivery' ? 'domicilio' : 'recoge en el local'}`,
        href: `tienda/pedidos/${order.id}`,
      },
    );
    const lines = order.items as StoredLine[];
    void this.automations.emit(s.companyId, 'store_order', {
      vars: {
        numero: order.number,
        cliente: order.customerName,
        celular: order.customerPhone,
        correo: order.customerEmail ?? '',
        total: money(order.totalCents),
        entrega: order.delivery === 'delivery' ? `domicilio a ${order.address}` : 'recoge en el local',
        productos: lines.map((l) => `${l.qty} × ${l.name}${l.variant ? ` (${l.variant})` : ''}`).join(', '),
      },
      amountPesos: Number(order.totalCents / 100n),
      summary: `Pedido #${order.number} de ${order.customerName} por ${money(order.totalCents)}`,
      href: `tienda/pedidos/${order.id}`,
      contact: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone },
    });
    return { ...this.publicOrderShape(order), store: this.publicStore(s) };
  }

  private publicOrderShape(o: OrderRow) {
    const { staffNote: _n, id: _id, ...rest } = this.order(o);
    return rest;
  }

  async publicOrder(slug: string, token: string) {
    const s = await this.storeBySlug(slug);
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw new NotFoundException('Pedido no encontrado');
    const o = await this.prisma.storeOrder.findFirst({ where: { publicToken: token, companyId: s.companyId }, select: orderSelect });
    if (!o) throw new NotFoundException('Pedido no encontrado');
    return { ...this.publicOrderShape(o), store: this.publicStore(s) };
  }
}
