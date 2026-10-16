import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { RegisterPitch } from '@/components/auth-pitch';
import { AuthShell } from '@/components/auth-shell';
import { ACCESS_COOKIE, rawApi } from '@/lib/api';
import type { Package } from '@/lib/types';

export const metadata: Metadata = { title: 'Crear cuenta — 3R' };

/** El paquete más barato publicado, para el «Desde …» del argumento de venta. */
async function cheapestPackage() {
  try {
    const res = await rawApi<Package[]>('/packages');
    if (!res.ok || !res.data.length) return null;
    const p = res.data.reduce((a, b) => (b.priceCents < a.priceCents ? b : a));
    return { cents: p.priceCents, currency: p.currency };
  } catch {
    return null;
  }
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : undefined;
  if ((await cookies()).has(ACCESS_COOKIE)) redirect(safeNext ?? '/dashboard');
  const from = await cheapestPackage();

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Con tu cuenta haces tu pedido y sigues cómo avanza tu página."
      side={<RegisterPitch from={from} />}
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'} className="text-primary hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <AuthForm mode="register" next={safeNext} />
    </AuthShell>
  );
}
