import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { Alert } from '@/components/shop';
import { rawApi } from '@/lib/api';
import { errorText, type ApiError } from '@/lib/types';

export const metadata: Metadata = { title: 'Confirmar correo — 3R' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await rawApi<{ verified?: boolean } & ApiError>('/auth/verify-email', { method: 'POST', body: { token } }) : null;

  return (
    <AuthShell
      title="Confirmar tu correo"
      subtitle={result?.ok ? '¡Ya está confirmado!' : 'Un último paso antes de pedir tu página.'}
      footer={
        <Link href="/dashboard" className="text-primary hover:underline">
          Ir a mis pedidos
        </Link>
      }
    >
      {!token ? (
        <Alert>Este enlace no es válido.</Alert>
      ) : result?.ok ? (
        <Alert tone="ok">¡Listo! Tu correo quedó confirmado. Ya puedes pedir tu página.</Alert>
      ) : (
        <Alert>
          {errorText(result?.data, 'Ese enlace no es válido o ya expiró.')} Inicia sesión y pide que te reenviemos el enlace desde tu cuenta.
        </Alert>
      )}
    </AuthShell>
  );
}
