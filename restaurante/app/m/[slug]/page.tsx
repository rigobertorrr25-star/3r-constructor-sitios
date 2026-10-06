import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCop } from '@/lib/format';
import { productPhotoUrl } from '@/lib/product-photo-url';
import { publicMenu } from '@/lib/reservations';
import { LangSwitch } from '@/components/i18n';
import { getLang, getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const menu = await publicMenu((await params).slug);
  const t = await getT();
  return { title: menu ? t('Carta · {name}', { name: menu.business.name }) : t('Carta') };
}

/** La carta pública que abre el QR de las mesas: lo que hay hoy, con precios. */
export default async function PublicMenuPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mesa?: string }> }) {
  const { slug } = await params;
  const { mesa } = await searchParams;
  const t = await getT();
  const lang = await getLang();
  const found = await publicMenu(slug);
  if (!found) notFound();
  // En inglés, cada plato y categoría con su nombre en inglés si el restaurante lo escribió.
  const en = lang === 'en';
  const menu = {
    ...found,
    categories: found.categories.map((c) => ({ ...c, name: (en && c.nameEn) || c.name })),
    products: found.products.map((p) => ({ ...p, name: (en && p.nameEn) || p.name, description: (en && p.descriptionEn) || p.description })),
  };
  const table = mesa && /^[\w-]{1,12}$/.test(mesa) ? mesa : null;
  const wa = menu.phone ? `https://wa.me/${menu.phone.length === 10 ? `57${menu.phone}` : menu.phone}` : null;
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-16 pt-8" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className="flex justify-end">
        <LangSwitch />
      </div>
      <header className="mt-2 text-center">
        <h1 className="font-display text-[30px] font-bold">{menu.business.name}</h1>
        {table ? <p className="mt-1 text-[15px] text-muted-foreground">{t('Mesa {table} · pídele a tu mesero lo que quieras', { table })}</p> : <p className="mt-1 text-[15px] text-muted-foreground">{t('Nuestra carta')}</p>}
      </header>
      <nav aria-label={t('Categorías')} className="sticky top-0 z-10 -mx-4 mt-6 flex gap-1.5 overflow-x-auto bg-background/85 px-4 py-2 backdrop-blur">
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
                {products.map((p) => {
                  const photo = productPhotoUrl(p.id, p.photo);
                  return photo ? (
                    <li key={p.id} className={`flex items-center gap-4 py-3 ${p.isAvailable ? '' : 'opacity-50'}`}>
                      <span className="min-w-0 flex-1">
                        <span className="text-[16px] font-medium">{p.name}</span>
                        {p.description ? <span className="block text-[14px] text-muted-foreground">{p.description}</span> : null}
                        <span className="mt-1 block text-[15.5px]">{p.isAvailable ? formatCop(p.price) : t('Agotado')}</span>
                      </span>
                      <img src={photo} alt={p.name} className="size-24 shrink-0 rounded-2xl object-cover sm:size-28" loading="lazy" />
                    </li>
                  ) : (
                    <li key={p.id} className={`flex items-baseline justify-between gap-4 py-3 ${p.isAvailable ? '' : 'opacity-50'}`}>
                      <span>
                        <span className="text-[16px] font-medium">{p.name}</span>
                        {p.description ? <span className="block text-[14px] text-muted-foreground">{p.description}</span> : null}
                      </span>
                      <span className="shrink-0 text-[15.5px]">{p.isAvailable ? formatCop(p.price) : t('Agotado')}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <footer className="mt-12 space-y-3 text-center">
        {menu.reservations ? (
          <Link href={`/r/${menu.business.slug}`} className="inline-flex rounded-full bg-primary px-5 py-2.5 text-[15px] font-medium text-primary-foreground">
            {t('Reservar una mesa')}
          </Link>
        ) : null}
        {wa ? (
          <p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-[14px] text-primary hover:underline">
              {t('Escríbenos por WhatsApp')}
            </a>
          </p>
        ) : null}
        <p className="text-[12px] text-muted-foreground">{t('Precios en pesos colombianos. La propina es voluntaria.')}</p>
      </footer>
    </main>
  );
}
