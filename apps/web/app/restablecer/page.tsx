import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { Alert } from '@/components/shop';
import { ResetPasswordForm } from '@/components/password-forms';

export const metadata: Metadata = { title: 'Cambiar contraseña — 3R' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title="Elige tu nueva contraseña"
      subtitle="Escribe una contraseña nueva para tu cuenta."
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert>
          Este enlace no es válido. Pide uno nuevo desde{' '}
          <Link href="/recuperar" className="underline">
            recuperar contraseña
          </Link>
          .
        </Alert>
      )}
    </AuthShell>
  );
}
