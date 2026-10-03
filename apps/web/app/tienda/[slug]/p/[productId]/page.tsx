import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart, CartBar, PriceTag, priceOf } from '@/components/storefront';
import { rawApi } from '@/lib/api';
import type { PublicProduct, PublicStore } from '@/lib/store';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;
const load = async (slug: string, id: string) =>
  SLUG.test(slug) && /^[0-9a-f-]{36}$/i.test(id)
    ? rawApi<{ store: PublicStore; product: PublicProduct }>(`/public/store/${slug}/products/${id}`).catch(() => null)
    : null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const res = await load(slug, productId);
  if (!res?.ok) return { title: 'Producto' };
  const { store, product } = res.data;
  return {
    title: `${product.name} — ${store.name}`,
    description: product.description?.slice(0, 160) ?? undefined,
    openGraph: product.imageUrl ? { images: [product.imageUrl] } : undefined,
  };
}

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const res = await load(slug, productId);
  if (!res?.ok) notFound();
  const { store, product: p } = res.data;
  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 pb-28 pt-8 sm:px-8 sm:pt-12">
      <Link href={`/tienda/${store.slug}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← {store.name}
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03]">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center px-6 text-center font-display text-[24px] font-semibold text-muted-foreground">
              {p.name}
            </div>
          )}
        </div>
        <div className="space-y-5">
          {p.category ? <p className="text-[14px] text-muted-foreground">{p.category}</p> : null}
          <h1 className="font-display text-[28px] font-bold tracking-tight text-foreground sm:text-[34px]">{p.name}</h1>
          <PriceTag
            price={p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : p.price}
            compareAt={p.variants.length ? null : p.compareAt}
          />
          {p.description ? <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground/85">{p.description}</p> : null}
          {store.open ? (
            <AddToCart slug={store.slug} product={p} open big />
          ) : (
            <p className="rounded-2xl border border-[#ffd27a]/30 bg-[#ffd27a]/[0.08] px-4 py-3 text-[14px] text-[#ffd27a]">
              En este momento no estamos recibiendo pedidos.
            </p>
          )}
        </div>
      </div>
      <CartBar slug={store.slug} products={[p]} />
    </main>
  );
}
