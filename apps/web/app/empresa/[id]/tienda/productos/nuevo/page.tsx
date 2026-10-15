import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductEditor } from '@/components/store-forms';
import { authedApi } from '@/lib/api';
import { canUseAiText } from '@/lib/companies';
import type { Product } from '@/lib/store';
import { loadCompany } from '../../../company';
import { storeGate } from '../../store-gate';

export const metadata: Metadata = { title: 'Nuevo producto — 3R' };

export default async function NewStoreProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company } = await loadCompany(id);
  if (!company) return null;
  const gate = storeGate(company);
  if (gate) return gate;
  const { data: products } = await authedApi<Product[]>(`/companies/${id}/store/products`);
  return (
    <div className="space-y-6">
      <Link href={`/empresa/${id}/tienda/productos`} className="text-[14px] text-muted-foreground transition hover:text-foreground">
        ← Productos
      </Link>
      <div className="rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <h2 className="mb-6 font-display text-[22px] font-semibold text-foreground">Nuevo producto</h2>
        <ProductEditor
          companyId={id}
          ai={canUseAiText(company)}
          categories={[...new Set(products.map((p) => p.category).filter((c): c is string => !!c))]}
        />
      </div>
    </div>
  );
}
