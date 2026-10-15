'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { placeOrderAction, quoteCartAction } from '@/app/empresa/store-actions';
import { cop, type CartItem, type PublicProduct, type PublicStore, type Quote } from '@/lib/store';
import { Field, inputClass } from './field';
import { Alert } from './shop';

// ───── carrito en el navegador (por tienda) ─────

const KEY = (slug: string) => `3r-cart:${slug}`;
const EVENT = '3r-cart';

function read(slug: string): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(slug)) ?? '[]') as CartItem[];
    return Array.isArray(raw) ? raw.filter((i) => i && typeof i.productId === 'string' && Number.isInteger(i.qty) && i.qty > 0) : [];
  } catch {
    return [];
  }
}
function write(slug: string, items: CartItem[]) {
  try {
    localStorage.setItem(KEY(slug), JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): el carrito vive solo en esta pestaña.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { slug, items } }));
}

export function useCart(slug: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(read(slug));
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ slug: string; items: CartItem[] }>).detail;
      if (d?.slug === slug) setItems(d.items);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [slug]);
  const save = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      write(slug, next);
    },
    [slug],
  );
  const add = (productId: string, variantId: string | null, qty = 1) => {
    const cur = read(slug);
    const i = cur.findIndex((x) => x.productId === productId && x.variantId === variantId);
    if (i >= 0) cur[i] = { ...cur[i], qty: Math.min(99, cur[i].qty + qty) };
    else cur.push({ productId, variantId, qty });
    save(cur);
  };
  const setQty = (productId: string, variantId: string | null, qty: number) =>
    save(
      read(slug).flatMap((x) => (x.productId === productId && x.variantId === variantId ? (qty > 0 ? [{ ...x, qty: Math.min(99, qty) }] : []) : [x])),
    );
  return { items, add, setQty, clear: () => save([]) };
}

/** Precio a mostrar: con opciones de distinto precio, «Desde» el menor. */
export function priceOf(p: PublicProduct) {
  if (!p.variants.length) return { price: p.price, compareAt: p.compareAt, from: false };
  const prices = p.variants.map((v) => v.price);
  const min = Math.min(...prices);
  return { price: min, compareAt: null, from: Math.max(...prices) > min };
}

const unitPrice = (p: PublicProduct, variantId: string | null) => p.variants.find((v) => v.id === variantId)?.price ?? p.price;

// ───── tarjeta de producto ─────

export function AddToCart({ slug, product, open, big = false }: { slug: string; product: PublicProduct; open: boolean; big?: boolean }) {
  const { add } = useCart(slug);
  const firstAvailable = product.variants.find((v) => v.available)?.id ?? null;
  const [variantId, setVariantId] = useState<string | null>(product.variants.length ? firstAvailable : null);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chosen = product.variants.find((v) => v.id === variantId);
  const available = product.variants.length ? !!chosen?.available : product.available;
  if (!open) return null;
  return (
    <div className="space-y-2">
      {product.variants.length ? (
        <select
          aria-label={`Opción de ${product.name}`}
          value={variantId ?? ''}
          onChange={(e) => setVariantId(e.target.value)}
          className={`${inputClass} py-2 text-[14px]`}
        >
          {product.variants.map((v) => (
            <option key={v.id} value={v.id} disabled={!v.available} className="bg-[#0a131a]">
              {v.name}
              {v.available ? '' : ' (agotado)'}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        disabled={!available}
        onClick={() => {
          add(product.id, variantId);
          setAdded(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setAdded(false), 1600);
        }}
        className={`w-full rounded-full bg-primary font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-muted-foreground ${big ? 'px-6 py-3 text-[15px]' : 'px-4 py-2 text-[14px]'}`}
      >
        {!available ? 'Agotado' : added ? '¡Agregado!' : 'Agregar al carrito'}
      </button>
    </div>
  );
}

export function PriceTag({ price, compareAt, from = false }: { price: number; compareAt: number | null; from?: boolean }) {
  return (
    <span className="flex flex-wrap items-baseline gap-2">
      <span className="font-display text-[17px] font-semibold text-foreground">
        {from ? <span className="text-[13px] font-normal text-muted-foreground">Desde </span> : null}
        {cop(price)}
      </span>
      {compareAt ? <span className="text-[13px] text-muted-foreground line-through">{cop(compareAt)}</span> : null}
    </span>
  );
}

/** Barra fija con lo que lleva en el carrito. */
export function CartBar({ slug, products }: { slug: string; products: PublicProduct[] }) {
  const { items } = useCart(slug);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const total = items.reduce((sum, i) => {
    const p = byId.get(i.productId);
    return p ? sum + unitPrice(p, i.variantId) * i.qty : sum;
  }, 0);
  const known = items.every((i) => byId.has(i.productId));
  if (!count) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-background/90 px-4 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
        <span className="text-[14.5px] text-foreground">
          {count} {count === 1 ? 'producto' : 'productos'}
          {known ? (
            <>
              {' '}
              · <strong>{cop(total)}</strong>
            </>
          ) : null}
        </span>
        <Link
          href={`/tienda/${slug}/carrito`}
          className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
        >
          Ver carrito y pedir
        </Link>
      </div>
    </div>
  );
}

export function Catalog({ store, products }: { store: PublicStore; products: PublicProduct[] }) {
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))];
  const [cat, setCat] = useState<string>('');
  const shown = cat ? products.filter((p) => p.category === cat) : products;
  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[13.5px] transition ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-white/[0.1] text-muted-foreground hover:text-foreground'}`;
  return (
    <>
      {categories.length > 1 ? (
        <nav aria-label="Categorías" className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => setCat('')} className={chip(!cat)} aria-pressed={!cat}>
            Todo
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)} aria-pressed={cat === c}>
              {c}
            </button>
          ))}
        </nav>
      ) : null}
      {shown.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-card shadow-[var(--shadow-glass)]">
              <Link href={`/tienda/${store.slug}/p/${p.id}`} className="block">
                <div className="aspect-square bg-white/[0.03]">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center px-3 text-center font-display text-[18px] font-semibold text-muted-foreground">
                      {p.name}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                <Link
                  href={`/tienda/${store.slug}/p/${p.id}`}
                  className="text-[14.5px] font-medium leading-snug text-foreground hover:underline sm:text-[15.5px]"
                >
                  {p.name}
                </Link>
                <PriceTag
                  price={p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : p.price}
                  compareAt={p.variants.length ? null : p.compareAt}
                />
                <div className="mt-auto pt-1">
                  <AddToCart slug={store.slug} product={p} open={store.open} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-[24px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Pronto verás aquí los productos.
        </p>
      )}
      <CartBar slug={store.slug} products={products} />
    </>
  );
}

