import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PunchForm } from '@/components/punch-form';
import { card } from '@/components/shop';
import { rawApi } from '@/lib/api';

export const metadata: Metadata = { title: 'Marcar asistencia', robots: { index: false, follow: false } };

export default async function PunchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { slug } = await params;
  const { c } = await searchParams;
  const res = await rawApi<{ name: string }>(`/attendance/${encodeURIComponent(slug)}`).catch(() => null);
  if (res && res.status === 404) notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className={`${card} w-full max-w-[420px]`}>
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Asistencia</p>
        <h1 className="mt-1 mb-6 text-center font-display text-[24px] font-bold tracking-tight text-foreground">
          {res?.ok ? res.data.name : 'Marcar entrada o salida'}
        </h1>
        {!res?.ok ? (
          <p className="text-center text-[15px] text-muted-foreground">No hay conexión con el servidor. Intenta de nuevo en un momento.</p>
        ) : typeof c === 'string' && c ? (
          <PunchForm slug={slug} code={c} />
        ) : (
          <p className="text-center text-[15px] text-muted-foreground">Escanea el código QR de la tablet de la entrada con la cámara de tu celular.</p>
        )}
      </div>
    </main>
  );
}
