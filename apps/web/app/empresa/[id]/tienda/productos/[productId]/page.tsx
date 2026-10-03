import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteProductAction } from '@/app/empresa/store-actions';
import { ProductEditor } from '@/components/store-forms';
import { authedApi } from '@/lib/api';
import type { Product } from '@/lib/store';
import { loadCompany } from '../../../company';
import { storeGate } from '../../store-gate';

export const metadata: Metadata = { title: 'Editar producto — 3R' };

export default async function EditStoreProductPage({ params }: { params: Promise<{ id: string; productId: string }> }) {
  const { id, productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const [res, list] = await Promise.all([
    authedApi<Product>(`/companies/${id}/store/products/${productId}`),
    authedApi<Product[]>(`/companies/${id}/store/products`),
  ]);
  if (!res.ok) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/tienda/productos`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Productos
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">{res.data.name}</h2>
        <ProductEditor
          companyId={id}
          product={res.data}
          categories={list.ok ? [...new Set(list.data.map((p) => p.category).filter((c): c is string => !!c))] : []}
        />
      </div>
      <form action={deleteProductAction}>
        <input type="hidden" name="companyId" value={id} />
        <input type="hidden" name="productId" value={res.data.id} />
        <button type="submit" className="text-[13px] text-muted-foreground transition hover:text-[#ffb4b5]">
          Borrar el producto
        </button>
      </form>
    </div>
  );
}