// ───── carrito y pedido ─────

export function Checkout({ store, products }: { store: PublicStore; products: PublicProduct[] }) {
  const router = useRouter();
  const { items, setQty, clear } = useCart(store.slug);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = items.filter((i) => byId.has(i.productId));
  const [delivery, setDelivery] = useState<'pickup' | 'delivery'>(store.pickupEnabled ? 'pickup' : 'delivery');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const [pending, start] = useTransition();
  const key = JSON.stringify([lines, delivery, coupon]);

  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await quoteCartAction(store.slug, lines, delivery, coupon || undefined);
      if (cancelled) return;
      if (res.ok) {
        setQuote(res.quote);
        setQuoteError(null);
      } else if (coupon && /cup[oó]n/i.test(res.error)) {
        // Si el problema es el cupón, se avisa, se quita y se sigue sin él.
        setCouponError(res.error);
        setCoupon('');
      } else setQuoteError(res.error);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, store.slug]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await placeOrderAction(store.slug, { items: lines, delivery, coupon: coupon || undefined, ...form });
      if (!res.ok) return setError(res.error);
      clear();
      router.push(`/tienda/${store.slug}/pedido/${res.order.publicToken}?nuevo=1`);
    });
  }

  if (!lines.length) {
    return (
      <div className="mt-8 rounded-[24px] border border-dashed border-white/[0.12] px-6 py-12 text-center">
        <p className="text-muted-foreground">Tu carrito está vacío.</p>
        <Link
          href={`/tienda/${store.slug}`}
          className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground"
        >
          Ver los productos
        </Link>
      </div>
    );
  }

  const opt = (on: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${on ? 'border-primary/60 bg-primary/[0.06]' : 'border-white/[0.08] hover:border-white/[0.16]'}`;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-6">
        <section className="rounded-[24px] border border-white/[0.08] bg-card p-5" aria-label="Productos">
          <ul className="divide-y divide-white/[0.06]">
            {lines.map((i) => {
              const p = byId.get(i.productId)!;
              const v = p.variants.find((x) => x.id === i.variantId);
              return (
                <li key={`${i.productId}:${i.variantId}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-foreground">{p.name}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {v ? `${v.name} · ` : ''}
                      {cop(unitPrice(p, i.variantId))} c/u
                    </span>
                  </span>
                  <span className="flex items-center rounded-full border border-white/[0.12]">
                    <button
                      type="button"
                      onClick={() => setQty(i.productId, i.variantId, i.qty - 1)}
                      aria-label={`Quitar uno de ${p.name}`}
                      className="px-3 py-1.5 text-foreground"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-[14px] tabular-nums text-foreground" aria-label="Cantidad">
                      {i.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(i.productId, i.variantId, i.qty + 1)}
                      aria-label={`Agregar uno de ${p.name}`}
                      className="px-3 py-1.5 text-foreground"
                    >
                      +
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-[17px] font-semibold text-foreground">¿Cómo lo recibes?</legend>
          {store.pickupEnabled ? (
            <label className={opt(delivery === 'pickup')}>
              <input
                type="radio"
                name="delivery"
                checked={delivery === 'pickup'}
                onChange={() => setDelivery('pickup')}
                className="mt-1 size-4 accent-[#8a9bff]"
              />
              <span>
                <span className="block text-[15px] text-foreground">Lo recojo en el local · gratis</span>
                {store.pickupNote ? <span className="block text-[13px] text-muted-foreground">{store.pickupNote}</span> : null}
              </span>
            </label>
          ) : null}
          {store.deliveryEnabled ? (
            <label className={opt(delivery === 'delivery')}>
              <input
                type="radio"
                name="delivery"
                checked={delivery === 'delivery'}
                onChange={() => setDelivery('delivery')}
                className="mt-1 size-4 accent-[#8a9bff]"
              />
              <span>
                <span className="block text-[15px] text-foreground">
                  Domicilio · {store.deliveryFee ? cop(store.deliveryFee) : 'gratis'}
                  {store.freeFrom ? <span className="text-muted-foreground"> (gratis desde {cop(store.freeFrom)})</span> : null}
                </span>
                {store.deliveryNote ? <span className="block text-[13px] text-muted-foreground">{store.deliveryNote}</span> : null}
              </span>
            </label>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-[17px] font-semibold text-foreground">Tus datos</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="name" required minLength={2} maxLength={150} value={form.name} onChange={set('name')} autoComplete="name" />
            <Field
              label="Celular"
              name="phone"
              required
              type="tel"
              maxLength={30}
              value={form.phone}
              onChange={set('phone')}
              autoComplete="tel"
              placeholder="300 123 4567"
            />
          </div>
          {delivery === 'delivery' ? (
            <Field
              label="Dirección de entrega"
              name="address"
              required
              maxLength={300}
              value={form.address}
              onChange={set('address')}
              autoComplete="street-address"
              placeholder="Calle 10 # 5-20, apto 301, barrio"
            />
          ) : null}
          <Field
            label="Correo (opcional)"
            name="email"
            type="email"
            maxLength={255}
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />
          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-foreground">
              Notas (opcional)
            </label>
            <textarea
              id="notes"
              rows={2}
              maxLength={1000}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Sin azúcar, timbre dañado…"
              className={`${inputClass} resize-y`}
            />
          </div>
        </fieldset>
      </div>

      <aside className="space-y-4 rounded-[24px] border border-white/[0.08] bg-card p-5 lg:sticky lg:top-6">
        <div className="flex gap-2">
          <input
            aria-label="Cupón de descuento"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder="Cupón"
            maxLength={30}
            className={`${inputClass} py-2 uppercase`}
          />
          <button
            type="button"
            onClick={() => {
              setCouponError(null);
              setCoupon(couponInput.trim());
            }}
            className="shrink-0 rounded-full border border-white/[0.12] px-4 text-[13.5px] text-foreground hover:bg-white/[0.06]"
          >
            Aplicar
          </button>
        </div>
        {couponError ? <p className="text-[13px] text-[#ffb4b5]">{couponError}</p> : null}
        {quoteError ? <p className="text-[13px] text-[#ffb4b5]">{quoteError}</p> : null}
        {quote ? (
          <dl className="space-y-1.5 text-[14.5px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-foreground">{cop(quote.subtotal)}</dd>
            </div>
            {quote.discount ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Descuento {quote.coupon}</dt>
                <dd className="text-[#9df0c6]">−{cop(quote.discount)}</dd>
              </div>
            ) : null}
            {delivery === 'delivery' ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Domicilio</dt>
                <dd className="text-foreground">{quote.shipping ? cop(quote.shipping) : 'Gratis'}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-white/[0.08] pt-2 font-display text-[18px] font-semibold">
              <dt className="text-foreground">Total</dt>
              <dd className="text-foreground">{cop(quote.total)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-[14px] text-muted-foreground">Calculando…</p>
        )}
        {store.paymentNote ? <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-[13.5px] text-foreground/85">{store.paymentNote}</p> : null}
        {error ? <Alert>{error}</Alert> : null}
        {store.open ? (
          <button
            type="submit"
            disabled={pending || !quote || !!quoteError}
            className="w-full rounded-full bg-primary px-6 py-3 text-[15px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {pending ? 'Enviando…' : 'Hacer el pedido'}
          </button>
        ) : (
          <Alert>La tienda no está recibiendo pedidos en este momento.</Alert>
        )}
        <p className="text-center text-[12.5px] text-muted-foreground">Después podrás enviarlo también por WhatsApp.</p>
      </aside>
    </form>
  );
}
