import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Checkout } from '@/components/storefront';
import { rawApi } from '@/lib/api';
import type { Catalog } from '@/lib/store';

export const metadata: Metadata = { title: 'Tu carrito', robots: { index: false, follow: false } };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const res = await rawApi<Catalog>(`/public/store/${slug}`).catch(() => null);
  if (!res?.ok) notFound();
  const { store, products } = res.data;
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
      <Link href={`/tienda/${store.slug}`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Seguir comprando en {store.name}
      </Link>
      <h1 className="mt-4 font-display text-[28px] font-bold tracking-tight text-foreground">Tu pedido</h1>
      <Checkout store={store} products={products} />
    </main>
  );
}
