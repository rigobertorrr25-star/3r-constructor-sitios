import type { Metadata } from 'next';
import { LoyaltyProgramForm } from '@/components/admin-forms';
import { card } from '@/components/shop';
import { authedApi } from '@/lib/api';
import type { LoyaltyProgram } from '@/lib/types';

export const metadata: Metadata = { title: 'Fidelización — Administración 3R' };

export default async function AdminLoyaltyPage() {
  const { data: programs } = await authedApi<LoyaltyProgram[]>('/admin/loyalty');

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Fidelización</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
        Tarjetas de sellos de los negocios. Aquí creas el programa y la clave del dueño; los meseros, sus códigos y los clientes los maneja el
        dueño desde su panel.
      </p>

      <div className="mt-8 space-y-6">
        <details className={card} open={programs.length === 0}>
          <summary className="cursor-pointer font-display text-[20px] font-semibold text-foreground">+ Nuevo programa</summary>
          <div className="mt-5">
            <LoyaltyProgramForm />
          </div>
        </details>

        {programs.map((program) => (
          <section key={program.id} className={card}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[20px] font-semibold text-foreground">
                {program.name}
                {program.isActive ? null : <span className="ml-3 text-[13px] font-normal text-muted-foreground">pausado</span>}
              </h2>
              <p className="text-[14px] text-muted-foreground">
                {program._count.customers} {program._count.customers === 1 ? 'cliente' : 'clientes'} · {program._count.staff}{' '}
                {program._count.staff === 1 ? 'mesero' : 'meseros'} · {program.slug}
              </p>
            </div>
            <LoyaltyProgramForm program={program} />
          </section>
        ))}
      </div>
    </>
  );
}
