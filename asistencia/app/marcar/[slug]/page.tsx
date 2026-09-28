import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PunchForm } from '@/components/punch-form';
import { Lion, card } from '@/components/ui';
import { getPublicBusiness } from '@/lib/store';

export const metadata: Metadata = { title: 'Marcar asistencia' };

export default async function PunchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { slug } = await params;
  const { c } = await searchParams;
  let business: { name: string } | null | undefined;
  try {
    business = await getPublicBusiness(slug);
  } catch (error) {
    console.error(error);
    business = undefined;
  }
  if (business === null) notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className={`${card} w-full max-w-[420px]`}>
        <h1 className="mb-6 text-center font-display text-[22px] font-bold tracking-tight text-foreground">
          {business ? business.name : 'Marcar entrada o salida'}
        </h1>
        {!business ? (
          <p className="text-center text-[15px] text-muted-foreground">No hay conexión con el servidor. Intenta de nuevo en un momento.</p>
        ) : typeof c === 'string' && c ? (
          <PunchForm slug={slug} code={c} />
        ) : (
          <div className="space-y-4 text-center">
            <Lion size={72} className="mx-auto" />
            <p className="text-[15px] text-muted-foreground">Escanea el código QR de la tablet de la entrada con la cámara de tu celular.</p>
          </div>
        )}
      </div>
    </main>
  );
}
