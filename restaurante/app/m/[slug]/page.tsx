import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCop } from '@/lib/format';
import { publicMenu } from '@/lib/reservations';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const menu = await publicMenu((await params).slug);
  return { title: menu ? `Carta · ${menu.business.name}` : 'Carta' };
}

/** La carta pública que abre el QR de las mesas: lo que hay hoy, con precios. */
export default async function PublicMenuPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mesa?: string }> }) {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const menu = await publicMenu(slug);
  if (!menu) notFound();
  const table = mesa && /^[\w-]{1,12}$/.test(mesa) ? mesa : null;
  const wa = menu.phone ? `https://wa.me/${menu.phone.length === 10 ? `57${menu.phone}` : menu.phone}` : null;
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-8" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <header className="text-center">
        <h1 className="font-display text-[30px] font-bold">{menu.business.name}</h1>
        {table ? <p className="mt-1 text-[15px] text-muted-foreground">Mesa {table} · pídele a tu mesero lo que quieras</p> : <p className="mt-1 text-[15px] text-muted-foreground">Nuestra carta</p>}
      </header>
      <nav aria-label="Categorías" className="sticky top-0 z-10 -mx-4 mt-6 flex gap-1.5 overflow-x-auto bg-background/85 px-4 py-2 backdrop-blur">
        {menu.categories.map((c) => (
          <a key={c.id} href={`#c-${c.id}`} className="whitespace-nowrap rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[14px] text-muted-foreground hover:text-foreground">
            {c.name}
          </a>
        ))}
      </nav>
      <div className="mt-4 space-y-8">
        {menu.categories.map((c) => {
          const products = menu.products.filter((p) => p.categoryId === c.id);
          if (!products.length) return null;
          return (
            <section key={c.id} id={`c-${c.id}`} className="scroll-mt-16">
              <h2 className="font-display text-[22px] font-bold">{c.name}</h2>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {products.map((p) => (
                  <li key={p.id} className={`flex items-baseline justify-between gap-4 py-3 ${p.isAvailable ? '' : 'opacity-50'}`}>
                    <span>
                      <span className="text-[16px] font-medium">{p.name}</span>
                      {p.description ? <span className="block text-[14px] text-muted-foreground">{p.description}</span> : null}
                    </span>
                    <span className="shrink-0 text-[15.5px]">{p.isAvailable ? formatCop(p.price) : 'Agotado'}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <footer className="mt-12 space-y-3 text-center">
        {menu.reservations ? (
          <Link href={`/r/${menu.business.slug}`} className="inline-flex rounded-full bg-primary px-5 py-2.5 text-[15px] font-medium text-primary-foreground">
            Reservar una mesa
          </Link>
        ) : null}
        {wa ? (
          <p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-[14px] text-primary hover:underline">
              Escríbenos por WhatsApp
            </a>
          </p>
        ) : null}
        <p className="text-[12px] text-muted-foreground">Precios en pesos colombianos. La propina es voluntaria.</p>
      </footer>
    </main>
  );
}
