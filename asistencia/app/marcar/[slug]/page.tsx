import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PunchForm } from '@/components/punch-form';
import { Alert, Lion, card } from '@/components/ui';
import { AppError, getPublicBusiness, getPunchScreen } from '@/lib/store';

export const metadata: Metadata = { title: 'Marcar asistencia' };

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className={`${card} w-full max-w-[420px]`}>
        <h1 className="mb-6 text-center font-display text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
        {children}
      </div>
    </main>
  );
}

const scanAgain = (
  <div className="space-y-4 text-center">
    <Lion size={72} className="mx-auto" />
    <p className="text-[15px] text-muted-foreground">Escanea el código QR de la tablet de la entrada con la cámara de tu celular.</p>
  </div>
);

export default async function PunchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { slug } = await params;
  const { c } = await searchParams;
  const code = typeof c === 'string' ? c : '';

  // notFound() se llama fuera del try: por dentro lanza un error propio de Next que el catch atraparía.
  let business: { name: string } | null = null;
  let screen: Awaited<ReturnType<typeof getPunchScreen>> | null = null;
  let problem: 'expired' | 'offline' | null = null;
  try {
    business = await getPublicBusiness(slug);
    if (business && code) screen = await getPunchScreen(slug, code);
  } catch (error) {
    if (!(error instanceof AppError)) console.error(error);
    problem = error instanceof AppError && error.code === 'CODE_EXPIRED' ? 'expired' : 'offline';
  }

  if (problem === 'offline') {
    return (
      <Shell title="Marcar entrada o salida">
        <p className="text-center text-[15px] text-muted-foreground">No hay conexión con el servidor. Intenta de nuevo en un momento.</p>
      </Shell>
    );
  }
  if (!business) notFound();
  if (problem === 'expired') {
    return (
      <Shell title={business.name}>
        <div className="space-y-4">
          <Alert>El código ya venció. Escanea otra vez el QR de la entrada.</Alert>
          {scanAgain}
        </div>
      </Shell>
    );
  }
  if (!screen) return <Shell title={business.name}>{scanAgain}</Shell>;
  return (
    <Shell title={screen.name}>
      <PunchForm slug={slug} code={code} employees={screen.employees} />
    </Shell>
  );
}
