import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { ACCESS_COOKIE } from '@/lib/api';

export const metadata: Metadata = { title: 'Crear cuenta — 3R' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : undefined;
  if ((await cookies()).has(ACCESS_COOKIE)) redirect(safeNext ?? '/dashboard');

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Con tu cuenta haces tu pedido y sigues cómo avanza tu página."
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
