import type { Metadata } from 'next';
import { PackageForm } from '@/components/admin-forms';
import { card } from '@/components/shop';
import { authedApi } from '@/lib/api';
import type { Package } from '@/lib/types';

export const metadata: Metadata = { title: 'Paquetes — Administración 3R' };

export default async function AdminPackagesPage() {
  const { data: packages } = await authedApi<Package[]>('/admin/packages');

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Paquetes</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
        Lo que ves aquí es lo que se muestra en la portada. Cambiar un precio no altera los pedidos que ya se hicieron.
      </p>

      <div className="mt-8 space-y-6">
        {packages.map((pkg) => (
          <section key={pkg.id} className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[20px] font-semibold text-foreground">{pkg.name}</h2>
              <p className="text-[13px] text-muted-foreground">
                {pkg._count?.orders ?? 0} {pkg._count?.orders === 1 ? 'pedido' : 'pedidos'}
                {pkg.isActive === false ? ' · oculto' : ''}
              </p>
            </div>
            <PackageForm pkg={pkg} />
          </section>
        ))}

        <details className={card}>
          <summary className="cursor-pointer font-display text-[20px] font-semibold text-foreground">+ Nuevo paquete</summary>
          <div className="mt-5">
            <PackageForm />
          </div>
        </details>
      </div>
    </>
  );
}
