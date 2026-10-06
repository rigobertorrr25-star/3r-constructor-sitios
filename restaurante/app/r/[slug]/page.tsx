import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { todayIn } from '@/lib/finance';
import { publicMenu } from '@/lib/reservations';
import { PublicReservationForm } from '@/components/public-reservation';
import { card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const menu = await publicMenu((await params).slug);
  return { title: menu ? `Reservar · ${menu.business.name}` : 'Reservar' };
}

export default async function PublicReservationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await publicMenu(slug);
  if (!menu) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <h1 className="text-center font-display text-[28px] font-bold">{menu.business.name}</h1>
      <p className="mt-1 text-center text-[15px] text-muted-foreground">Reserva tu mesa</p>
      <div className={`${card} mt-6`}>
        {menu.reservations ? (
          <PublicReservationForm slug={slug} today={todayIn(menu.business.timezone)} locations={menu.locations} />
        ) : (
          <p className="text-[15px] text-muted-foreground">Por ahora este restaurante no recibe reservas en línea. {menu.phone ? `Llama o escribe al ${menu.phone}.` : ''}</p>
        )}
      </div>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">Usamos tu nombre y teléfono solo para confirmar tu reserva.</p>
    </main>
  );
}
