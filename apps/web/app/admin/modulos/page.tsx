import type { Metadata } from 'next';
import { PricesForm } from '@/components/billing-forms';
import { authedApi } from '@/lib/api';
import type { ModulePrice } from '@/lib/billing';

export const metadata: Metadata = { title: 'Precios de módulos — Administración 3R' };

export default async function ModulePricesPage() {
  const { data } = await authedApi<ModulePrice[]>('/admin/billing/prices');
  return (
    <>
      <h1 className="font-display text-[30px] font-bold tracking-tight text-foreground">Precios de los módulos</h1>
      <p className="mt-1 max-w-2xl text-[14.5px] text-muted-foreground">
        Lo que paga cada empresa al mes por cada módulo activo. La factura mensual suma los módulos que tenga activos ese día.
      </p>
      <div className="mt-8 max-w-2xl rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)]">
        <PricesForm prices={[...data.filter((p) => p.ready), ...data.filter((p) => !p.ready)]} />
      </div>
    </>
  );
}
