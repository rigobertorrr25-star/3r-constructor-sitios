import type { Metadata } from 'next';
import Link from 'next/link';
import { StoreTabs } from '@/components/store-tabs';
import { authedApi } from '@/lib/api';
import { cop, type Product } from '@/lib/store';
import { loadCompany } from '../../company';
import { storeGate } from '../store-gate';

export const metadata: Metadata = { title: 'Productos de la tienda — 3R' };

const stockText = (p: Product) => {
  if (!p.trackStock) return null;
  const n = p.variants.length ? p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0) : (p.stock ?? 0);
  return n > 0 ? `${n} disponibles` : 'Agotado';
};

export default async function StoreProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const { data: products } = await authedApi<Product[]>(`/companies/${id}/store/products`);
  const base = `/empresa/${id}/tienda/productos`;

  return (
    <div className="space-y-6">
      <StoreTabs companyId={id} active="/productos" />
      <Link
        href={`${base}/nuevo`}
        className="inline-flex rounded-full bg-primary px-[25.5px] py-[12.75px] text-[14.875px] font-medium text-primary-foreground transition hover:shadow-[var(--shadow-glow)]"
      >
        + Nuevo producto
      </Link>
      {products.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/[0.12] px-6 py-12 text-center text-muted-foreground">
          Todavía no hay productos. Agrega el primero con su foto y su precio.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-[24px] border border-white/[0.08] bg-card">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`${base}/${p.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.03] ${p.active ? '' : 'opacity-60'}`}
              >
                <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {p.name}
                    {p.featured ? <span className="ml-2 text-[12px] text-primary">Destacado</span> : null}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {[p.category, p.variants.length ? `${p.variants.length} opciones` : null, stockText(p), p.active ? null : 'Oculto']
                      .filter(Boolean)
                      .join(' · ') || 'Sin categoría'}
                  </span>
                </span>
                <span className="font-display text-[16px] font-semibold text-foreground">{cop(p.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
