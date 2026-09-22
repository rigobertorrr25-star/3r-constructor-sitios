import type { Metadata } from 'next';
import { PortfolioForm } from '@/components/admin-forms';
import { DeletePortfolioButton } from '@/components/delete-portfolio-button';
import { card } from '@/components/shop';
import { authedApi } from '@/lib/api';
import type { PortfolioItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Portafolio — Administración 3R' };

export default async function AdminPortfolioPage() {
  const { data: items } = await authedApi<PortfolioItem[]>('/admin/portfolio');

  return (
    <>
      <h1 className="font-display text-[32px] font-bold tracking-tight text-foreground">Portafolio</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
        Las páginas que ya hiciste. Se muestran en la portada como “Algunos de nuestros trabajos”. Agrega el enlace de cada una.
      </p>

      <div className="mt-8 space-y-6">
        <details className={card} open={items.length === 0}>
          <summary className="cursor-pointer font-display text-[20px] font-semibold text-foreground">+ Agregar un ejemplo</summary>
          <div className="mt-5">
            <PortfolioForm />
          </div>
        </details>

        {items.map((item) => (
          <section key={item.id} className={card}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[20px] font-semibold text-foreground">
                {item.title}
                {item.isActive === false ? <span className="ml-3 text-[13px] font-normal text-muted-foreground">oculto</span> : null}
              </h2>
              <DeletePortfolioButton itemId={item.id} title={item.title} />
            </div>
            <PortfolioForm item={item} />
          </section>
        ))}
      </div>
    </>
  );
}
