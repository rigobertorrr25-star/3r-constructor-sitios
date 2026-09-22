import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { Alert } from '@/components/shop';
import { ACCESS_COOKIE } from '@/lib/api';

export const metadata: Metadata = { title: 'Iniciar sesión — 3R' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; next?: string; reset?: string }>;
}) {
  const { expired, next, reset } = await searchParams;
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : undefined;
  // Con `expired` la sesión ya no sirve aunque quede la cookie: no se redirige para evitar un bucle.
  if (!expired && (await cookies()).has(ACCESS_COOKIE)) redirect(safeNext ?? '/dashboard');

  return (
    <AuthShell
      title="Bienvenido de nuevo"
      subtitle={expired ? 'Tu sesión expiró. Inicia sesión otra vez.' : 'Entra para ver el avance de tus pedidos.'}
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link href={safeNext ? `/registro?next=${encodeURIComponent(safeNext)}` : '/registro'} className="text-primary hover:underline">
            Crea una
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {reset ? <Alert tone="ok">Tu contraseña se cambió. Inicia sesión con la nueva.</Alert> : null}
        <AuthForm mode="login" next={safeNext} />
        <p className="text-center text-[13.5px]">
          <Link href="/recuperar" className="text-muted-foreground hover:text-foreground hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
