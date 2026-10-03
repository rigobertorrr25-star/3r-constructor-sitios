import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubscribeForm } from '@/components/marketing-public';
import { rawApi } from '@/lib/api';

export const metadata: Metadata = { title: 'Recibe nuestras promociones', robots: { index: false, follow: false } };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8';

/** Página pública donde un cliente acepta recibir las promociones de una empresa. */
export default async function SubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const res = await rawApi<{ companyName: string; city: string | null }>(`/public/newsletter/${token}`).catch(() => null);
  if (!res || !res.ok) notFound();
  const { companyName, city } = res.data;
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:px-8 sm:py-14">
      <header>
        <p className="text-[14px] text-muted-foreground">{city ? `${companyName} · ${city}` : companyName}</p>
        <h1 className="mt-1 font-display text-[28px] font-bold tracking-tight text-foreground sm:text-[34px]">Recibe nuestras promociones</h1>
        <p className="mt-3 text-[15.5px] text-foreground/85">Déjanos tu correo y te contamos primero las novedades y descuentos de {companyName}.</p>
      </header>
      <section className={`${card} mt-8`}>
        <SubscribeForm token={token} companyName={companyName} />
      </section>
      <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
        Tus datos los usa solo {companyName} para mandarte sus correos. Página hecha con 3R ·{' '}
        <Link href="/privacidad" className="underline hover:text-foreground">
          privacidad
        </Link>
      </p>
    </main>
  );
}
