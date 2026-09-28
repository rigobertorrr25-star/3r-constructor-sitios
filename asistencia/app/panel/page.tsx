import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateBusinessForm } from '@/components/panel-forms';
import { card } from '@/components/ui';
import { listBusinesses } from '@/lib/store';

export const metadata: Metadata = { title: 'Negocios — Asistencia 3R' };

export default async function PanelPage() {
  const businesses = await listBusinesses();

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Negocios</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
        Una tablet en la entrada muestra un código QR que cambia cada 30 segundos. Cada empleado lo escanea con su celular y pone su
        PIN para marcar entrada o salida.
      </p>

      <div className="mt-8 space-y-4">
        {businesses.map((business) => (
          <Link
            key={business.id}
            href={`/panel/${business.id}`}
            className={`${card} flex flex-wrap items-center justify-between gap-2 transition hover:border-white/[0.16]`}
          >
            <span className="font-display text-[20px] font-semibold text-foreground">{business.name}</span>
            <span className="text-[14px] text-muted-foreground">
              {business.employees} {business.employees === 1 ? 'empleado' : 'empleados'}
            </span>
          </Link>
        ))}

        <details className={card} open={businesses.length === 0}>
          <summary className="cursor-pointer font-display text-[20px] font-semibold text-foreground">+ Agregar un negocio</summary>
          <div className="mt-5 max-w-md">
            <CreateBusinessForm />
          </div>
        </details>
      </div>
    </>
  );
}
