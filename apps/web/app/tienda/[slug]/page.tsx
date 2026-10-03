import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Catalog } from '@/components/storefront';
import { rawApi } from '@/lib/api';
import type { Catalog as CatalogData } from '@/lib/store';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;
const load = async (slug: string) => (SLUG.test(slug) ? rawApi<CatalogData>(`/public/store/${slug}`).catch(() => null) : null);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const res = await load((await params).slug);
  if (!res?.ok) return { title: 'Tienda' };
  return { title: res.data.store.name, description: res.data.store.tagline ?? `Pide en línea en ${res.data.store.name}.` };
}

/** La tienda que ven los clientes: catálogo con carrito. */
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const res = await load((await params).slug);
  if (!res?.ok) notFound();
  const { store, products } = res.data;
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-28 pt-10 sm:px-8 sm:pt-14">
      <header>
        <h1 className="font-display text-[30px] font-bold tracking-tight text-foreground sm:text-[38px]">{store.name}</h1>
        {store.tagline ? <p className="mt-2 max-w-2xl text-[15.5px] text-foreground/85">{store.tagline}</p> : null}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
          {store.pickupEnabled ? <span>Recoges en el local</span> : null}
          {store.deliveryEnabled ? (
            <span>
              Domicilio{' '}
              {store.deliveryFee
                ? `desde ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(store.deliveryFee)}`
                : 'gratis'}
            </span>
          ) : null}
        </p>
        {!store.open ? (
          <p className="mt-4 rounded-2xl border border-[#ffd27a]/30 bg-[#ffd27a]/[0.08] px-4 py-3 text-[14px] text-[#ffd27a]">
            En este momento no estamos recibiendo pedidos.
          </p>
        ) : null}
      </header>
      <Catalog store={store} products={products} />
    </main>
  );
}
