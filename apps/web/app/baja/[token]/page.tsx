import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UnsubscribeButton } from '@/components/marketing-public';
import { rawApi } from '@/lib/api';

export const metadata: Metadata = { title: 'Darte de baja', robots: { index: false, follow: false } };

const card = 'rounded-[28px] border border-white/[0.08] bg-card p-6 shadow-[var(--shadow-glass)] sm:p-8';
type View = { test: boolean; companyName: string | null; email: string | null; done: boolean };

/** El enlace «No quiero recibir más correos» de las campañas. */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== 'prueba' && !/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const res = await rawApi<View>(`/public/marketing/unsubscribe/${token}`).catch(() => null);
  if (!res || !res.ok) notFound();
  const v = res.data;
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:px-8 sm:py-14">
      <section className={card}>
        {v.test ? (
          <>
            <h1 className="font-display text-[24px] font-bold text-foreground">Este es un correo de prueba</h1>
            <p className="mt-3 text-[15px] text-foreground/85">
              Aquí es donde tus clientes se darán de baja. En los correos reales este enlace funciona con un clic.
            </p>
          </>
        ) : v.done ? (
          <>
            <h1 className="font-display text-[24px] font-bold text-foreground">Ya te diste de baja</h1>
            <p className="mt-3 text-[15px] text-foreground/85">No te llegarán más correos de promociones de {v.companyName}.</p>
          </>
        ) : (
          <>
            <p className="text-[14px] text-muted-foreground">{v.companyName}</p>
            <h1 className="mt-1 font-display text-[24px] font-bold text-foreground">¿Ya no quieres recibir nuestros correos?</h1>
            <p className="mt-3 mb-6 text-[15px] text-foreground/85">Dejaremos de mandarle promociones a {v.email}.</p>
            <UnsubscribeButton token={token} companyName={v.companyName ?? ''} />
          </>
        )}
      </section>
    </main>
  );
}
